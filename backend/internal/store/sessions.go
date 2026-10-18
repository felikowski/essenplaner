package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// SessionMaxIdle: Nach so langer Inaktivität läuft eine Sitzung ab.
const SessionMaxIdle = 30 * 24 * time.Hour

// Session ist eine Anmeldung. Name, E-Mail und Bild liefert Auth0 nicht für jedes Konto.
type Session struct {
	Subject    string
	Name       string
	Email      string
	Picture    string
	CreatedAt  time.Time
	LastSeenAt time.Time
}

type SessionStore interface {
	CreateSession(ctx context.Context, idHash string, s Session) error
	// GetSession liefert ErrNotFound für unbekannte und abgelaufene Sitzungen (gemessen an now).
	GetSession(ctx context.Context, idHash string, now time.Time) (Session, error)
	TouchSession(ctx context.Context, idHash string, now time.Time) error
	DeleteSession(ctx context.Context, idHash string) error
}

var _ SessionStore = (*DB)(nil)

const sessionTimeLayout = "2006-01-02T15:04:05.000Z"

func formatSessionTime(t time.Time) string { return t.UTC().Format(sessionTimeLayout) }

func (db *DB) CreateSession(ctx context.Context, idHash string, s Session) error {
	_, err := db.sql.ExecContext(ctx,
		`INSERT INTO sessions (id_hash, subject, name, email, picture, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		idHash, s.Subject, s.Name, s.Email, s.Picture, formatSessionTime(s.CreatedAt), formatSessionTime(s.LastSeenAt))
	if err != nil {
		return fmt.Errorf("sitzung anlegen: %w", err)
	}
	return nil
}

func (db *DB) GetSession(ctx context.Context, idHash string, now time.Time) (Session, error) {
	var s Session
	var created, lastSeen string
	err := db.sql.QueryRowContext(ctx,
		`SELECT subject, name, email, picture, created_at, last_seen_at FROM sessions WHERE id_hash = ?`, idHash).
		Scan(&s.Subject, &s.Name, &s.Email, &s.Picture, &created, &lastSeen)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, fmt.Errorf("sitzung lesen: %w", err)
	}
	if s.CreatedAt, err = time.Parse(sessionTimeLayout, created); err != nil {
		return Session{}, fmt.Errorf("sitzung lesen: %w", err)
	}
	if s.LastSeenAt, err = time.Parse(sessionTimeLayout, lastSeen); err != nil {
		return Session{}, fmt.Errorf("sitzung lesen: %w", err)
	}
	if now.Sub(s.LastSeenAt) > SessionMaxIdle {
		if err := db.DeleteSession(ctx, idHash); err != nil {
			return Session{}, err
		}
		return Session{}, ErrNotFound
	}
	return s, nil
}

func (db *DB) TouchSession(ctx context.Context, idHash string, now time.Time) error {
	if _, err := db.sql.ExecContext(ctx, `UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?`, formatSessionTime(now), idHash); err != nil {
		return fmt.Errorf("sitzung aktualisieren: %w", err)
	}
	return nil
}

func (db *DB) DeleteSession(ctx context.Context, idHash string) error {
	if _, err := db.sql.ExecContext(ctx, `DELETE FROM sessions WHERE id_hash = ?`, idHash); err != nil {
		return fmt.Errorf("sitzung löschen: %w", err)
	}
	return nil
}
