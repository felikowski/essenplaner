package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/felikowski/essenplaner/backend/internal/isoweek"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

func (s *Server) routeMenus(mux *routes) {
	mux.HandleFunc("GET /api/menus", s.handleListMenus)
	mux.HandleFunc("POST /api/menus", s.handleCreateMenu)
	mux.HandleFunc("GET /api/menus/{id}", s.handleGetMenu)
	mux.HandleFunc("PATCH /api/menus/{id}", s.handleUpdateMenu)
	mux.HandleFunc("DELETE /api/menus/{id}", s.handleDeleteMenu)
	mux.HandleFunc("POST /api/menus/{id}/entries", s.handleCreateMenuEntry)
	mux.HandleFunc("PATCH /api/menus/{id}/entries/{entry}", s.handleUpdateMenuEntry)
	mux.HandleFunc("DELETE /api/menus/{id}/entries/{entry}", s.handleDeleteMenuEntry)
	mux.HandleFunc("POST /api/menus/{id}/days", s.handleAppendMenuDay)
	mux.HandleFunc("DELETE /api/menus/{id}/days/{day}", s.handleRemoveMenuDay)
	mux.HandleFunc("POST /api/menus/{id}/apply", s.handleApplyMenu)
}

func (s *Server) handleListMenus(w http.ResponseWriter, r *http.Request) {
	menus, err := s.menus.ListMenus(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, menus)
}

func (s *Server) handleGetMenu(w http.ResponseWriter, r *http.Request) {
	menu, err := s.menus.GetMenu(r.Context(), r.PathValue("id"))
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

type menuBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Days        int    `json:"days"`
	From        string `json:"from"`
	To          string `json:"to"`
}

func (s *Server) handleCreateMenu(w http.ResponseWriter, r *http.Request) {
	var body menuBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	var dates []string
	if body.From != "" || body.To != "" {
		var err error
		dates, err = dateRange(body.From, body.To)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	menu, err := s.menus.CreateMenu(r.Context(), store.MenuInput{Name: body.Name, Description: body.Description, Days: body.Days}, dates)
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusCreated, menu)
}

func (s *Server) handleUpdateMenu(w http.ResponseWriter, r *http.Request) {
	var body menuBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	menu, err := s.menus.UpdateMenu(r.Context(), r.PathValue("id"), store.MenuInput{Name: body.Name, Description: body.Description})
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

func (s *Server) handleDeleteMenu(w http.ResponseWriter, r *http.Request) {
	if s.writeMenuError(w, r, s.menus.DeleteMenu(r.Context(), r.PathValue("id"))) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type menuEntryBody struct {
	Day        int    `json:"day"`
	Meal       string `json:"meal"`
	Kind       string `json:"kind"`
	RecipeID   string `json:"recipeId"`
	Servings   *int   `json:"servings"`
	Text       string `json:"text"`
	LeftoverOf string `json:"leftoverOf"`
}

func (s *Server) handleCreateMenuEntry(w http.ResponseWriter, r *http.Request) {
	var body menuEntryBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if !store.IsMeal(body.Meal) || !store.IsEntryKind(body.Kind) {
		writeError(w, http.StatusBadRequest, "meal or kind is invalid")
		return
	}
	if body.Servings != nil && (*body.Servings < 1 || *body.Servings > 99) {
		writeFieldError(w, fieldError{"servings", "Portionen müssen eine ganze Zahl von 1 bis 99 sein."})
		return
	}
	menu, err := s.menus.CreateMenuEntry(r.Context(), r.PathValue("id"), store.MenuEntryInput{
		Day: body.Day, Meal: body.Meal, Kind: body.Kind, RecipeID: body.RecipeID,
		Servings: body.Servings, Text: body.Text, LeftoverOf: body.LeftoverOf,
	})
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusCreated, menu)
}

func (s *Server) handleUpdateMenuEntry(w http.ResponseWriter, r *http.Request) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	var patch store.MenuEntryPatch
	for key, value := range raw {
		switch key {
		case "day":
			var day int
			if json.Unmarshal(value, &day) != nil {
				writeError(w, http.StatusBadRequest, `"day" must be a number`)
				return
			}
			patch.Day = &day
		case "meal":
			var meal string
			if json.Unmarshal(value, &meal) != nil || !store.IsMeal(meal) {
				writeError(w, http.StatusBadRequest, "meal must be breakfast, lunch, dinner or snack")
				return
			}
			patch.Meal = &meal
		case "servings":
			var servings *int
			if json.Unmarshal(value, &servings) != nil || (servings != nil && (*servings < 1 || *servings > 99)) {
				writeFieldError(w, fieldError{"servings", "Portionen müssen eine ganze Zahl von 1 bis 99 sein."})
				return
			}
			patch.SetServings, patch.Servings = true, servings
		case "text":
			var text string
			if json.Unmarshal(value, &text) != nil {
				writeError(w, http.StatusBadRequest, `"text" must be a string`)
				return
			}
			patch.Text = &text
		default:
			writeError(w, http.StatusBadRequest, "unknown field "+key)
			return
		}
	}
	menu, err := s.menus.UpdateMenuEntry(r.Context(), r.PathValue("id"), r.PathValue("entry"), patch)
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

func (s *Server) handleDeleteMenuEntry(w http.ResponseWriter, r *http.Request) {
	menu, err := s.menus.DeleteMenuEntry(r.Context(), r.PathValue("id"), r.PathValue("entry"))
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

func (s *Server) handleAppendMenuDay(w http.ResponseWriter, r *http.Request) {
	menu, err := s.menus.AppendMenuDay(r.Context(), r.PathValue("id"))
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

func (s *Server) handleRemoveMenuDay(w http.ResponseWriter, r *http.Request) {
	day, err := strconv.Atoi(r.PathValue("day"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "day must be a number")
		return
	}
	menu, err := s.menus.RemoveMenuDay(r.Context(), r.PathValue("id"), day)
	if s.writeMenuError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, menu)
}

func (s *Server) handleApplyMenu(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Start string `json:"start"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	menu, err := s.menus.GetMenu(r.Context(), r.PathValue("id"))
	if s.writeMenuError(w, r, err) {
		return
	}
	start, err := isoweek.ParseDate(body.Start)
	if err != nil {
		writeError(w, http.StatusBadRequest, `"start" must be a date like 2026-10-12`)
		return
	}
	dates := make([]string, menu.Days)
	for i := range dates {
		dates[i] = isoweek.FormatDate(start.AddDate(0, 0, i))
	}
	skipped, err := s.menus.ApplyMenu(r.Context(), menu.ID, dates)
	if s.writeMenuError(w, r, err) {
		return
	}
	weeks, err := s.loadWeeksOf(r.Context(), dates...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Weeks   []weekPlan `json:"weeks"`
		Skipped []string   `json:"skipped"`
	}{weeks.Weeks, skipped})
}

func (s *Server) writeMenuError(w http.ResponseWriter, r *http.Request, err error) bool {
	var invalid store.ErrInvalidEntry
	switch {
	case err == nil:
		return false
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "menu not found")
	case errors.Is(err, store.ErrMenuNameExists):
		writeError(w, http.StatusUnprocessableEntity, "Ein Menü mit diesem Namen gibt es schon.")
	case errors.Is(err, store.ErrEmptyMenu):
		writeError(w, http.StatusUnprocessableEntity, "Im gewählten Zeitraum gibt es keine Einträge.")
	case errors.Is(err, store.ErrMenuDayLimit):
		writeError(w, http.StatusUnprocessableEntity, "Ein Menü muss zwischen 1 und 28 Tage haben.")
	case errors.As(err, &invalid):
		writeError(w, http.StatusUnprocessableEntity, invalid.Reason)
	default:
		s.internalError(w, r, err)
	}
	return true
}

func dateRange(fromValue, toValue string) ([]string, error) {
	from, err := isoweek.ParseDate(fromValue)
	if err != nil {
		return nil, errors.New(`"from" must be a date like 2026-10-12`)
	}
	to, err := isoweek.ParseDate(toValue)
	if err != nil {
		return nil, errors.New(`"to" must be a date like 2026-10-12`)
	}
	if to.Before(from) {
		return nil, errors.New(`"to" must not be before "from"`)
	}
	var dates []string
	for date := from; !date.After(to); date = date.AddDate(0, 0, 1) {
		dates = append(dates, isoweek.FormatDate(date))
		if len(dates) > 28 {
			return nil, errors.New("a menu can contain at most 28 days")
		}
	}
	return dates, nil
}
