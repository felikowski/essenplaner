package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

type apiMenu struct {
	ID          string                      `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Days        int                         `json:"days"`
	RecipeCount int                         `json:"recipeCount"`
	Entries     map[string][]map[string]any `json:"entries"`
}

func createMenuAPI(t *testing.T, h http.Handler, body string) apiMenu {
	t.Helper()
	rec := do(t, h, "POST", "/api/menus", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Menü anlegen: Status %d: %s", rec.Code, rec.Body.String())
	}
	return decode[apiMenu](t, rec)
}

func addMenuEntryAPI(t *testing.T, h http.Handler, menuID, body string) apiMenu {
	t.Helper()
	rec := do(t, h, "POST", "/api/menus/"+menuID+"/entries", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Menüeintrag anlegen: Status %d: %s", rec.Code, rec.Body.String())
	}
	return decode[apiMenu](t, rec)
}

func TestMenusListeUndLeereListe(t *testing.T) {
	h, _ := newTestAPI(t)
	if menus := decode[[]apiMenu](t, do(t, h, "GET", "/api/menus", "")); len(menus) != 0 {
		t.Fatalf("leere Liste = %+v", menus)
	}

	guest := createMenuAPI(t, h, `{"name":"Gäste-Wochenende","days":2}`)
	for range 4 {
		addMenuEntryAPI(t, h, guest.ID, `{"day":1,"meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`)
	}
	fall := createMenuAPI(t, h, `{"name":"Herbstwoche","days":7}`)
	for range 6 {
		addMenuEntryAPI(t, h, fall.ID, `{"day":1,"meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`)
	}

	menus := decode[[]apiMenu](t, do(t, h, "GET", "/api/menus", ""))
	if len(menus) != 2 || menus[0].Name != "Gäste-Wochenende" || menus[0].Days != 2 || menus[0].RecipeCount != 4 ||
		menus[1].Name != "Herbstwoche" || menus[1].RecipeCount != 6 {
		t.Errorf("Menüliste = %+v", menus)
	}
}

func TestWocheAlsMenuSpeichernUndLeereWocheAblehnen(t *testing.T) {
	h, _ := newTestAPI(t)
	for i, date := range []string{"2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-04"} {
		body := fmt.Sprintf(`{"date":%q,"meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`, date)
		if rec := do(t, h, "POST", "/api/entries", body); rec.Code != http.StatusCreated {
			t.Fatalf("Eintrag %d: %s", i, rec.Body.String())
		}
	}
	do(t, h, "POST", "/api/entries", `{"date":"2026-10-02","meal":"lunch","kind":"note","text":"Oma kommt"}`)
	menu := createMenuAPI(t, h, `{"name":"Herbstwoche","from":"2026-09-28","to":"2026-10-04"}`)
	if menu.Days != 7 || len(menu.Entries["1"]) != 1 || len(menu.Entries["5"]) != 1 || len(menu.Entries["7"]) != 1 {
		t.Errorf("gespeicherte Woche = %+v", menu)
	}

	assertError(t, do(t, h, "POST", "/api/menus", `{"name":"Leer","from":"2026-11-01","to":"2026-11-07"}`), http.StatusUnprocessableEntity)
}

func TestMenuTagEntfernenUndGrenzen(t *testing.T) {
	h, _ := newTestAPI(t)
	menu := createMenuAPI(t, h, `{"name":"Sieben Tage","days":7}`)
	for day := 3; day <= 7; day++ {
		addMenuEntryAPI(t, h, menu.ID, fmt.Sprintf(`{"day":%d,"meal":"dinner","kind":"note","text":"Alt %d"}`, day, day))
	}
	rec := do(t, h, "DELETE", fmt.Sprintf("/api/menus/%s/days/3", menu.ID), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("Tag entfernen: %s", rec.Body.String())
	}
	menu = decode[apiMenu](t, rec)
	if menu.Days != 6 || menu.Entries["3"][0]["text"] != "Alt 4" || menu.Entries["6"][0]["text"] != "Alt 7" {
		t.Errorf("Tage nach Entfernen = %+v", menu)
	}

	one := createMenuAPI(t, h, `{"name":"Ein Tag"}`)
	assertError(t, do(t, h, "DELETE", "/api/menus/"+one.ID+"/days/1", ""), http.StatusUnprocessableEntity)
	for one.Days < 28 {
		one = decode[apiMenu](t, do(t, h, "POST", "/api/menus/"+one.ID+"/days", ""))
	}
	assertError(t, do(t, h, "POST", "/api/menus/"+one.ID+"/days", ""), http.StatusUnprocessableEntity)
}

func TestDoppelterMenuname(t *testing.T) {
	h, _ := newTestAPI(t)
	createMenuAPI(t, h, `{"name":"Herbstwoche"}`)
	assertError(t, do(t, h, "POST", "/api/menus", `{"name":"  herbstwoche  "}`), http.StatusUnprocessableEntity)
}

func TestMenuLoschenLasstPlanUnverandert(t *testing.T) {
	h, _ := newTestAPI(t)
	menu := createMenuAPI(t, h, `{"name":"Kurz"}`)
	addMenuEntryAPI(t, h, menu.ID, `{"day":1,"meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`)
	if rec := do(t, h, "POST", "/api/menus/"+menu.ID+"/apply", `{"start":"2026-10-12"}`); rec.Code != http.StatusOK {
		t.Fatal(rec.Body.String())
	}
	if rec := do(t, h, "DELETE", "/api/menus/"+menu.ID, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("Löschen: %d %s", rec.Code, rec.Body.String())
	}
	week := decode[weekPlan](t, do(t, h, "GET", "/api/weeks/2026-W42", ""))
	if len(week.Days["2026-10-12"]) != 1 {
		t.Errorf("Plan nach Menülöschen = %+v", week)
	}
}

func TestMenuAbMontagUndAnBelegtenTagEinplanen(t *testing.T) {
	h, _ := newTestAPI(t)
	menu := createMenuAPI(t, h, `{"name":"Herbstwoche","days":7}`)
	addMenuEntryAPI(t, h, menu.ID, `{"day":1,"meal":"dinner","kind":"recipe","recipeId":"linsensuppe"}`)
	addMenuEntryAPI(t, h, menu.ID, `{"day":7,"meal":"dinner","kind":"note","text":"Sonntag"}`)
	do(t, h, "POST", "/api/entries", `{"date":"2026-10-12","meal":"dinner","kind":"note","text":"Schon da"}`)

	rec := do(t, h, "POST", "/api/menus/"+menu.ID+"/apply", `{"start":"2026-10-12"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("Einplanen: %d %s", rec.Code, rec.Body.String())
	}
	response := decode[struct {
		Weeks   []weekPlan `json:"weeks"`
		Skipped []string   `json:"skipped"`
	}](t, rec)
	if len(response.Weeks) != 1 || response.Weeks[0].Week != "2026-W42" || len(response.Skipped) != 0 {
		t.Errorf("Antwort = %+v", response)
	}
	if !strings.Contains(rec.Body.String(), `"skipped":[]`) {
		t.Errorf("leere Übersprungsliste muss ein Array sein: %s", rec.Body.String())
	}
	monday := response.Weeks[0].Days["2026-10-12"]
	if len(monday) != 2 || monday[0].Text != "Schon da" || monday[1].RecipeID != "linsensuppe" ||
		response.Weeks[0].Days["2026-10-18"][0].Text != "Sonntag" {
		t.Errorf("eingeplanter Plan = %+v", response.Weeks[0])
	}
}

func TestEntferntesRezeptWirdBeimEinplanenGenannt(t *testing.T) {
	h, db := newTestAPI(t)
	removed, _, err := db.SaveImported(t.Context(), "https://example.com/entfernte-lasagne", store.Recipe{Title: "Gemüselasagne"})
	if err != nil {
		t.Fatal(err)
	}
	menu := createMenuAPI(t, h, `{"name":"Mit Lasagne"}`)
	addMenuEntryAPI(t, h, menu.ID, fmt.Sprintf(`{"day":1,"meal":"dinner","kind":"recipe","recipeId":%q}`, removed.ID))
	addMenuEntryAPI(t, h, menu.ID, `{"day":1,"meal":"dinner","kind":"note","text":"Tisch decken"}`)
	if rec := do(t, h, "DELETE", "/api/recipes/"+removed.ID, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("Rezept entfernen: %d %s", rec.Code, rec.Body.String())
	}
	rec := do(t, h, "POST", "/api/menus/"+menu.ID+"/apply", `{"start":"2026-10-12"}`)
	response := decode[struct {
		Weeks   []weekPlan `json:"weeks"`
		Skipped []string   `json:"skipped"`
	}](t, rec)
	if rec.Code != http.StatusOK || len(response.Skipped) != 1 || response.Skipped[0] != "Gemüselasagne" ||
		len(response.Weeks[0].Days["2026-10-12"]) != 1 {
		t.Errorf("Antwort = %d %+v", rec.Code, response)
	}
}

func TestMenuAPIUnbekanntesMenu(t *testing.T) {
	h, _ := newTestAPI(t)
	assertError(t, do(t, h, "POST", "/api/menus/gibt-es-nicht/apply", `{"start":"2026-10-12"}`), http.StatusNotFound)
}
