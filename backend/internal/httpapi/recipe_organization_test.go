package httpapi

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

func TestOrganizationAPIPartialUpdate(t *testing.T) {
	h, db := newTestAPI(t)
	_, err := db.UpdateRecipeOrganization(t.Context(), "haehnchen-curry", store.RecipeOrganizationPatch{
		Course: store.Optional[string]{Set: true, Value: "Hauptgericht"},
		Tags:   store.Optional[[]string]{Set: true, Value: []string{"Schnell"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	rec := do(t, h, "PATCH", "/api/recipes/haehnchen-curry/organization", `{"rating":5}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	recipe := decode[map[string]any](t, rec)
	if recipe["rating"] != float64(5) || recipe["course"] != "Hauptgericht" || len(recipe["tags"].([]any)) != 1 {
		t.Errorf("teiländerung = %v", recipe)
	}
}

func TestOrganizationAPIRejectsInvalidCourse(t *testing.T) {
	h, _ := newTestAPI(t)
	rec := do(t, h, "PATCH", "/api/recipes/haehnchen-curry/organization", `{"course":"Brunch"}`)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	body := decode[validationBody](t, rec)
	if body.Field != "course" || body.Error == "" {
		t.Errorf("fehler = %+v", body)
	}
}

func TestTagAPIListsMergesAndDeletes(t *testing.T) {
	h, db := newTestAPI(t)
	for id, tags := range map[string][]string{
		"haehnchen-curry":    {"veggie"},
		"kichererbsen-curry": {"Vegetarisch"},
	} {
		if _, err := db.UpdateRecipeOrganization(t.Context(), id, store.RecipeOrganizationPatch{Tags: store.Optional[[]string]{Set: true, Value: tags}}); err != nil {
			t.Fatal(err)
		}
	}
	rec := do(t, h, "PATCH", "/api/tags/veggie", `{"name":"Vegetarisch"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("zusammenführen: %d %s", rec.Code, rec.Body.String())
	}
	tags := decode[[]store.TagSummary](t, rec)
	if len(tags) != 1 || tags[0].Name != "Vegetarisch" || tags[0].Count != 4 {
		t.Errorf("tags = %+v", tags)
	}
	rec = do(t, h, "DELETE", "/api/tags/"+url.PathEscape("Vegetarisch"), "")
	if rec.Code != http.StatusOK || len(decode[[]store.TagSummary](t, rec)) != 0 {
		t.Errorf("löschen: %d %s", rec.Code, rec.Body.String())
	}
}
