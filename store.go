package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sync"
)

// Event is one thing that happened in a game: a cow counted, a plate spotted,
// a trip started. The tablet makes them (with its own id, so sending one twice
// is harmless) and the server keeps every one, in order, forever. All scores,
// stats and awards are worked out from this list, so nothing is ever lost and
// a mistake is fixed by adding an "undo" event rather than deleting anything.
type Event struct {
	Seq  int64           `json:"seq"`
	ID   string          `json:"id"`
	Type string          `json:"type"`
	TS   int64           `json:"ts"` // milliseconds since 1970, from the tablet's clock
	Data json.RawMessage `json:"data,omitempty"`
}

var (
	idPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	typePattern = regexp.MustCompile(`^[a-z][a-z0-9_.]{0,39}$`)
)

const maxEventData = 4096

func (e *Event) validate() error {
	switch {
	case !idPattern.MatchString(e.ID):
		return fmt.Errorf("bad event id %q", e.ID)
	case !typePattern.MatchString(e.Type):
		return fmt.Errorf("bad event type %q", e.Type)
	case len(e.Data) > maxEventData:
		return fmt.Errorf("event %s is too big", e.ID)
	case len(e.Data) > 0 && !json.Valid(e.Data):
		return fmt.Errorf("event %s has bad data", e.ID)
	}
	return nil
}

// Store is the database: one line of JSON per event in a plain text file.
// It is easy to back up (copy the file) and easy to read if ever needed.
type Store struct {
	mu     sync.Mutex
	path   string
	f      *os.File
	events []Event
	ids    map[string]bool
}

func OpenStore(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	s := &Store{path: path, ids: map[string]bool{}}
	if b, err := os.ReadFile(path); err == nil {
		sc := bufio.NewScanner(bytes.NewReader(b))
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for n := 1; sc.Scan(); n++ {
			line := bytes.TrimSpace(sc.Bytes())
			if len(line) == 0 {
				continue
			}
			var e Event
			if err := json.Unmarshal(line, &e); err != nil || e.validate() != nil {
				// Most likely the last line, cut short by a power cut. Skip it.
				log.Printf("skipping unreadable line %d in %s", n, path)
				continue
			}
			if s.ids[e.ID] {
				continue
			}
			e.Seq = int64(len(s.events) + 1)
			s.events = append(s.events, e)
			s.ids[e.ID] = true
		}
		if err := sc.Err(); err != nil {
			return nil, err
		}
		// Make sure a half-written last line doesn't swallow the next event.
		if len(b) > 0 && b[len(b)-1] != '\n' {
			b = append(b, '\n')
			if err := os.WriteFile(path, b, 0o644); err != nil {
				return nil, err
			}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	s.f = f
	return s, nil
}

// Add saves the events it hasn't seen before and returns how many were new.
// Bad events are refused before anything is written.
func (s *Store) Add(evs []Event) (int, error) {
	for i := range evs {
		if err := evs[i].validate(); err != nil {
			return 0, err
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var buf bytes.Buffer
	var fresh []Event
	seen := map[string]bool{}
	for _, e := range evs {
		if s.ids[e.ID] || seen[e.ID] {
			continue
		}
		seen[e.ID] = true
		e.Seq = int64(len(s.events) + len(fresh) + 1)
		line, _ := json.Marshal(e)
		buf.Write(line)
		buf.WriteByte('\n')
		fresh = append(fresh, e)
	}
	if len(fresh) == 0 {
		return 0, nil
	}
	if _, err := s.f.Write(buf.Bytes()); err != nil {
		return 0, err
	}
	if err := s.f.Sync(); err != nil {
		return 0, err
	}
	for _, e := range fresh {
		s.events = append(s.events, e)
		s.ids[e.ID] = true
	}
	return len(fresh), nil
}

// Since returns the events after sequence number seq, and the newest number.
func (s *Store) Since(seq int64) ([]Event, int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	last := int64(len(s.events))
	if seq < 0 || seq > last {
		seq = 0
	}
	out := make([]Event, last-seq)
	copy(out, s.events[seq:])
	return out, last
}

func (s *Store) Count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.events)
}

func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.f.Close()
}
