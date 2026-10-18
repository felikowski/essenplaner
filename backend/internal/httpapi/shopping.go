package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/felikowski/essenplaner/backend/internal/isoweek"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

func (s *Server) routeShopping(mux *routes) {
	mux.HandleFunc("GET /api/shopping/list", s.handleShoppingList)
	mux.HandleFunc("POST /api/shopping/items", s.handleAddShoppingItem)
	mux.HandleFunc("PATCH /api/shopping/items/{id}", s.handleUpdateShoppingItem)
	mux.HandleFunc("PUT /api/shopping/items/{id}/checked", s.handleCheckShoppingItem)
	mux.HandleFunc("DELETE /api/shopping/items/{id}", s.handleDeleteShoppingItem)
	mux.HandleFunc("POST /api/shopping/items/{id}/merge-into/{targetId}", s.handleMergeShoppingItem)
	mux.HandleFunc("POST /api/shopping/import", s.handleImportShopping)
	mux.HandleFunc("POST /api/shopping/clear-checked", s.handleClearChecked)
	mux.HandleFunc("POST /api/shopping/categories", s.handleCreateCategory)
	mux.HandleFunc("PUT /api/shopping/categories/order", s.handleReorderCategories)
	mux.HandleFunc("PATCH /api/shopping/categories/{id}", s.handleRenameCategory)
	mux.HandleFunc("DELETE /api/shopping/categories/{id}", s.handleDeleteCategory)
	mux.HandleFunc("POST /api/shopping/stores", s.handleCreateShop)
	mux.HandleFunc("PATCH /api/shopping/stores/{id}", s.handleRenameShop)
	mux.HandleFunc("DELETE /api/shopping/stores/{id}", s.handleDeleteShop)
	mux.HandleFunc("GET /api/shopping/aliases", s.handleListAliases)
	mux.HandleFunc("DELETE /api/shopping/aliases/{fromKey}", s.handleDeleteAlias)
	mux.HandleFunc("GET /api/shopping/staples", s.handleListStaples)
	mux.HandleFunc("POST /api/shopping/staples", s.handleCreateStaple)
	mux.HandleFunc("DELETE /api/shopping/staples/{id}", s.handleDeleteStaple)
	mux.HandleFunc("POST /api/shopping/staples/add", s.handleAddStaples)
}

func etag(version int) string {
	return `"v` + strconv.Itoa(version) + `"`
}

// handleShoppingList liefert die Liste mit ETag und beantwortet eine unveränderte Liste mit 304.
func (s *Server) handleShoppingList(w http.ResponseWriter, r *http.Request) {
	version, err := s.shopping.ShoppingVersion(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	if r.Header.Get("If-None-Match") == etag(version) {
		w.Header().Set("ETag", etag(version))
		w.WriteHeader(http.StatusNotModified)
		return
	}
	s.respondShoppingList(w, r, http.StatusOK)
}

func (s *Server) respondShoppingList(w http.ResponseWriter, r *http.Request, status int) {
	list, err := s.shopping.ShoppingList(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	w.Header().Set("ETag", etag(list.Version))
	writeJSON(w, status, list)
}

// decodeBody liest einen JSON-Body und antwortet bei Fehlern selbst mit 400.
func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

// writeShoppingError beantwortet Fehler der Einkaufsliste und meldet, ob es einen gab.
func (s *Server) writeShoppingError(w http.ResponseWriter, r *http.Request, err error) bool {
	var invalid store.ErrInvalidShopping
	switch {
	case err == nil:
		return false
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.As(err, &invalid):
		writeError(w, http.StatusUnprocessableEntity, invalid.Reason)
	default:
		s.internalError(w, r, err)
	}
	return true
}

// listAfter antwortet nach einer Änderung mit der vollständigen Liste.
func (s *Server) listAfter(w http.ResponseWriter, r *http.Request, err error) {
	if s.writeShoppingError(w, r, err) {
		return
	}
	s.respondShoppingList(w, r, http.StatusOK)
}

type textBody struct {
	Text *string `json:"text"`
}

func (s *Server) handleAddShoppingItem(w http.ResponseWriter, r *http.Request) {
	var body textBody
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Text == nil {
		writeError(w, http.StatusBadRequest, `"text" is required`)
		return
	}
	s.listAfter(w, r, s.shopping.AddShoppingItem(r.Context(), *body.Text))
}

func (s *Server) handleUpdateShoppingItem(w http.ResponseWriter, r *http.Request) {
	var raw map[string]json.RawMessage
	if !decodeBody(w, r, &raw) {
		return
	}
	var patch store.ShoppingItemPatch
	for key, value := range raw {
		var target **string
		switch key {
		case "name":
			target = &patch.Name
		case "quantity":
			target = &patch.Quantity
		case "categoryId":
			target = &patch.CategoryID
		case "storeId":
			target = &patch.StoreID
			patch.SetStore = true
		default:
			writeError(w, http.StatusBadRequest, "unknown field "+key)
			return
		}
		if err := json.Unmarshal(value, target); err != nil || (*target == nil && key != "storeId") {
			writeError(w, http.StatusBadRequest, `"`+key+`" must be a string`)
			return
		}
	}
	s.listAfter(w, r, s.shopping.UpdateShoppingItem(r.Context(), r.PathValue("id"), patch))
}

func (s *Server) handleCheckShoppingItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Checked *bool `json:"checked"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Checked == nil {
		writeError(w, http.StatusBadRequest, `"checked" must be true or false`)
		return
	}
	s.listAfter(w, r, s.shopping.SetShoppingItemChecked(r.Context(), r.PathValue("id"), *body.Checked))
}

func (s *Server) handleDeleteShoppingItem(w http.ResponseWriter, r *http.Request) {
	s.listAfter(w, r, s.shopping.DeleteShoppingItem(r.Context(), r.PathValue("id")))
}

func (s *Server) handleMergeShoppingItem(w http.ResponseWriter, r *http.Request) {
	s.listAfter(w, r, s.shopping.MergeShoppingItem(r.Context(), r.PathValue("id"), r.PathValue("targetId")))
}

func (s *Server) handleImportShopping(w http.ResponseWriter, r *http.Request) {
	var body struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	from, err1 := isoweek.ParseDate(body.From)
	to, err2 := isoweek.ParseDate(body.To)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, `"from" and "to" must be dates like 2026-10-02`)
		return
	}
	if to.Before(from) {
		writeError(w, http.StatusUnprocessableEntity, "Das Ende des Zeitraums liegt vor dem Anfang.")
		return
	}
	if to.Sub(from).Hours() > 24*62 {
		writeError(w, http.StatusUnprocessableEntity, "Der Zeitraum darf höchstens zwei Monate umfassen.")
		return
	}
	without, err := s.shopping.ImportFromPlan(r.Context(), isoweek.FormatDate(from), isoweek.FormatDate(to))
	if s.writeShoppingError(w, r, err) {
		return
	}
	list, err := s.shopping.ShoppingList(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	w.Header().Set("ETag", etag(list.Version))
	writeJSON(w, http.StatusOK, struct {
		List               store.ShoppingList `json:"list"`
		WithoutIngredients []store.RecipeRef  `json:"withoutIngredients"`
	}{list, without})
}

func (s *Server) handleClearChecked(w http.ResponseWriter, r *http.Request) {
	s.listAfter(w, r, s.shopping.ClearCheckedShoppingItems(r.Context()))
}

type nameBody struct {
	Name *string `json:"name"`
}

// decodeName liest {"name": "…"} und antwortet bei Fehlern selbst.
func decodeName(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body nameBody
	if !decodeBody(w, r, &body) {
		return "", false
	}
	if body.Name == nil {
		writeError(w, http.StatusBadRequest, `"name" is required`)
		return "", false
	}
	return *body.Name, true
}

func (s *Server) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	if name, ok := decodeName(w, r); ok {
		s.listAfter(w, r, s.shopping.CreateShoppingCategory(r.Context(), name))
	}
}

func (s *Server) handleRenameCategory(w http.ResponseWriter, r *http.Request) {
	if name, ok := decodeName(w, r); ok {
		s.listAfter(w, r, s.shopping.RenameShoppingCategory(r.Context(), r.PathValue("id"), name))
	}
}

func (s *Server) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	s.listAfter(w, r, s.shopping.DeleteShoppingCategory(r.Context(), r.PathValue("id")))
}

func (s *Server) handleReorderCategories(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	s.listAfter(w, r, s.shopping.ReorderShoppingCategories(r.Context(), body.IDs))
}

func (s *Server) handleCreateShop(w http.ResponseWriter, r *http.Request) {
	if name, ok := decodeName(w, r); ok {
		s.listAfter(w, r, s.shopping.CreateShop(r.Context(), name))
	}
}

func (s *Server) handleRenameShop(w http.ResponseWriter, r *http.Request) {
	if name, ok := decodeName(w, r); ok {
		s.listAfter(w, r, s.shopping.RenameShop(r.Context(), r.PathValue("id"), name))
	}
}

func (s *Server) handleDeleteShop(w http.ResponseWriter, r *http.Request) {
	s.listAfter(w, r, s.shopping.DeleteShop(r.Context(), r.PathValue("id")))
}

func (s *Server) respondAliases(w http.ResponseWriter, r *http.Request) {
	aliases, err := s.shopping.ShoppingAliases(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, aliases)
}

func (s *Server) handleListAliases(w http.ResponseWriter, r *http.Request) {
	s.respondAliases(w, r)
}

func (s *Server) handleDeleteAlias(w http.ResponseWriter, r *http.Request) {
	if s.writeShoppingError(w, r, s.shopping.DeleteShoppingAlias(r.Context(), r.PathValue("fromKey"))) {
		return
	}
	s.respondAliases(w, r)
}

func (s *Server) respondStaples(w http.ResponseWriter, r *http.Request) {
	staples, err := s.shopping.Staples(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, staples)
}

func (s *Server) handleListStaples(w http.ResponseWriter, r *http.Request) {
	s.respondStaples(w, r)
}

func (s *Server) handleCreateStaple(w http.ResponseWriter, r *http.Request) {
	var body textBody
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Text == nil {
		writeError(w, http.StatusBadRequest, `"text" is required`)
		return
	}
	if s.writeShoppingError(w, r, s.shopping.CreateStaple(r.Context(), *body.Text)) {
		return
	}
	s.respondStaples(w, r)
}

func (s *Server) handleDeleteStaple(w http.ResponseWriter, r *http.Request) {
	if s.writeShoppingError(w, r, s.shopping.DeleteStaple(r.Context(), r.PathValue("id"))) {
		return
	}
	s.respondStaples(w, r)
}

func (s *Server) handleAddStaples(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	s.listAfter(w, r, s.shopping.AddStaplesToList(r.Context(), body.IDs))
}
