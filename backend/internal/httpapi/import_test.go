package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/safefetch"
	"github.com/felikowski/essenplaner/backend/internal/webimport"
)

// fakeImporter liefert feste Ergebnisse je Adresse und zählt die Abrufe.
type fakeImporter struct {
	results map[string]*webimport.Result
	errs    map[string]error
	calls   int
}

func (f *fakeImporter) Import(_ context.Context, u *url.URL) (*webimport.Result, error) {
	f.calls++
	if err, ok := f.errs[u.String()]; ok {
		return nil, err
	}
	if result, ok := f.results[u.String()]; ok {
		return result, nil
	}
	return nil, fmt.Errorf("%w: status 404", safefetch.ErrFetch)
}

func newImportAPI(t *testing.T) (http.Handler, *fakeImporter) {
	t.Helper()
	_, db := newTestAPI(t)
	importer := &fakeImporter{
		results: map[string]*webimport.Result{
			"https://www.chefkoch.de/rezepte/1/kuerbis.html": {
				CanonicalURL: "https://www.chefkoch.de/rezepte/1/kuerbis.html",
				Recipe: webimport.Recipe{
					Title: "Kürbissuppe", ImageURL: "https://img.example.com/k.jpg", Yield: "4 Portionen",
					Ingredients: []string{"1 kg Kürbis", "1 Zwiebel"}, Instructions: []string{"Schneiden.", "Kochen."},
				},
			},
		},
		errs: map[string]error{
			"https://example.com/startseite": webimport.ErrNoRecipe,
			"https://example.com/riesig":     safefetch.ErrTooLarge,
			"https://example.com/intern":     fmt.Errorf("%w: 10.0.0.5", safefetch.ErrBlocked),
		},
	}
	return NewServer(db, db, db, quietLogger()).WithImporter(importer).Handler(nil), importer
}

func TestImportRecipe(t *testing.T) {
	h, importer := newImportAPI(t)

	rec := do(t, h, "POST", "/api/recipes/import", `{"url":"https://www.chefkoch.de/rezepte/1/kuerbis.html"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	recipe := decode[map[string]any](t, rec)
	if recipe["title"] != "Kürbissuppe" || recipe["servings"] != "4 Portionen" || recipe["imageUrl"] != "https://img.example.com/k.jpg" ||
		len(recipe["ingredients"].([]any)) != 2 || len(recipe["instructions"].([]any)) != 2 || recipe["removable"] != true {
		t.Errorf("rezept = %v", recipe)
	}
	if src := recipe["source"].(map[string]any); src["kind"] != "web" || src["url"] != "https://www.chefkoch.de/rezepte/1/kuerbis.html" {
		t.Errorf("quelle = %v", src)
	}

	// Das Rezept steht im Katalog.
	found := false
	for _, r := range decode[[]map[string]any](t, do(t, h, "GET", "/api/recipes", "")) {
		found = found || r["id"] == recipe["id"]
	}
	if !found {
		t.Error("importiertes rezept fehlt in der liste")
	}

	// Duplikat mit Tracking-Parametern: 200, kein neuer Abruf, dasselbe Rezept.
	rec = do(t, h, "POST", "/api/recipes/import", `{"url":"https://www.chefkoch.de/rezepte/1/kuerbis.html?utm_source=whatsapp#bilder"}`)
	if rec.Code != http.StatusOK || decode[map[string]any](t, rec)["id"] != recipe["id"] {
		t.Errorf("duplikat: %d %s", rec.Code, rec.Body.String())
	}
	if importer.calls != 1 {
		t.Errorf("seite wurde %d-mal abgerufen, erwartet 1", importer.calls)
	}
}

func TestImportRecipeErrors(t *testing.T) {
	h, _ := newImportAPI(t)
	tests := []struct {
		body   string
		status int
	}{
		{`{"url":"https://example.com/startseite"}`, http.StatusUnprocessableEntity},
		{`{"url":"https://example.com/riesig"}`, http.StatusBadGateway},
		{`{"url":"https://example.com/nicht-da"}`, http.StatusBadGateway},
		{`{"url":"https://example.com/intern"}`, http.StatusBadRequest},
		{`{"url":"http://127.0.0.1:8080/api/recipes"}`, http.StatusBadRequest},
		{`{"url":"http://169.254.169.254/"}`, http.StatusBadRequest},
		{`{"url":"ftp://example.com/x"}`, http.StatusBadRequest},
		{`{"url":"kein link"}`, http.StatusBadRequest},
		{`{"url":""}`, http.StatusBadRequest},
		{`kein json`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		assertError(t, do(t, h, "POST", "/api/recipes/import", tt.body), tt.status)
	}
	if n := len(decode[[]map[string]any](t, do(t, h, "GET", "/api/recipes", ""))); n != 8 {
		t.Errorf("nach fehlern %d rezepte, erwartet 8", n)
	}
}

func TestRemoveImportedRecipe(t *testing.T) {
	h, importer := newImportAPI(t)
	recipe := decode[map[string]any](t, do(t, h, "POST", "/api/recipes/import", `{"url":"https://www.chefkoch.de/rezepte/1/kuerbis.html"}`))
	id := recipe["id"].(string)
	do(t, h, "PUT", "/api/days/2026-09-30", fmt.Sprintf(`{"recipeId":%q}`, id))

	if rec := do(t, h, "DELETE", "/api/recipes/"+id, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("entfernen: %d %s", rec.Code, rec.Body.String())
	}

	for _, r := range decode[[]map[string]any](t, do(t, h, "GET", "/api/recipes", "")) {
		if r["id"] == id {
			t.Error("entferntes rezept steht noch in der liste")
		}
	}
	detail := decode[map[string]any](t, do(t, h, "GET", "/api/recipes/"+id, ""))
	if detail["available"] != false || detail["removable"] != nil {
		t.Errorf("detail nach entfernen: %v", detail)
	}
	plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", ""))
	if plan.Days["2026-09-30"] == nil || *plan.Days["2026-09-30"] != id {
		t.Error("plan hat das entfernte rezept verloren")
	}
	assertError(t, do(t, h, "PUT", "/api/days/2026-10-01", fmt.Sprintf(`{"recipeId":%q}`, id)), http.StatusUnprocessableEntity)

	// Erneuter Import macht das Rezept wieder verfügbar, ohne die Seite neu abzurufen.
	rec := do(t, h, "POST", "/api/recipes/import", `{"url":"https://www.chefkoch.de/rezepte/1/kuerbis.html"}`)
	again := decode[map[string]any](t, rec)
	if rec.Code != http.StatusOK || again["id"] != id || again["available"] != true {
		t.Errorf("reaktivierung: %d %v", rec.Code, again)
	}
	if importer.calls != 1 {
		t.Errorf("seite wurde %d-mal abgerufen, erwartet 1", importer.calls)
	}
}

func TestRemoveRecipeErrors(t *testing.T) {
	h, _ := newImportAPI(t)
	assertError(t, do(t, h, "DELETE", "/api/recipes/gemueselasagne", ""), http.StatusConflict)
	assertError(t, do(t, h, "DELETE", "/api/recipes/gibt-es-nicht", ""), http.StatusNotFound)
}
