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
	return NewServer(db, db, db, quietLogger()).Handler(nil), db
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
		"source": map[string]any{"kind": "pdf", "pdfUrl": "/mock/pdf/beispielrezept.pdf"},
	}
	gotJSON, _ := json.Marshal(pdf)
	wantJSON, _ := json.Marshal(want)
	if !bytes.Equal(gotJSON, wantJSON) {
		t.Errorf("pdf-rezept = %s\nerwartet    %s", gotJSON, wantJSON)
	}

	web := decode[map[string]any](t, do(t, h, "GET", "/api/recipes/haehnchen-curry", ""))
	if web["source"].(map[string]any)["url"] != "https://example.com/rezepte/haehnchen-curry" ||
		web["servings"] != "4 Portionen" || len(web["ingredients"].([]any)) != 8 || web["imageUrl"] == nil {
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

func TestGetWeekEmpty(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "GET", "/api/weeks/2026-W41", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	want := `{"week":"2026-W41","days":{"2026-10-05":null,"2026-10-06":null,"2026-10-07":null,"2026-10-08":null,"2026-10-09":null,"2026-10-10":null,"2026-10-11":null}}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Errorf("antwort = %s\nerwartet  %s", got, want)
	}
}

func TestGetWeekPlanned(t *testing.T) {
	h, db := newTestAPI(t)
	id := "linsensuppe"
	if err := db.SetDay(context.Background(), "2026-09-30", &id); err != nil {
		t.Fatal(err)
	}

	plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", ""))
	if plan.Week != "2026-W40" || len(plan.Days) != 7 {
		t.Fatalf("plan = %+v", plan)
	}
	if got := plan.Days["2026-09-30"]; got == nil || *got != "linsensuppe" {
		t.Errorf("30.09. = %v", got)
	}
	if plan.Days["2026-09-28"] != nil {
		t.Errorf("28.09. sollte leer sein")
	}
}

func TestGetWeekInvalid(t *testing.T) {
	h, _ := newTestAPI(t)
	for _, week := range []string{"2026-W60", "abc", "2025-W53", "2026-W00"} {
		t.Run(week, func(t *testing.T) {
			assertError(t, do(t, h, "GET", "/api/weeks/"+week, ""), http.StatusBadRequest)
		})
	}
}

func TestSetDayAssignAndRemove(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":"haehnchen-curry"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	plan := decode[weekPlan](t, rec)
	if plan.Week != "2026-W40" || len(plan.Days) != 7 || plan.Days["2026-09-30"] == nil || *plan.Days["2026-09-30"] != "haehnchen-curry" {
		t.Fatalf("plan nach Zuordnen = %s", rec.Body.String())
	}

	// Ersetzen
	plan = decode[weekPlan](t, do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":"linsensuppe"}`))
	if *plan.Days["2026-09-30"] != "linsensuppe" {
		t.Fatalf("plan nach Ersetzen = %+v", plan)
	}

	// Entfernen
	rec = do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":null}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if plan := decode[weekPlan](t, rec); plan.Days["2026-09-30"] != nil {
		t.Errorf("30.09. sollte leer sein: %s", rec.Body.String())
	}
	if plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", "")); plan.Days["2026-09-30"] != nil {
		t.Error("entfernen wurde nicht gespeichert")
	}
}

func TestSetDayReturnsWeekOfDateAcrossYearBoundary(t *testing.T) {
	h, _ := newTestAPI(t)

	plan := decode[weekPlan](t, do(t, h, "PUT", "/api/days/2027-01-03", `{"recipeId":"pfannkuchen"}`))
	if plan.Week != "2026-W53" || plan.Days["2027-01-03"] == nil {
		t.Errorf("plan = %+v", plan)
	}
}

func TestSetDayUnknownRecipe(t *testing.T) {
	h, _ := newTestAPI(t)
	do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":"linsensuppe"}`)

	assertError(t, do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":"gibt-es-nicht"}`), http.StatusUnprocessableEntity)

	plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", ""))
	if *plan.Days["2026-09-30"] != "linsensuppe" {
		t.Error("plan wurde verändert")
	}
}

func TestSetDayBadRequest(t *testing.T) {
	h, _ := newTestAPI(t)
	tests := []struct{ name, path, body string }{
		{"datum nicht im Format", "/api/days/30.09.2026", `{"recipeId":"linsensuppe"}`},
		{"datum gibt es nicht", "/api/days/2026-02-30", `{"recipeId":"linsensuppe"}`},
		{"kein JSON", "/api/days/2026-09-30", `recipeId=linsensuppe`},
		{"leerer body", "/api/days/2026-09-30", ``},
		{"recipeId fehlt", "/api/days/2026-09-30", `{}`},
		{"recipeId keine Zeichenkette", "/api/days/2026-09-30", `{"recipeId":42}`},
		{"recipeId leer", "/api/days/2026-09-30", `{"recipeId":""}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertError(t, do(t, h, "PUT", tt.path, tt.body), http.StatusBadRequest)
		})
	}

	plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", ""))
	for date, id := range plan.Days {
		if id != nil {
			t.Errorf("%s wurde trotz Fehler belegt", date)
		}
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

	db.Close()
	if rec := do(t, h, "GET", "/healthz", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status bei geschlossener Datenbank = %d, erwartet 503", rec.Code)
	}
}

type failingStore struct{}

func (failingStore) ListRecipes(context.Context) ([]store.Recipe, error) {
	return nil, errors.New("SQL logic error: no such table: recipes")
}
func (failingStore) GetRecipe(context.Context, string) (store.Recipe, error) {
	return store.Recipe{}, errors.New("disk I/O error")
}
func (failingStore) PlannedDays(context.Context, string, string) (map[string]string, error) {
	return nil, errors.New("database is locked")
}
func (failingStore) SetDay(context.Context, string, *string) error {
	return errors.New("database is locked")
}
func (failingStore) Ping(context.Context) error { return nil }

func TestDatabaseErrorsBecomeInternalError(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	h := NewServer(failingStore{}, failingStore{}, failingStore{}, logger).Handler(nil)

	for _, req := range []struct{ method, path, body string }{
		{"GET", "/api/recipes", ""},
		{"GET", "/api/recipes/x", ""},
		{"GET", "/api/weeks/2026-W40", ""},
		{"PUT", "/api/days/2026-09-30", `{"recipeId":"x"}`},
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
