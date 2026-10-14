package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestCreateRecipe(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "POST", "/api/recipes",
		`{"title":"  Omas Gulasch ","servings":4,"ingredients":["1 kg Rindergulasch","","3 Zwiebeln, gewürfelt"],"instructions":["Anbraten.","  ","Schmoren."]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	recipe := decode[map[string]any](t, rec)
	id := recipe["id"].(string)
	if !strings.HasPrefix(id, "m-") || recipe["title"] != "Omas Gulasch" || recipe["servings"] != float64(4) ||
		recipe["removable"] != true || recipe["titleEditable"] != true {
		t.Errorf("rezept = %v", recipe)
	}
	if src := recipe["source"].(map[string]any); src["kind"] != "manual" || len(src) != 1 {
		t.Errorf("quelle = %v", src)
	}
	ingredients := recipe["ingredients"].([]any)
	want := map[string]any{"text": "3 Zwiebeln, gewürfelt", "quantity": float64(3), "name": "Zwiebeln", "note": "gewürfelt"}
	if len(ingredients) != 2 || fmt.Sprint(ingredients[1]) != fmt.Sprint(want) {
		t.Errorf("zutaten = %v", ingredients)
	}
	if steps := recipe["instructions"].([]any); len(steps) != 2 {
		t.Errorf("schritte = %v", steps)
	}

	// Das Rezept lässt sich einplanen und steht im Katalog.
	if rec := do(t, h, "PUT", "/api/days/2026-09-30", fmt.Sprintf(`{"recipeId":%q}`, id)); rec.Code != http.StatusOK {
		t.Errorf("einplanen: %d", rec.Code)
	}
	if n := len(decode[[]map[string]any](t, do(t, h, "GET", "/api/recipes", ""))); n != 9 {
		t.Errorf("%d rezepte, erwartet 9", n)
	}
}

func TestCreateRecipeOnlyTitle(t *testing.T) {
	h, _ := newTestAPI(t)
	recipe := decode[map[string]any](t, do(t, h, "POST", "/api/recipes", `{"title":"Brotzeit"}`))
	for _, field := range []string{"servings", "ingredients", "instructions", "imageUrl"} {
		if _, ok := recipe[field]; ok {
			t.Errorf("%s sollte fehlen: %v", field, recipe)
		}
	}
}

func TestRecipeValidation(t *testing.T) {
	h, _ := newTestAPI(t)
	many := func(n int, line string) string {
		lines := make([]string, n)
		for i := range lines {
			lines[i] = fmt.Sprintf("%q", line)
		}
		return "[" + strings.Join(lines, ",") + "]"
	}
	tests := []struct {
		name, body, field string
	}{
		{"titel fehlt", `{}`, "title"},
		{"titel leer", `{"title":"   "}`, "title"},
		{"titel zu lang", fmt.Sprintf(`{"title":%q}`, strings.Repeat("a", 201)), "title"},
		{"portionen 0", `{"title":"A","servings":0}`, "servings"},
		{"portionen 100", `{"title":"A","servings":100}`, "servings"},
		{"portionen als text", `{"title":"A","servings":"vier"}`, "servings"},
		{"portionen mit komma", `{"title":"A","servings":2.5}`, "servings"},
		{"101 zutaten", `{"title":"A","ingredients":` + many(101, "1 Ei") + `}`, "ingredients"},
		{"zutat zu lang", fmt.Sprintf(`{"title":"A","ingredients":[%q]}`, strings.Repeat("a", 201)), "ingredients"},
		{"51 schritte", `{"title":"A","instructions":` + many(51, "Rühren.") + `}`, "instructions"},
		{"schritt zu lang", fmt.Sprintf(`{"title":"A","instructions":[%q]}`, strings.Repeat("a", 2001)), "instructions"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, h, "POST", "/api/recipes", tt.body)
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
			}
			body := decode[map[string]any](t, rec)
			if body["field"] != tt.field || body["error"] == "" {
				t.Errorf("antwort = %v, erwartet feld %s", body, tt.field)
			}
		})
	}

	// Grenzen selbst sind erlaubt.
	ok := fmt.Sprintf(`{"title":%q,"servings":99,"ingredients":%s,"instructions":%s}`,
		strings.Repeat("ä", 200), many(100, strings.Repeat("b", 200)), many(50, "Rühren."))
	if rec := do(t, h, "POST", "/api/recipes", ok); rec.Code != http.StatusCreated {
		t.Errorf("grenzwerte: %d %s", rec.Code, rec.Body.String())
	}
	assertError(t, do(t, h, "POST", "/api/recipes", `kein json`), http.StatusBadRequest)
	assertError(t, do(t, h, "POST", "/api/recipes", `{"title":"A","ingredients":"1 Ei"}`), http.StatusBadRequest)
}

func TestUpdateRecipe(t *testing.T) {
	h, _ := newTestAPI(t)

	// Zutaten zu einem PDF-Rezept nachtragen; der Titel bleibt.
	rec := do(t, h, "PUT", "/api/recipes/gemueselasagne",
		`{"title":"Gemüselasagne","servings":4,"ingredients":["12 Lasagneplatten","2 Zucchini","500 ml Tomatensauce","200 g Mozzarella","1 Zwiebel"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	recipe := decode[map[string]any](t, rec)
	if len(recipe["ingredients"].([]any)) != 5 || recipe["servings"] != float64(4) ||
		recipe["source"].(map[string]any)["kind"] != "pdf" || recipe["titleEditable"] != nil {
		t.Errorf("rezept = %v", recipe)
	}

	// Titel eines PDF-Rezepts lässt sich nicht ändern.
	rec = do(t, h, "PUT", "/api/recipes/gemueselasagne", `{"title":"Lasagne"}`)
	if rec.Code != http.StatusUnprocessableEntity || decode[map[string]any](t, rec)["field"] != "title" {
		t.Errorf("titeländerung: %d %s", rec.Code, rec.Body.String())
	}
	if got := decode[map[string]any](t, do(t, h, "GET", "/api/recipes/gemueselasagne", "")); got["title"] != "Gemüselasagne" || len(got["ingredients"].([]any)) != 5 {
		t.Errorf("rezept wurde verändert: %v", got)
	}

	// Eigene Rezepte dürfen umbenannt werden.
	id := decode[map[string]any](t, do(t, h, "POST", "/api/recipes", `{"title":"Gulasch"}`))["id"].(string)
	if got := decode[map[string]any](t, do(t, h, "PUT", "/api/recipes/"+id, `{"title":"Omas Gulasch"}`)); got["title"] != "Omas Gulasch" {
		t.Errorf("umbenennen: %v", got)
	}

	assertError(t, do(t, h, "PUT", "/api/recipes/does-not-exist", `{"title":"A"}`), http.StatusNotFound)
}

func TestRemoveManualRecipe(t *testing.T) {
	h, _ := newTestAPI(t)
	id := decode[map[string]any](t, do(t, h, "POST", "/api/recipes", `{"title":"Brotzeit"}`))["id"].(string)
	do(t, h, "PUT", "/api/days/2026-09-30", fmt.Sprintf(`{"recipeId":%q}`, id))

	if rec := do(t, h, "DELETE", "/api/recipes/"+id, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("entfernen: %d", rec.Code)
	}
	for _, r := range decode[[]map[string]any](t, do(t, h, "GET", "/api/recipes", "")) {
		if r["id"] == id {
			t.Error("entferntes rezept steht noch in der liste")
		}
	}
	if plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", "")); plan.Days["2026-09-30"] == nil {
		t.Error("plan verloren")
	}
	assertError(t, do(t, h, "DELETE", "/api/recipes/gemueselasagne", ""), http.StatusConflict)
}

func TestReimportKeepsEditedIngredients(t *testing.T) {
	h, _ := newImportAPI(t)
	url := `{"url":"https://www.chefkoch.de/rezepte/1/kuerbis.html"}`
	id := decode[map[string]any](t, do(t, h, "POST", "/api/recipes/import", url))["id"].(string)

	do(t, h, "PUT", "/api/recipes/"+id, `{"title":"Kürbissuppe","servings":4,"ingredients":["1,2 kg Kürbis","1 Zwiebel"],"instructions":["Schneiden.","Kochen."]}`)

	again := decode[map[string]any](t, do(t, h, "POST", "/api/recipes/import", url))
	ingredients := again["ingredients"].([]any)
	if ingredients[0].(map[string]any)["text"] != "1,2 kg Kürbis" {
		t.Errorf("korrigierte zutaten überschrieben: %v", ingredients)
	}
	if again["imageUrl"] != "https://img.example.com/k.jpg" || len(again["instructions"].([]any)) != 2 {
		t.Errorf("rezept = %v", again)
	}
}

func TestStructuredIngredientJSON(t *testing.T) {
	h, _ := newTestAPI(t)
	recipe := decode[map[string]any](t, do(t, h, "POST", "/api/recipes", `{"title":"A","ingredients":["200 g Mehl","Salz und Pfeffer"]}`))
	ingredients := recipe["ingredients"].([]any)
	if fmt.Sprint(ingredients[0]) != fmt.Sprint(map[string]any{"text": "200 g Mehl", "quantity": float64(200), "unit": "g", "name": "Mehl"}) {
		t.Errorf("zutat = %v", ingredients[0])
	}
	if fmt.Sprint(ingredients[1]) != fmt.Sprint(map[string]any{"text": "Salz und Pfeffer", "name": "Salz und Pfeffer"}) {
		t.Errorf("zutat ohne menge = %v", ingredients[1])
	}
}
