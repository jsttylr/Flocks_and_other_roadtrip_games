package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"syscall"
	"time"
)

var appVersion = "0.1.0"

func main() {
	dir := flag.String("data", dataDir(), "folder for the game history")
	port := flag.Int("port", envInt("ROADTRIP_PORT", 8070), "web page port")
	noBrowser := flag.Bool("no-browser", false, "don't open the page in a browser on start")
	flag.Parse()

	url := fmt.Sprintf("http://127.0.0.1:%d/", *port)
	setupLogFile(filepath.Join(*dir, "roadtrip-games.log"))

	store, err := OpenStore(filepath.Join(*dir, "events.jsonl"))
	if err != nil {
		fatal("Roadtrip Games can't open its history file in %s:\n%v", *dir, err)
	}
	log.Printf("Roadtrip Games %s, %d events, data in %s", appVersion, store.Count(), *dir)

	// Listen on every address so tablets on the home Wi-Fi can reach it.
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		// Probably already running: just show the page.
		if !*noBrowser {
			openBrowser(url)
			return
		}
		fatal("Roadtrip Games can't open its web page on port %d:\n%v", *port, err)
	}
	app := &App{store: store, port: *port}
	srv := &http.Server{Handler: app.handler(), ReadHeaderTimeout: 10 * time.Second}
	go srv.Serve(ln)

	fmt.Printf("\nRoadtrip Games: %s\n", url)
	for _, a := range lanAddresses(*port) {
		fmt.Printf("On the tablet:  %s\n", a)
	}
	fmt.Printf("Leave this running. Press Ctrl+C to stop.\n\n")
	if !*noBrowser {
		openBrowser(url)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	log.Print("stopping")
	srv.Close()
	store.Close()
}

// dataDir is ROADTRIP_DATA if set, otherwise a "data" folder next to the program.
func dataDir() string {
	if d := os.Getenv("ROADTRIP_DATA"); d != "" {
		return d
	}
	exe, err := os.Executable()
	if err != nil {
		return "data"
	}
	return filepath.Join(filepath.Dir(exe), "data")
}

func envInt(name string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(name)); err == nil {
		return n
	}
	return def
}

// setupLogFile keeps a log next to the data, since the Windows build has no console window.
func setupLogFile(path string) {
	os.MkdirAll(filepath.Dir(path), 0o755)
	os.Rename(path, path+".old")
	f, err := os.Create(path)
	if err != nil {
		return
	}
	log.SetOutput(io.MultiWriter(f, quietWriter{os.Stderr}))
}

// quietWriter ignores errors so a missing console never stops file logging.
type quietWriter struct{ w io.Writer }

func (q quietWriter) Write(p []byte) (int, error) { q.w.Write(p); return len(p), nil }

func fatal(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	log.Print(msg)
	showError(msg)
	os.Exit(1)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
