package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/felikowski/essenplaner/backend/internal/store"
)

func shoppingOf(t *testing.T, rec *httptest.ResponseRecorder) store.ShoppingList {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	return decode[store.ShoppingList](t, rec)
}

func findItem(t *testing.T, list store.ShoppingList, name string) store.ShoppingItem {
	t.Helper()
	for _, item := range list.Items {
		if item.Name == name {
			return item
		}
	}
	t.Fatalf("artikel %q fehlt: %+v", name, list.Items)
	return store.ShoppingItem{}
}

func TestShoppingListETag(t *testing.T) {
	h, _ := newTestAPI(t)

	rec := do(t, h, "GET", "/api/shopping/list", "")
	list := shoppingOf(t, rec)
	tag := rec.Header().Get("ETag")
	if tag != fmt.Sprintf(`"v%d"`, list.Version) || len(list.Categories) != 14 {
		t.Fatalf("etag = %q, liste = %+v", tag, list)
	}

	req := httptest.NewRequest("GET", "/api/shopping/list", nil)
	req.Header.Set("If-None-Match", tag)
	unchanged := httptest.NewRecorder()
	h.ServeHTTP(unchanged, req)
	if unchanged.Code != http.StatusNotModified || unchanged.Body.Len() != 0 {
		t.Errorf("unverändert: %d %q", unchanged.Code, unchanged.Body.String())
	}

	added := do(t, h, "POST", "/api/shopping/items", `{"text":"2 Packungen Kaffee"}`)
	if added.Header().Get("ETag") == tag {
		t.Error("etag nach Änderung unverändert")
	}
	req = httptest.NewRequest("GET", "/api/shopping/list", nil)
	req.Header.Set("If-None-Match", tag)
	changed := httptest.NewRecorder()
	h.ServeHTTP(changed, req)
	if got := findItem(t, shoppingOf(t, changed), "Kaffee").Display; got != "2 Pck." {
		t.Errorf("Kaffee = %q", got)
	}
}

func TestShoppingItemEndpoints(t *testing.T) {
	h, _ := newTestAPI(t)

	list := shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"1 Zwiebel"}`))
	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"3 Zwiebeln"}`))
	onion, onions := findItem(t, list, "Zwiebel"), findItem(t, list, "Zwiebeln")

	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/items/"+onion.ID+"/merge-into/"+onions.ID, ""))
	if len(list.Items) != 1 || list.Items[0].Display != "4" {
		t.Errorf("zusammengeführt: %+v", list.Items)
	}
	aliases := decode[[]store.ShoppingAlias](t, do(t, h, "GET", "/api/shopping/aliases", ""))
	if len(aliases) != 1 || aliases[0].FromKey != "zwiebel" || aliases[0].ToName != "Zwiebeln" {
		t.Errorf("aliasse = %+v", aliases)
	}
	if got := decode[[]store.ShoppingAlias](t, do(t, h, "DELETE", "/api/shopping/aliases/zwiebel", "")); len(got) != 0 {
		t.Errorf("nach dem Entfernen: %+v", got)
	}
	assertError(t, do(t, h, "DELETE", "/api/shopping/aliases/zwiebel", ""), http.StatusNotFound)

	item := list.Items[0]
	list = shoppingOf(t, do(t, h, "PATCH", "/api/shopping/items/"+item.ID, `{"quantity":"5","name":"Rote Zwiebeln","storeId":null}`))
	if got := list.Items[0]; got.Name != "Rote Zwiebeln" || got.Display != "5" {
		t.Errorf("geändert: %+v", got)
	}
	assertError(t, do(t, h, "PATCH", "/api/shopping/items/"+item.ID, `{"quantity":"etwas"}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "PATCH", "/api/shopping/items/"+item.ID, `{"color":"rot"}`), http.StatusBadRequest)
	assertError(t, do(t, h, "PATCH", "/api/shopping/items/"+item.ID, `{"name":null}`), http.StatusBadRequest)
	assertError(t, do(t, h, "PATCH", "/api/shopping/items/s-fehlt", `{"name":"x"}`), http.StatusNotFound)

	list = shoppingOf(t, do(t, h, "PUT", "/api/shopping/items/"+item.ID+"/checked", `{"checked":true}`))
	if !list.Items[0].Checked {
		t.Error("nicht abgehakt")
	}
	assertError(t, do(t, h, "PUT", "/api/shopping/items/"+item.ID+"/checked", `{}`), http.StatusBadRequest)
	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/clear-checked", ""))
	if len(list.Items) != 0 {
		t.Errorf("nach dem Aufräumen: %+v", list.Items)
	}

	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"Milch"}`))
	list = shoppingOf(t, do(t, h, "DELETE", "/api/shopping/items/"+list.Items[0].ID, ""))
	if len(list.Items) != 0 {
		t.Errorf("nach dem Löschen: %+v", list.Items)
	}
	assertError(t, do(t, h, "DELETE", "/api/shopping/items/s-fehlt", ""), http.StatusNotFound)
	assertError(t, do(t, h, "POST", "/api/shopping/items", `{"text":"  "}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "POST", "/api/shopping/items", `kaputt`), http.StatusBadRequest)
	assertError(t, do(t, h, "POST", "/api/shopping/items", `{}`), http.StatusBadRequest)
}

func TestShoppingImportEndpoint(t *testing.T) {
	h, _ := newTestAPI(t)
	do(t, h, "POST", "/api/entries", `{"date":"2026-10-02","meal":"dinner","kind":"recipe","recipeId":"linsensuppe","servings":8}`)
	do(t, h, "POST", "/api/entries", `{"date":"2026-10-02","meal":"dinner","kind":"recipe","recipeId":"spaghetti-bolognese"}`)
	do(t, h, "POST", "/api/entries", `{"date":"2026-10-03","meal":"dinner","kind":"item","text":"1 Baguette"}`)

	rec := do(t, h, "POST", "/api/shopping/import", `{"from":"2026-10-01","to":"2026-10-07"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body.String())
	}
	result := decode[struct {
		List               store.ShoppingList `json:"list"`
		WithoutIngredients []store.RecipeRef  `json:"withoutIngredients"`
	}](t, rec)
	if len(result.WithoutIngredients) != 1 || result.WithoutIngredients[0].Title != "Spaghetti Bolognese" {
		t.Errorf("ohne zutaten = %+v", result.WithoutIngredients)
	}
	if got := findItem(t, result.List, "Tellerlinsen").Display; got != "333 g" {
		t.Errorf("Tellerlinsen = %q", got)
	}
	findItem(t, result.List, "Baguette")

	assertError(t, do(t, h, "POST", "/api/shopping/import", `{"from":"2026-10-07","to":"2026-10-01"}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "POST", "/api/shopping/import", `{"from":"gestern","to":"2026-10-01"}`), http.StatusBadRequest)
	assertError(t, do(t, h, "POST", "/api/shopping/import", `{"from":"2026-01-01","to":"2026-12-31"}`), http.StatusUnprocessableEntity)
}

func TestShoppingCategoryAndStoreEndpoints(t *testing.T) {
	h, _ := newTestAPI(t)

	list := shoppingOf(t, do(t, h, "POST", "/api/shopping/categories", `{"name":"Käsetheke"}`))
	counter := list.Categories[len(list.Categories)-1]
	if counter.Name != "Käsetheke" || !counter.Removable {
		t.Fatalf("neue kategorie = %+v", counter)
	}
	list = shoppingOf(t, do(t, h, "PATCH", "/api/shopping/categories/"+counter.ID, `{"name":"Theke"}`))
	ids := `["` + counter.ID + `"`
	for _, c := range list.Categories {
		if c.ID != counter.ID {
			ids += `,"` + c.ID + `"`
		}
	}
	list = shoppingOf(t, do(t, h, "PUT", "/api/shopping/categories/order", `{"ids":`+ids+`]}`))
	if list.Categories[0].Name != "Theke" {
		t.Errorf("reihenfolge = %+v", list.Categories)
	}
	assertError(t, do(t, h, "PUT", "/api/shopping/categories/order", `{"ids":["cat-obst-gemuese"]}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "DELETE", "/api/shopping/categories/cat-sonstiges", ""), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "DELETE", "/api/shopping/categories/cat-fehlt", ""), http.StatusNotFound)
	assertError(t, do(t, h, "POST", "/api/shopping/categories", `{"name":""}`), http.StatusUnprocessableEntity)
	assertError(t, do(t, h, "POST", "/api/shopping/categories", `{}`), http.StatusBadRequest)
	list = shoppingOf(t, do(t, h, "DELETE", "/api/shopping/categories/"+counter.ID, ""))
	if len(list.Categories) != 14 {
		t.Errorf("nach dem Löschen: %d kategorien", len(list.Categories))
	}

	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/stores", `{"name":"Wochenmarkt"}`))
	market := list.Stores[0]
	list = shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"Äpfel"}`))
	apples := findItem(t, list, "Äpfel")
	list = shoppingOf(t, do(t, h, "PATCH", "/api/shopping/items/"+apples.ID, fmt.Sprintf(`{"storeId":%q,"categoryId":"cat-obst-gemuese"}`, market.ID)))
	if findItem(t, list, "Äpfel").StoreID != market.ID {
		t.Errorf("geschäft nicht zugeordnet")
	}
	assertError(t, do(t, h, "PATCH", "/api/shopping/items/"+apples.ID, `{"storeId":"shop-fehlt"}`), http.StatusUnprocessableEntity)
	list = shoppingOf(t, do(t, h, "PATCH", "/api/shopping/stores/"+market.ID, `{"name":"Markt"}`))
	if list.Stores[0].Name != "Markt" {
		t.Errorf("umbenannt: %+v", list.Stores)
	}
	list = shoppingOf(t, do(t, h, "DELETE", "/api/shopping/stores/"+market.ID, ""))
	if len(list.Stores) != 0 || findItem(t, list, "Äpfel").StoreID != "" {
		t.Errorf("nach dem Löschen: %+v", list)
	}
	assertError(t, do(t, h, "DELETE", "/api/shopping/stores/"+market.ID, ""), http.StatusNotFound)
}

func TestStapleEndpoints(t *testing.T) {
	h, _ := newTestAPI(t)
	for _, text := range []string{"Kaffee", "Spülmittel", "Reis"} {
		do(t, h, "POST", "/api/shopping/staples", fmt.Sprintf(`{"text":%q}`, text))
	}
	staples := decode[[]store.Staple](t, do(t, h, "GET", "/api/shopping/staples", ""))
	if len(staples) != 3 {
		t.Fatalf("vorrat = %+v", staples)
	}
	list := shoppingOf(t, do(t, h, "POST", "/api/shopping/staples/add", fmt.Sprintf(`{"ids":[%q,%q]}`, staples[0].ID, staples[2].ID)))
	if len(list.Items) != 2 {
		t.Errorf("liste = %+v", list.Items)
	}
	findItem(t, list, "Kaffee")
	findItem(t, list, "Reis")

	if got := decode[[]store.Staple](t, do(t, h, "DELETE", "/api/shopping/staples/"+staples[1].ID, "")); len(got) != 2 {
		t.Errorf("nach dem Löschen: %+v", got)
	}
	assertError(t, do(t, h, "DELETE", "/api/shopping/staples/st-fehlt", ""), http.StatusNotFound)
	assertError(t, do(t, h, "POST", "/api/shopping/staples/add", `{"ids":["st-fehlt"]}`), http.StatusNotFound)
	assertError(t, do(t, h, "POST", "/api/shopping/staples", `{"text":""}`), http.StatusUnprocessableEntity)
}
