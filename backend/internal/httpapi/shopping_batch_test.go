package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestShoppingBatch(t *testing.T) {
	h, _ := newTestAPI(t)
	shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"Bier"}`))
	version := shoppingOf(t, do(t, h, "GET", "/api/shopping/list", "")).Version

	rec := do(t, h, "POST", "/api/shopping/items/batch?dryRun=1", `{"texts":["2 Gurken","Bier"]}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("dryRun: %d %s", rec.Code, rec.Body.String())
	}
	preview := decode[struct {
		Lines []struct {
			Text, Name, Category string
			MergesInto           *string
		}
	}](t, rec)
	if len(preview.Lines) != 2 || preview.Lines[0].Category != "Obst & Gemüse" || preview.Lines[1].MergesInto == nil {
		t.Errorf("vorschau = %+v", preview)
	}
	if !strings.Contains(rec.Body.String(), `"mergesInto":null`) {
		t.Errorf("mergesInto fehlt als null: %s", rec.Body.String())
	}
	if got := shoppingOf(t, do(t, h, "GET", "/api/shopping/list", "")); got.Version != version || len(got.Items) != 1 {
		t.Errorf("dryRun hat geschrieben: %+v", got)
	}

	rec = do(t, h, "POST", "/api/shopping/items/batch", `{"texts":["2 Gurken","Feta","Bier","Spülmittel"]}`)
	list := shoppingOf(t, rec)
	if len(list.Items) != 4 || list.Version != version+1 || rec.Header().Get("ETag") == "" {
		t.Errorf("liste = %+v", list)
	}
}

func TestShoppingBatchErrors(t *testing.T) {
	h, _ := newTestAPI(t)
	tooMany, _ := json.Marshal(map[string][]string{"texts": make([]string, 51)})
	for _, tc := range []struct {
		name, body string
		status     int
	}{
		{"leere zeile", `{"texts":["Gurken",""]}`, http.StatusUnprocessableEntity},
		{"zu lang", `{"texts":["` + strings.Repeat("x", 201) + `"]}`, http.StatusUnprocessableEntity},
		{"zu viele", string(tooMany), http.StatusUnprocessableEntity},
		{"leer", `{"texts":[]}`, http.StatusUnprocessableEntity},
		{"ohne texts", `{}`, http.StatusBadRequest},
		{"kein json", `nope`, http.StatusBadRequest},
	} {
		for _, path := range []string{"/api/shopping/items/batch", "/api/shopping/items/batch?dryRun=1"} {
			t.Run(tc.name+" "+path, func(t *testing.T) {
				assertError(t, do(t, h, "POST", path, tc.body), tc.status)
			})
		}
	}
	if list := shoppingOf(t, do(t, h, "GET", "/api/shopping/list", "")); len(list.Items) != 0 {
		t.Errorf("nach Fehlern: %+v", list.Items)
	}
}
