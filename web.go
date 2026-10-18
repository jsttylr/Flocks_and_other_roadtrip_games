package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"strconv"
	"time"
)

//go:embed web
var webFiles embed.FS

type App struct {
	store     *Store
	port      int
	httpsPort int    // 0 when there's no secure address
	certs     *Certs // nil when there's no secure address
}

func (a *App) handler() http.Handler {
	mux := http.NewServeMux()
	static, _ := fs.Sub(webFiles, "web")
	files := http.FileServer(http.FS(static))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Always check for a newer page, so an update reaches the tablet the next
		// time it's home. The tablet keeps its own copy for when it's offline.
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, req)
	}))

	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, req *http.Request) {
		st := map[string]any{"version": appVersion, "events": a.store.Count(), "addresses": lanAddresses(a.port)}
		if a.certs != nil {
			st["secure_addresses"] = describeHosts(a.certs.hosts, a.httpsPort)
			st["fingerprint"] = a.certs.fingerprint()
		}
		writeJSON(w, st)
	})

	// The certificate authority the iPad is asked to trust, for the secure address.
	mux.HandleFunc("GET /roadtrip-games.crt", func(w http.ResponseWriter, req *http.Request) {
		if a.certs == nil {
			http.NotFound(w, req)
			return
		}
		w.Header().Set("Content-Type", "application/x-x509-ca-cert")
		w.Header().Set("Content-Disposition", `attachment; filename="roadtrip-games.crt"`)
		w.Write(a.certs.caPEM)
	})

	// The tablet asks for everything after the last event it has.
	mux.HandleFunc("GET /api/events", func(w http.ResponseWriter, req *http.Request) {
		since, _ := strconv.ParseInt(req.URL.Query().Get("since"), 10, 64)
		evs, last := a.store.Since(since)
		writeJSON(w, map[string]any{"events": evs, "seq": last})
	})

	// The tablet sends what happened while it was away.
	mux.HandleFunc("POST /api/events", func(w http.ResponseWriter, req *http.Request) {
		var body struct {
			Events []Event `json:"events"`
		}
		req.Body = http.MaxBytesReader(w, req.Body, 8<<20)
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "couldn't read the events: "+err.Error(), http.StatusBadRequest)
			return
		}
		n, err := a.store.Add(body.Events)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]any{"added": n})
	})

	// A copy of the whole history, for safekeeping.
	mux.HandleFunc("GET /api/backup", func(w http.ResponseWriter, req *http.Request) {
		evs, _ := a.store.Since(0)
		w.Header().Set("Content-Disposition", `attachment; filename="roadtrip-games-backup-`+time.Now().Format("2006-01-02")+`.json"`)
		writeJSON(w, map[string]any{"version": appVersion, "events": evs})
	})
	return mux
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

// lanAddresses lists the addresses a tablet on the same Wi-Fi can use.
func lanAddresses(port int) []string {
	var out []string
	addrs, _ := net.InterfaceAddrs()
	for _, a := range addrs {
		ipn, ok := a.(*net.IPNet)
		if !ok || ipn.IP.IsLoopback() || ipn.IP.To4() == nil || ipn.IP.IsLinkLocalUnicast() {
			continue
		}
		out = append(out, "http://"+ipn.IP.String()+":"+strconv.Itoa(port)+"/")
	}
	return out
}
