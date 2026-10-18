package main

import (
	"os"
	"strings"
	"testing"
)

// The page compares its own version with the server's to know when the iPad's
// saved copy is out of date, so the two must be bumped together.
func TestPageVersionMatches(t *testing.T) {
	b, err := os.ReadFile("web/games.js")
	if err != nil {
		t.Fatal(err)
	}
	if want := "const PAGE_VERSION = '" + appVersion + "';"; !strings.Contains(string(b), want) {
		t.Fatalf("web/games.js should contain %q", want)
	}
}
