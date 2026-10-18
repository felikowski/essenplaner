package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestSessions(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	start := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)

	if err := db.CreateSession(ctx, "hash-1", Session{Subject: "auth0|anna", Name: "Anna", CreatedAt: start, LastSeenAt: start}); err != nil {
		t.Fatal(err)
	}
	s, err := db.GetSession(ctx, "hash-1", start.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if s.Subject != "auth0|anna" || s.Name != "Anna" || s.Email != "" || !s.LastSeenAt.Equal(start) {
		t.Errorf("sitzung = %+v", s)
	}
	if _, err := db.GetSession(ctx, "unbekannt", start); !errors.Is(err, ErrNotFound) {
		t.Errorf("unbekannte sitzung: %v", err)
	}

	// Nach 29 Tagen aktualisiert, dann sind weitere 29 Tage noch innerhalb der Frist.
	if err := db.TouchSession(ctx, "hash-1", start.Add(29*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.GetSession(ctx, "hash-1", start.Add(58*24*time.Hour)); err != nil {
		t.Errorf("aktive sitzung abgelaufen: %v", err)
	}

	if err := db.DeleteSession(ctx, "hash-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.GetSession(ctx, "hash-1", start); !errors.Is(err, ErrNotFound) {
		t.Errorf("gelöschte sitzung: %v", err)
	}
}

func TestSessionExpiresAfterInactivity(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t, tempPath(t))
	start := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	if err := db.CreateSession(ctx, "hash-1", Session{Subject: "auth0|anna", CreatedAt: start, LastSeenAt: start}); err != nil {
		t.Fatal(err)
	}

	if _, err := db.GetSession(ctx, "hash-1", start.Add(SessionMaxIdle)); err != nil {
		t.Errorf("genau 30 tage: noch gültig erwartet, %v", err)
	}
	if _, err := db.GetSession(ctx, "hash-1", start.Add(SessionMaxIdle+time.Second)); !errors.Is(err, ErrNotFound) {
		t.Errorf("nach 30 tagen: ErrNotFound erwartet, %v", err)
	}
	// Abgelaufene Sitzungen werden dabei gelöscht.
	if _, err := db.GetSession(ctx, "hash-1", start); !errors.Is(err, ErrNotFound) {
		t.Errorf("abgelaufene sitzung nicht gelöscht: %v", err)
	}
}
