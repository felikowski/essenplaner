package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// planDinner legt über die API ein Abendessen mit einem Rezept an und liefert die ID des Eintrags.
func planDinner(t *testing.T, h http.Handler, date, recipeID string) string {
	t.Helper()
	rec := do(t, h, "POST", "/api/entries", fmt.Sprintf(`{"date":%q,"meal":"dinner","kind":"recipe","recipeId":%q}`, date, recipeID))
	if rec.Code != http.StatusCreated {
		t.Fatalf("einplanen: %d %s", rec.Code, rec.Body.String())
	}
	weeks := decode[weeksResponse](t, rec).Weeks
	entries := weeks[0].Days[date]
	return entries[len(entries)-1].ID
}

func weeksOf(t *testing.T, rec *httptest.ResponseRecorder) []weekPlan {
	t.Helper()
	return decode[weeksResponse](t, rec).Weeks
}

func TestGetWeekEmpty(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "GET", "/api/weeks/2026-W41", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	want := `{"week":"2026-W41","days":{"2026-10-05":[],"2026-10-06":[],"2026-10-07":[],"2026-10-08":[],"2026-10-09":[],"2026-10-10":[],"2026-10-11":[]}}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Errorf("antwort = %s\nerwartet  %s", got, want)
	}
}

func TestCreateEntry(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "POST", "/api/entries", `{"date":"2026-09-30","meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	weeks := weeksOf(t, rec)
	if len(weeks) != 1 || weeks[0].Week != "2026-W40" || len(weeks[0].Days) != 7 {
		t.Fatalf("antwort = %s", rec.Body.String())
	}
	raw := decode[map[string]any](t, rec)
	entry := raw["weeks"].([]any)[0].(map[string]any)["days"].(map[string]any)["2026-09-30"].([]any)[0].(map[string]any)
	if entry["kind"] != "recipe" || entry["meal"] != "dinner" || entry["recipeId"] != "linsensuppe" ||
		entry["servings"] != float64(6) || entry["position"] != float64(1) || entry["id"] == "" {
		t.Errorf("eintrag = %v", entry)
	}
	for _, field := range []string{"text", "leftoverOf"} {
		if _, ok := entry[field]; ok {
			t.Errorf("%s sollte fehlen: %v", field, entry)
		}
	}

	// Notiz und Einzelzutat im selben Abendessen, danach Reste am Folgetag.
	do(t, h, "POST", "/api/entries", `{"date":"2026-09-30","meal":"dinner","kind":"note","text":"Oma kommt"}`)
	do(t, h, "POST", "/api/entries", `{"date":"2026-09-30","meal":"dinner","kind":"item","text":"1 Baguette"}`)
	original := weeks[0].Days["2026-09-30"][0].ID
	rec = do(t, h, "POST", "/api/entries", fmt.Sprintf(`{"date":"2026-10-01","meal":"lunch","kind":"leftover","leftoverOf":%q}`, original))
	if rec.Code != http.StatusCreated {
		t.Fatalf("reste: %d %s", rec.Code, rec.Body.String())
	}
	plan := weeksOf(t, rec)[0]
	if day := plan.Days["2026-09-30"]; len(day) != 3 || day[1].Text != "Oma kommt" || day[2].Kind != "item" {
		t.Errorf("30.09. = %+v", day)
	}
	leftover := plan.Days["2026-10-01"][0]
	if leftover.Kind != "leftover" || leftover.LeftoverOf == nil || leftover.LeftoverOf.ID != original || leftover.LeftoverOf.Date != "2026-09-30" {
		t.Errorf("reste = %+v", leftover)
	}
}

func TestCreateEntryErrors(t *testing.T) {
	h, _ := newTestAPI(t)
	badRequests := []string{
		`{"date":"2026-02-30","meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`,
		`{"date":"30.09.2026","meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`,
		`{"date":"2026-09-30","meal":"brunch","kind":"recipe","recipeId":"linsensuppe"}`,
		`{"date":"2026-09-30","meal":"dinner","kind":"menu"}`,
		`kein json`,
	}
	for _, body := range badRequests {
		assertError(t, do(t, h, "POST", "/api/entries", body), http.StatusBadRequest)
	}
	unprocessable := []string{
		`{"date":"2026-09-30","meal":"dinner","kind":"recipe","recipeId":"gibt-es-nicht"}`,
		`{"date":"2026-09-30","meal":"dinner","kind":"note","text":""}`,
		`{"date":"2026-09-30","meal":"dinner","kind":"leftover","leftoverOf":"gibt-es-nicht"}`,
	}
	for _, body := range unprocessable {
		assertError(t, do(t, h, "POST", "/api/entries", body), http.StatusUnprocessableEntity)
	}
	rec := do(t, h, "POST", "/api/entries", `{"date":"2026-09-30","meal":"dinner","kind":"recipe","recipeId":"linsensuppe","servings":0}`)
	if rec.Code != http.StatusUnprocessableEntity || decode[map[string]any](t, rec)["field"] != "servings" {
		t.Errorf("portionen 0: %d %s", rec.Code, rec.Body.String())
	}

	plan := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W40", ""))
	for date, entries := range plan.Days {
		if len(entries) != 0 {
			t.Errorf("%s wurde trotz Fehler belegt", date)
		}
	}
}

func TestUpdateEntryAcrossWeeks(t *testing.T) {
	h, _ := newTestAPI(t)
	id := planDinner(t, h, "2026-10-04", "pfannkuchen")

	rec := do(t, h, "PATCH", "/api/entries/"+id, `{"date":"2026-10-05","meal":"lunch","servings":3}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	weeks := weeksOf(t, rec)
	if len(weeks) != 2 || weeks[0].Week != "2026-W40" || weeks[1].Week != "2026-W41" {
		t.Fatalf("wochen = %+v", weeks)
	}
	if len(weeks[0].Days["2026-10-04"]) != 0 {
		t.Error("sonntag ist nicht leer")
	}
	moved := weeks[1].Days["2026-10-05"][0]
	if moved.Meal != "lunch" || moved.Servings == nil || *moved.Servings != 3 {
		t.Errorf("verschoben = %+v", moved)
	}

	// Portionen entfernen
	if got := weeksOf(t, do(t, h, "PATCH", "/api/entries/"+id, `{"servings":null}`))[0].Days["2026-10-05"][0]; got.Servings != nil {
		t.Errorf("portionen = %v", *got.Servings)
	}

	for _, body := range []string{`{"date":"2026-13-01"}`, `{"meal":"brunch"}`, `{"position":1}`, `kein json`} {
		assertError(t, do(t, h, "PATCH", "/api/entries/"+id, body), http.StatusBadRequest)
	}
	assertError(t, do(t, h, "PATCH", "/api/entries/"+id, `{"text":"Notiz"}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "PATCH", "/api/entries/gibt-es-nicht", `{"meal":"lunch"}`), http.StatusNotFound)
}

func TestDeleteEntry(t *testing.T) {
	h, _ := newTestAPI(t)
	id := planDinner(t, h, "2026-09-30", "linsensuppe")
	do(t, h, "POST", "/api/entries", fmt.Sprintf(`{"date":"2026-10-06","meal":"lunch","kind":"leftover","leftoverOf":%q}`, id))

	rec := do(t, h, "DELETE", "/api/entries/"+id, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	weeks := weeksOf(t, rec)
	if len(weeks) != 2 {
		t.Fatalf("erwartet die wochen des eintrags und der reste: %+v", weeks)
	}
	if note := weeks[0].Days["2026-10-06"]; len(note) != 1 || note[0].Text != "Reste: Linsensuppe" {
		// Reihenfolge der Wochen folgt den betroffenen Tagen; beide prüfen.
		if note := weeks[1].Days["2026-10-06"]; len(note) != 1 || note[0].Kind != "note" || note[0].Text != "Reste: Linsensuppe" {
			t.Errorf("reste = %+v", weeks)
		}
	}
	assertError(t, do(t, h, "DELETE", "/api/entries/does-not-exist", ""), http.StatusNotFound)
}

func TestCopyWeekAPI(t *testing.T) {
	h, _ := newTestAPI(t)
	planDinner(t, h, "2026-09-28", "haehnchen-curry")

	rec := do(t, h, "POST", "/api/weeks/2026-W40/copy", `{"to":"2026-W42","mode":"append"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	body := decode[struct {
		Week    weekPlan `json:"week"`
		Skipped int      `json:"skipped"`
	}](t, rec)
	if body.Week.Week != "2026-W42" || body.Skipped != 0 || len(body.Week.Days["2026-10-12"]) != 1 {
		t.Errorf("antwort = %+v", body)
	}

	assertError(t, do(t, h, "POST", "/api/weeks/2026-W40/copy", `{"to":"2026-W40","mode":"append"}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "POST", "/api/weeks/2026-W40/copy", `{"to":"2026-W42","mode":"merge"}`), http.StatusBadRequest)
	assertError(t, do(t, h, "POST", "/api/weeks/2026-W40/copy", `{"to":"abc","mode":"append"}`), http.StatusBadRequest)
	assertError(t, do(t, h, "POST", "/api/weeks/abc/copy", `{"to":"2026-W42","mode":"append"}`), http.StatusBadRequest)
}

func TestRecipeHistoryAPI(t *testing.T) {
	h, _ := newTestAPI(t)
	planDinner(t, h, "2026-10-02", "linsensuppe")
	planDinner(t, h, "2026-10-16", "linsensuppe")

	rec := do(t, h, "GET", "/api/recipes/linsensuppe/history", "")
	if got := strings.TrimSpace(rec.Body.String()); rec.Code != http.StatusOK || got != `{"dates":["2026-10-16","2026-10-02"]}` {
		t.Errorf("verlauf = %d %s", rec.Code, got)
	}
	if got := strings.TrimSpace(do(t, h, "GET", "/api/recipes/pfannkuchen/history", "").Body.String()); got != `{"dates":[]}` {
		t.Errorf("leerer verlauf = %s", got)
	}
	assertError(t, do(t, h, "GET", "/api/recipes/gibt-es-nicht/history", ""), http.StatusNotFound)
}

func TestSettingsAPI(t *testing.T) {
	h, _ := newTestAPI(t)

	if got := strings.TrimSpace(do(t, h, "GET", "/api/settings", "").Body.String()); got != `{"visibleMeals":["dinner"]}` {
		t.Errorf("standard = %s", got)
	}
	rec := do(t, h, "PATCH", "/api/settings", `{"visibleMeals":["dinner","lunch"]}`)
	if got := strings.TrimSpace(rec.Body.String()); rec.Code != http.StatusOK || got != `{"visibleMeals":["lunch","dinner"]}` {
		t.Errorf("geändert = %d %s", rec.Code, got)
	}
	assertError(t, do(t, h, "PATCH", "/api/settings", `{"visibleMeals":["brunch"]}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "PATCH", "/api/settings", `{"visibleMeals":[]}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "PATCH", "/api/settings", `{"farbe":"rot"}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "PATCH", "/api/settings", `kein json`), http.StatusBadRequest)
	if got := strings.TrimSpace(do(t, h, "GET", "/api/settings", "").Body.String()); got != `{"visibleMeals":["lunch","dinner"]}` {
		t.Errorf("nach fehlern = %s", got)
	}
}

func TestOldDayEndpointIsGone(t *testing.T) {
	h, _ := newTestAPI(t)
	rec := do(t, h, "PUT", "/api/days/2026-09-30", `{"recipeId":"linsensuppe"}`)
	if rec.Code != http.StatusNotFound && rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("PUT /api/days = %d", rec.Code)
	}
}
