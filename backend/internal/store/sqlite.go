// Package store speichert Rezepte und Wochenpläne in SQLite.
package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

// DB implementiert RecipeStore und PlanStore.
type DB struct {
	sql *sql.DB
}

var (
	_ RecipeStore = (*DB)(nil)
	_ PlanStore   = (*DB)(nil)
)

// Open öffnet (oder erstellt) die Datenbankdatei und bringt das Schema auf den neuesten Stand.
func Open(ctx context.Context, path string) (*DB, error) {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("datenbankverzeichnis anlegen: %w", err)
		}
	}

	params := url.Values{}
	params.Add("_pragma", "journal_mode(WAL)")
	params.Add("_pragma", "busy_timeout(5000)")
	params.Add("_pragma", "foreign_keys(1)")
	params.Add("_pragma", "synchronous(NORMAL)")
	// Schreibende Transaktionen sofort sperren, damit sie nicht erst beim ersten Schreiben kollidieren.
	params.Set("_txlock", "immediate")

	sqlDB, err := sql.Open("sqlite", "file:"+path+"?"+params.Encode())
	if err != nil {
		return nil, fmt.Errorf("datenbank öffnen: %w", err)
	}
	db := &DB{sql: sqlDB}
	if err := db.migrate(ctx); err != nil {
		sqlDB.Close()
		return nil, err
	}
	return db, nil
}

func (db *DB) Close() error {
	return db.sql.Close()
}

// Ping prüft, ob die Datenbank Anfragen beantwortet.
func (db *DB) Ping(ctx context.Context) error {
	var one int
	return db.sql.QueryRowContext(ctx, "SELECT 1").Scan(&one)
}

func (db *DB) migrate(ctx context.Context) error {
	if _, err := db.sql.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version    INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	)`); err != nil {
		return fmt.Errorf("schema_migrations anlegen: %w", err)
	}

	files, err := fs.Glob(migrations, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)

	for _, file := range files {
		name := filepath.Base(file)
		version, err := strconv.Atoi(strings.SplitN(name, "_", 2)[0])
		if err != nil {
			return fmt.Errorf("migration %s: dateiname muss mit einer Nummer beginnen", name)
		}
		if err := db.applyMigration(ctx, version, file); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

func (db *DB) applyMigration(ctx context.Context, version int, file string) error {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var applied bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = ?)", version).Scan(&applied); err != nil {
		return err
	}
	if applied {
		return nil
	}

	script, err := migrations.ReadFile(file)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, string(script)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
		return err
	}
	return tx.Commit()
}
