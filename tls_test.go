package main

import (
	"crypto/x509"
	"testing"
)

func TestCertsCoverHostsAndSurviveRestart(t *testing.T) {
	dir := t.TempDir()
	c, cert, err := LoadCerts(dir, []string{"localhost", "192.168.1.50"})
	if err != nil {
		t.Fatal(err)
	}
	leaf, _ := x509.ParseCertificate(cert.Certificate[0])
	pool := x509.NewCertPool()
	pool.AppendCertsFromPEM(c.caPEM)
	for _, h := range []string{"localhost", "192.168.1.50"} {
		if _, err := leaf.Verify(x509.VerifyOptions{Roots: pool, DNSName: h}); err != nil {
			t.Errorf("%s: %v", h, err)
		}
	}
	if days := leaf.NotAfter.Sub(leaf.NotBefore).Hours() / 24; days > 398 {
		t.Errorf("server certificate lasts %.0f days; Apple allows 398", days)
	}

	// Same addresses after a restart: same authority, same certificate.
	c2, cert2, _ := LoadCerts(dir, []string{"192.168.1.50", "localhost"})
	if c2.fingerprint() != c.fingerprint() || string(cert2.Certificate[0]) != string(cert.Certificate[0]) {
		t.Error("restart changed the certificates")
	}
	// A new address: same authority (no re-trusting on the iPad), new certificate.
	c3, cert3, _ := LoadCerts(dir, []string{"localhost", "10.0.0.7"})
	leaf3, _ := x509.ParseCertificate(cert3.Certificate[0])
	if c3.fingerprint() != c.fingerprint() {
		t.Error("authority changed")
	}
	if _, err := leaf3.Verify(x509.VerifyOptions{Roots: pool, DNSName: "10.0.0.7"}); err != nil {
		t.Error(err)
	}
}
