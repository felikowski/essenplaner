package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/auth"
	"github.com/felikowski/essenplaner/backend/internal/config"
)

func protectedHandler(t *testing.T) http.Handler {
	t.Helper()
	_, db := newTestAPI(t)
	cfg := config.Auth{Domain: "auth.example", ClientID: "id", ClientSecret: "secret", PublicURL: "https://essenplaner.example", AllowedSubjects: []string{"auth0|anna"}}
	service := auth.New(cfg, db, slog.New(slog.NewTextHandler(io.Discard, nil)), auth.Options{})
	static := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		io.WriteString(w, "<!doctype html>")
	})
	return NewServer(StoresFrom(db), quietLogger()).WithAuth(service, true).Handler(static)
}

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// Jede Route aus den früheren Changes muss ohne Sitzung 401 liefern, auch wenn später neue dazukommen.
func TestEveryAPIRouteRequiresSession(t *testing.T) {
	h := protectedHandler(t)
	routes := NewServer(Stores{}, quietLogger()).APIRoutes()
	checked := 0
	for _, pattern := range routes {
		method, path, ok := strings.Cut(pattern, " ")
		if !ok || !strings.HasPrefix(path, "/api/") {
			continue // /healthz und Muster ohne Methode
		}
		req := httptest.NewRequest(method, pathParam.ReplaceAllString(path, "x"), strings.NewReader("{}"))
		req.Header.Set("Origin", "https://essenplaner.example")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s ohne sitzung: status %d", pattern, rec.Code)
		}
		checked++
	}
	if checked < 30 {
		t.Fatalf("nur %d routen geprüft, die liste ist vermutlich unvollständig: %v", checked, routes)
	}

	for _, path := range []string{"/api/me", "/api/gibtsnicht"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: status %d", path, rec.Code)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("/healthz: status %d", rec.Code)
	}
}

func TestSecurityHeaders(t *testing.T) {
	h := protectedHandler(t)
	for _, path := range []string{"/woche/2026-W40", "/api/recipes"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		headers := rec.Header()
		want := map[string]string{
			"Content-Security-Policy":   "default-src 'self'; img-src 'self' https: data:",
			"X-Content-Type-Options":    "nosniff",
			"Referrer-Policy":           "strict-origin-when-cross-origin",
			"Strict-Transport-Security": "max-age=31536000",
		}
		for name, value := range want {
			if got := headers.Get(name); got != value {
				t.Errorf("%s: %s = %q, erwartet %q", path, name, got, value)
			}
		}
	}

	// Ohne https (lokale Entwicklung) kein HSTS.
	_, db := newTestAPI(t)
	rec := httptest.NewRecorder()
	NewServer(StoresFrom(db), quietLogger()).Handler(nil).ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Header().Get("Strict-Transport-Security") != "" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("ohne https: %v", rec.Header())
	}
}
