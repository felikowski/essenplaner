package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/seed"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// newTestAPI startet die API gegen eine frische SQLite-Datei mit den Beispielrezepten.
func newTestAPI(t *testing.T) (http.Handler, *store.DB) {
	t.Helper()
	ctx := context.Background()
	db, err := store.Open(ctx, filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := seed.Run(ctx, db); err != nil {
		t.Fatal(err)
	}
	return NewServer(StoresFrom(db), quietLogger()).Handler(nil), db
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("antwort ist kein gültiges JSON: %v\n%s", err, rec.Body.String())
	}
	return v
}

func assertError(t *testing.T, rec *httptest.ResponseRecorder, status int) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status = %d, erwartet %d (%s)", rec.Code, status, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q", ct)
	}
	body := decode[map[string]any](t, rec)
	if msg, ok := body["error"].(string); !ok || msg == "" || len(body) != 1 {
		t.Errorf("fehlerobjekt hat nicht die Form {\"error\": ...}: %s", rec.Body.String())
	}
}

func TestListRecipes(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "GET", "/api/recipes", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	recipes := decode[[]map[string]any](t, rec)
	if len(recipes) != 8 {
		t.Fatalf("%d rezepte, erwartet 8", len(recipes))
	}
	var titles []string
	for _, r := range recipes {
		titles = append(titles, r["title"].(string))
	}
	if titles[0] != "Gemüselasagne" || titles[1] != "Hähnchen-Curry" || titles[7] != "Spaghetti Bolognese" {
		t.Errorf("nicht nach Titel sortiert: %v", titles)
	}
}

func TestRecipeJSONOmitsMissingFields(t *testing.T) {
	h, _ := newTestAPI(t)

	pdf := decode[map[string]any](t, do(t, h, "GET", "/api/recipes/gemueselasagne", ""))
	want := map[string]any{
		"id": "gemueselasagne", "title": "Gemüselasagne",
		"source":    map[string]any{"kind": "pdf", "pdfUrl": "/mock/pdf/beispielrezept.pdf"},
		"available": true,
		"createdAt": pdf["createdAt"],
	}
	gotJSON, _ := json.Marshal(pdf)
	wantJSON, _ := json.Marshal(want)
	if !bytes.Equal(gotJSON, wantJSON) {
		t.Errorf("pdf-rezept = %s\nerwartet    %s", gotJSON, wantJSON)
	}

	web := decode[map[string]any](t, do(t, h, "GET", "/api/recipes/haehnchen-curry", ""))
	if web["source"].(map[string]any)["url"] != "https://example.com/rezepte/haehnchen-curry" ||
		web["servings"] != float64(4) || len(web["ingredients"].([]any)) != 8 || web["imageUrl"] == nil {
		t.Errorf("web-rezept unvollständig: %v", web)
	}
	if _, ok := web["source"].(map[string]any)["pdfUrl"]; ok {
		t.Error("web-rezept enthält pdfUrl")
	}
}

func TestGetRecipeNotFound(t *testing.T) {
	h, _ := newTestAPI(t)
	assertError(t, do(t, h, "GET", "/api/recipes/does-not-exist", ""), http.StatusNotFound)
}

func TestGetWeekInvalid(t *testing.T) {
	h, _ := newTestAPI(t)
	for _, week := range []string{"2026-W60", "abc", "2025-W53", "2026-W00"} {
		t.Run(week, func(t *testing.T) {
			assertError(t, do(t, h, "GET", "/api/weeks/"+week, ""), http.StatusBadRequest)
		})
	}
}

func TestUnknownAPIPath(t *testing.T) {
	h, _ := newTestAPI(t)
	for _, path := range []string{"/api/gibtsnicht", "/api/", "/api/recipes/a/b"} {
		rec := do(t, h, "GET", path, "")
		assertError(t, rec, http.StatusNotFound)
		if got := strings.TrimSpace(rec.Body.String()); got != `{"error":"not found"}` {
			t.Errorf("%s: %s", path, got)
		}
	}
}

func TestHealthz(t *testing.T) {
	h, db := newTestAPI(t)

	rec := do(t, h, "GET", "/healthz", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"status":"ok","version":"dev"}` {
		t.Errorf("body = %s", got)
	}

	db.Close()
	if rec := do(t, h, "GET", "/healthz", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status bei geschlossener Datenbank = %d, erwartet 503", rec.Code)
	}
}

func TestHealthzReportsVersion(t *testing.T) {
	_, db := newTestAPI(t)
	h := NewServer(StoresFrom(db), quietLogger()).WithVersion("abc123").Handler(nil)

	rec := do(t, h, "GET", "/healthz", "")
	if got := strings.TrimSpace(rec.Body.String()); got != `{"status":"ok","version":"abc123"}` {
		t.Errorf("body = %s", got)
	}
}

// failingStore meldet bei jedem Zugriff einen Datenbankfehler. Die eingebetteten Interfaces sind nil:
// Methoden, die der Test nicht aufruft, braucht er nicht.
type failingStore struct {
	store.RecipeStore
	store.PlanStore
	store.SettingsStore
}

var errDisk = errors.New("SQL logic error: no such table: recipes")

func (failingStore) ListRecipes(context.Context) ([]store.Recipe, error) { return nil, errDisk }
func (failingStore) GetRecipe(context.Context, string) (store.Recipe, error) {
	return store.Recipe{}, errDisk
}
func (failingStore) RemoveRecipe(context.Context, string) error { return errDisk }
func (failingStore) Entries(context.Context, string, string) (map[string][]store.Entry, error) {
	return nil, errDisk
}
func (failingStore) CreateEntry(context.Context, store.EntryInput) (store.Entry, error) {
	return store.Entry{}, errDisk
}
func (failingStore) Settings(context.Context) (map[string]any, error) { return nil, errDisk }
func (failingStore) Ping(context.Context) error                       { return nil }

func TestDatabaseErrorsBecomeInternalError(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	db := failingStore{}
	h := NewServer(Stores{Recipes: db, Plans: db, Settings: db, Health: db}, logger).Handler(nil)

	for _, req := range []struct{ method, path, body string }{
		{"GET", "/api/recipes", ""},
		{"GET", "/api/recipes/x", ""},
		{"GET", "/api/weeks/2026-W40", ""},
		{"POST", "/api/entries", `{"date":"2026-09-30","meal":"dinner","kind":"recipe","recipeId":"x"}`},
		{"DELETE", "/api/recipes/x", ""},
		{"GET", "/api/settings", ""},
	} {
		rec := do(t, h, req.method, req.path, req.body)
		assertError(t, rec, http.StatusInternalServerError)
		if got := strings.TrimSpace(rec.Body.String()); got != `{"error":"internal error"}` {
			t.Errorf("%s %s: %s", req.method, req.path, got)
		}
	}
	if !strings.Contains(logs.String(), "no such table") {
		t.Error("fehler wurde nicht serverseitig protokolliert")
	}
}

func TestRecoverTurnsPanicIntoInternalError(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	h := Recover(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("geheimes Detail")
	}))

	rec := do(t, h, "GET", "/api/recipes", "")
	assertError(t, rec, http.StatusInternalServerError)
	if got := strings.TrimSpace(rec.Body.String()); got != `{"error":"internal error"}` {
		t.Errorf("antwort = %s", got)
	}
	if !strings.Contains(logs.String(), "geheimes Detail") {
		t.Error("panic wurde nicht protokolliert")
	}
}
