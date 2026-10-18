package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// The iPad only gives a page its GPS position on a secure (https) address.
// So the program makes its own little certificate authority the first time it
// runs, and uses it to sign a certificate for this computer's addresses. The
// iPad is told to trust that authority once (Settings), and from then on the
// https address works like any other website.

type Certs struct {
	dir   string
	hosts []string
	caPEM []byte
	ca    *x509.Certificate
	caKey *ecdsa.PrivateKey
}

// LoadCerts loads (or makes) the authority, and makes sure the server
// certificate covers every address in hosts.
func LoadCerts(dir string, hosts []string) (*Certs, *tls.Certificate, error) {
	c := &Certs{dir: dir, hosts: hosts}
	if err := c.loadCA(); err != nil {
		return nil, nil, err
	}
	cert, err := c.serverCert()
	return c, cert, err
}

func (c *Certs) loadCA() error {
	certPath, keyPath := filepath.Join(c.dir, "ca.crt"), filepath.Join(c.dir, "ca.key")
	certPEM, err1 := os.ReadFile(certPath)
	keyPEM, err2 := os.ReadFile(keyPath)
	if err1 == nil && err2 == nil {
		ca, key, err := parsePair(certPEM, keyPEM)
		if err == nil && time.Until(ca.NotAfter) > 30*24*time.Hour {
			c.ca, c.caKey, c.caPEM = ca, key, certPEM
			return nil
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	host, _ := os.Hostname()
	tmpl := &x509.Certificate{
		SerialNumber:          serial(),
		Subject:               pkix.Name{CommonName: "Roadtrip Games at home (" + host + ")", Organization: []string{"Roadtrip Games"}},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().AddDate(20, 0, 0),
		IsCA:                  true,
		BasicConstraintsValid: true,
		MaxPathLenZero:        true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return err
	}
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := writePair(certPath, keyPath, certPEM, key); err != nil {
		return err
	}
	c.ca, _ = x509.ParseCertificate(der)
	c.caKey, c.caPEM = key, certPEM
	// A new authority means any old server certificate is useless.
	os.Remove(filepath.Join(c.dir, "server.crt"))
	return nil
}

func (c *Certs) serverCert() (*tls.Certificate, error) {
	certPath, keyPath := filepath.Join(c.dir, "server.crt"), filepath.Join(c.dir, "server.key")
	if certPEM, err := os.ReadFile(certPath); err == nil {
		if keyPEM, err := os.ReadFile(keyPath); err == nil {
			if cert, _, err := parsePair(certPEM, keyPEM); err == nil && c.covers(cert) &&
				cert.CheckSignatureFrom(c.ca) == nil && time.Until(cert.NotAfter) > 30*24*time.Hour {
				pair, err := tls.X509KeyPair(certPEM, keyPEM)
				return &pair, err
			}
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial(),
		Subject:      pkix.Name{CommonName: "Roadtrip Games"},
		NotBefore:    time.Now().Add(-time.Hour),
		// Apple devices refuse server certificates that last longer than this.
		NotAfter:    time.Now().AddDate(0, 0, 397),
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	for _, h := range c.hosts {
		if ip := net.ParseIP(h); ip != nil {
			tmpl.IPAddresses = append(tmpl.IPAddresses, ip)
		} else {
			tmpl.DNSNames = append(tmpl.DNSNames, h)
		}
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, c.ca, &key.PublicKey, c.caKey)
	if err != nil {
		return nil, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := writePair(certPath, keyPath, certPEM, key); err != nil {
		return nil, err
	}
	keyDER, _ := x509.MarshalECPrivateKey(key)
	pair, err := tls.X509KeyPair(certPEM, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
	return &pair, err
}

func (c *Certs) covers(cert *x509.Certificate) bool {
	for _, h := range c.hosts {
		if ip := net.ParseIP(h); ip != nil {
			if !slices.ContainsFunc(cert.IPAddresses, ip.Equal) {
				return false
			}
		} else if !slices.Contains(cert.DNSNames, h) {
			return false
		}
	}
	return true
}

func parsePair(certPEM, keyPEM []byte) (*x509.Certificate, *ecdsa.PrivateKey, error) {
	cb, _ := pem.Decode(certPEM)
	kb, _ := pem.Decode(keyPEM)
	if cb == nil || kb == nil {
		return nil, nil, errors.New("not a certificate")
	}
	cert, err := x509.ParseCertificate(cb.Bytes)
	if err != nil {
		return nil, nil, err
	}
	key, err := x509.ParseECPrivateKey(kb.Bytes)
	return cert, key, err
}

func writePair(certPath, keyPath string, certPEM []byte, key *ecdsa.PrivateKey) error {
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(certPath), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600); err != nil {
		return err
	}
	return os.WriteFile(certPath, certPEM, 0o644)
}

func serial() *big.Int {
	n, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	return n
}

// certHosts is every name and address the iPad might use to reach this
// computer: its own addresses, its name, and any extras given in -hosts
// (needed in Docker, where the program can't see the computer's real address).
func certHosts(extra string) []string {
	hosts := []string{"localhost", "127.0.0.1"}
	if h, err := os.Hostname(); err == nil && h != "" {
		hosts = append(hosts, h)
		if !strings.Contains(h, ".") {
			hosts = append(hosts, h+".local", h+".lan")
		}
	}
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil && !ipn.IP.IsLoopback() && !ipn.IP.IsLinkLocalUnicast() {
			hosts = append(hosts, ipn.IP.String())
		}
	}
	for _, h := range strings.FieldsFunc(extra, func(r rune) bool { return r == ',' || r == ' ' }) {
		hosts = append(hosts, h)
	}
	slices.Sort(hosts)
	return slices.Compact(hosts)
}

// fingerprint lets you check on the iPad that the authority is the right one.
func (c *Certs) fingerprint() string {
	sum := fmt.Sprintf("%x", sha256.Sum256(c.ca.Raw))
	var b strings.Builder
	for i := 0; i < len(sum); i += 2 {
		if i > 0 {
			b.WriteByte(':')
		}
		b.WriteString(strings.ToUpper(sum[i : i+2]))
	}
	return b.String()
}

func describeHosts(hosts []string, port int) []string {
	var out []string
	for _, h := range hosts {
		if h == "localhost" || h == "127.0.0.1" {
			continue
		}
		out = append(out, fmt.Sprintf("https://%s:%d/", h, port))
	}
	return out
}
