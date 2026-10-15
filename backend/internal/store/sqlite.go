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

// DB implementiert die Datenzugriffe der Anwendung.
type DB struct {
	sql *sql.DB
}

var (
	_ RecipeStore   = (*DB)(nil)
	_ PlanStore     = (*DB)(nil)
	_ MenuStore     = (*DB)(nil)
	_ SettingsStore = (*DB)(nil)
	_ ShoppingStore = (*DB)(nil)
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

// goMigrations sind Schritte in Go, die für eine Version nach dem SQL in derselben Transaktion laufen,
// etwa um Daten umzuwandeln, was in SQL nicht vernünftig geht. Eine Version kann auch nur aus Go bestehen.
var goMigrations = map[int]func(ctx context.Context, tx *sql.Tx) error{
	3: migrateRecipeEditor,
	5: seedShoppingCategories,
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
	sqlFiles := map[int]string{}
	for _, file := range files {
		name := filepath.Base(file)
		version, err := strconv.Atoi(strings.SplitN(name, "_", 2)[0])
		if err != nil {
			return fmt.Errorf("migration %s: dateiname muss mit einer Nummer beginnen", name)
		}
		sqlFiles[version] = file
	}
	versions := make([]int, 0, len(sqlFiles)+len(goMigrations))
	for version := range sqlFiles {
		versions = append(versions, version)
	}
	for version := range goMigrations {
		if _, ok := sqlFiles[version]; !ok {
			versions = append(versions, version)
		}
	}
	sort.Ints(versions)

	for _, version := range versions {
		if err := db.applyMigration(ctx, version, sqlFiles[version], goMigrations[version]); err != nil {
			return fmt.Errorf("migration %d: %w", version, err)
		}
	}
	return nil
}

// applyMigration führt eine Version in einer Transaktion aus. Fremdschlüssel sind dabei abgeschaltet, damit
// Tabellen nach dem von SQLite empfohlenen Muster neu aufgebaut werden können; vor dem Commit prüft
// foreign_key_check, dass alle Verweise stimmen.
func (db *DB) applyMigration(ctx context.Context, version int, file string, step func(context.Context, *sql.Tx) error) error {
	conn, err := db.sql.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	var applied bool
	if err := conn.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = ?)", version).Scan(&applied); err != nil {
		return err
	}
	if applied {
		return nil
	}

	// PRAGMA foreign_keys wirkt nur außerhalb einer Transaktion.
	if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys = OFF"); err != nil {
		return err
	}
	defer conn.ExecContext(context.WithoutCancel(ctx), "PRAGMA foreign_keys = ON")

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if file != "" {
		script, err := migrations.ReadFile(file)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(script)); err != nil {
			return err
		}
	}
	if step != nil {
		if err := step(ctx, tx); err != nil {
			return err
		}
	}
	if err := checkForeignKeys(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
		return err
	}
	return tx.Commit()
}

func checkForeignKeys(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, "PRAGMA foreign_key_check")
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		var table, parent string
		var rowid sql.NullInt64
		var fkid int
		if err := rows.Scan(&table, &rowid, &parent, &fkid); err != nil {
			return err
		}
		return fmt.Errorf("verletzter fremdschlüssel: %s (zeile %d) verweist auf fehlenden eintrag in %s", table, rowid.Int64, parent)
	}
	return rows.Err()
}
