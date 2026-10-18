package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func ev(id, typ string) Event {
	return Event{ID: id, Type: typ, TS: 1, Data: json.RawMessage(`{"a":1}`)}
}

func TestStoreKeepsEventsOnceAndInOrder(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	s, err := OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if n, _ := s.Add([]Event{ev("a", "flock.add"), ev("b", "flock.add"), ev("a", "flock.add")}); n != 2 {
		t.Fatalf("added %d, want 2", n)
	}
	if n, _ := s.Add([]Event{ev("b", "flock.add"), ev("c", "plate.spot")}); n != 1 {
		t.Fatalf("added %d, want 1", n)
	}
	if _, err := s.Add([]Event{ev("d", "ok"), ev("bad id!", "x")}); err == nil {
		t.Fatal("bad event accepted")
	}
	s.Close()

	// A power cut leaves half a line at the end.
	f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	f.WriteString(`{"id":"half","ty`)
	f.Close()

	s, err = OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Add([]Event{ev("e", "trip.end")}); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, _ = OpenStore(path)
	evs, last := s.Since(0)
	if last != 4 || len(evs) != 4 {
		t.Fatalf("got %d events, last %d", len(evs), last)
	}
	for i, want := range []string{"a", "b", "c", "e"} {
		if evs[i].ID != want || evs[i].Seq != int64(i+1) {
			t.Errorf("event %d = %s seq %d", i, evs[i].ID, evs[i].Seq)
		}
	}
	if evs, _ := s.Since(2); len(evs) != 2 || evs[0].ID != "c" {
		t.Errorf("since 2 = %+v", evs)
	}
	if evs, _ := s.Since(99); len(evs) != 4 {
		t.Errorf("since past the end should start over, got %d", len(evs))
	}
}

func TestAPISync(t *testing.T) {
	s, _ := OpenStore(filepath.Join(t.TempDir(), "events.jsonl"))
	defer s.Close()
	srv := httptest.NewServer((&App{store: s, port: 8070}).handler())
	defer srv.Close()

	body, _ := json.Marshal(map[string]any{"events": []Event{ev("x1", "player.add"), ev("x2", "trip.start")}})
	resp, err := http.Post(srv.URL+"/api/events", "application/json", bytes.NewReader(body))
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("post: %v %v", err, resp.Status)
	}
	resp, _ = http.Get(srv.URL + "/api/events?since=1")
	var got struct {
		Events []Event
		Seq    int64
	}
	json.NewDecoder(resp.Body).Decode(&got)
	if got.Seq != 2 || len(got.Events) != 1 || got.Events[0].ID != "x2" {
		t.Fatalf("got %+v", got)
	}
	resp, _ = http.Get(srv.URL + "/")
	if resp.StatusCode != 200 {
		t.Fatalf("page: %s", resp.Status)
	}
}
