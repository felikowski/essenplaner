package web_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/felikowski/essenplaner/backend/internal/httpapi"
	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/web"
)

const indexHTML = `<!doctype html><div id="root"></div>`

var dist = fstest.MapFS{
	"index.html":          {Data: []byte(indexHTML)},
	"assets/index-abc.js": {Data: []byte("console.log(1)")},
	"mock/images/a.svg":   {Data: []byte("<svg/>")},
}

type emptyStore struct{}

func (emptyStore) ListRecipes(context.Context) ([]store.Recipe, error) { return []store.Recipe{}, nil }
func (emptyStore) GetRecipe(context.Context, string) (store.Recipe, error) {
	return store.Recipe{}, store.ErrNotFound
}
func (emptyStore) PlannedDays(context.Context, string, string) (map[string]string, error) {
	return map[string]string{}, nil
}
func (emptyStore) SetDay(context.Context, string, *string) error { return nil }
func (emptyStore) Ping(context.Context) error                    { return nil }

func app() http.Handler {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return httpapi.NewServer(emptyStore{}, emptyStore{}, emptyStore{}, logger).Handler(web.Handler(dist))
}

func get(h http.Handler, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
	return rec
}

func TestDeepLinksServeIndex(t *testing.T) {
	for _, path := range []string{"/", "/rezepte/abc", "/woche/2026-W40", "/index.html"} {
		rec := get(app(), path)
		if path == "/index.html" && rec.Code == http.StatusMovedPermanently {
			continue // net/http leitet /index.html auf / um
		}
		if rec.Code != http.StatusOK || rec.Body.String() != indexHTML {
			t.Errorf("%s: status %d, body %q", path, rec.Code, rec.Body.String())
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Errorf("%s: Content-Type %q", path, ct)
		}
	}
}

func TestStaticFiles(t *testing.T) {
	rec := get(app(), "/assets/index-abc.js")
	if rec.Code != http.StatusOK || rec.Body.String() != "console.log(1)" {
		t.Fatalf("status %d, body %q", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}
	if rec := get(app(), "/mock/images/a.svg"); rec.Code != http.StatusOK || rec.Body.String() != "<svg/>" {
		t.Errorf("mock-bild: status %d", rec.Code)
	}
}

func TestUnknownAPIPathIsJSON404(t *testing.T) {
	rec := get(app(), "/api/x")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q", ct)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"error":"not found"}` {
		t.Errorf("body = %s", got)
	}
}

func TestAPIStillReachable(t *testing.T) {
	if rec := get(app(), "/api/recipes"); rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("status %d, body %q", rec.Code, rec.Body.String())
	}
	if rec := get(app(), "/healthz"); rec.Code != http.StatusOK {
		t.Errorf("healthz: status %d", rec.Code)
	}
}

func TestMissingBuildGivesHint(t *testing.T) {
	rec := get(web.Handler(fstest.MapFS{}), "/")
	if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "make build") {
		t.Errorf("status %d, body %q", rec.Code, rec.Body.String())
	}
}

func TestOtherMethodsNotAllowed(t *testing.T) {
	rec := httptest.NewRecorder()
	app().ServeHTTP(rec, httptest.NewRequest("POST", "/rezepte", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d", rec.Code)
	}
}
