package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"

	"github.com/felikowski/essenplaner/backend/internal/isoweek"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

// weekPlan entspricht dem Typ WeekPlan im Frontend: alle sieben Tage, jeweils mit ihren Einträgen.
type weekPlan struct {
	Week string                   `json:"week"`
	Days map[string][]store.Entry `json:"days"`
}

// weeksResponse ist die Antwort aller Änderungen an Einträgen: die Pläne der betroffenen Wochen.
type weeksResponse struct {
	Weeks []weekPlan `json:"weeks"`
}

func (s *Server) loadWeek(ctx context.Context, week isoweek.Week) (weekPlan, error) {
	days := week.Days()
	entries, err := s.plans.Entries(ctx, days[0], days[len(days)-1])
	if err != nil {
		return weekPlan{}, err
	}
	plan := weekPlan{Week: week.String(), Days: make(map[string][]store.Entry, len(days))}
	for _, date := range days {
		plan.Days[date] = entries[date]
		if plan.Days[date] == nil {
			plan.Days[date] = []store.Entry{}
		}
	}
	return plan, nil
}

// loadWeeksOf liefert die Pläne aller Wochen, in die die Daten fallen, ohne doppelte.
func (s *Server) loadWeeksOf(ctx context.Context, dates ...string) (weeksResponse, error) {
	response := weeksResponse{Weeks: []weekPlan{}}
	var seen []string
	for _, date := range dates {
		t, err := isoweek.ParseDate(date)
		if err != nil {
			continue
		}
		week := isoweek.Of(t)
		if slices.Contains(seen, week.String()) {
			continue
		}
		seen = append(seen, week.String())
		plan, err := s.loadWeek(ctx, week)
		if err != nil {
			return weeksResponse{}, err
		}
		response.Weeks = append(response.Weeks, plan)
	}
	return response, nil
}

func (s *Server) handleGetWeek(w http.ResponseWriter, r *http.Request) {
	week, err := isoweek.ParseWeek(r.PathValue("week"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid week, expected YYYY-Www")
		return
	}
	plan, err := s.loadWeek(r.Context(), week)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

type createEntryBody struct {
	Date       string `json:"date"`
	Meal       string `json:"meal"`
	Kind       string `json:"kind"`
	RecipeID   string `json:"recipeId"`
	Servings   *int   `json:"servings"`
	Text       string `json:"text"`
	LeftoverOf string `json:"leftoverOf"`
}

func (s *Server) handleCreateEntry(w http.ResponseWriter, r *http.Request) {
	var body createEntryBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	date, err := isoweek.ParseDate(body.Date)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid date, expected YYYY-MM-DD")
		return
	}
	if !store.IsMeal(body.Meal) {
		writeError(w, http.StatusBadRequest, "meal must be breakfast, lunch, dinner or snack")
		return
	}
	if !store.IsEntryKind(body.Kind) {
		writeError(w, http.StatusBadRequest, "kind must be recipe, note, item or leftover")
		return
	}
	if body.Servings != nil && (*body.Servings < 1 || *body.Servings > 99) {
		writeFieldError(w, fieldError{"servings", "Portionen müssen eine ganze Zahl von 1 bis 99 sein."})
		return
	}

	entry, err := s.plans.CreateEntry(r.Context(), store.EntryInput{
		Date: isoweek.FormatDate(date), Meal: body.Meal, Kind: body.Kind, RecipeID: body.RecipeID,
		Servings: body.Servings, Text: body.Text, LeftoverOf: body.LeftoverOf,
	})
	if s.writeEntryError(w, r, err) {
		return
	}
	s.respondWeeks(w, r, http.StatusCreated, entry.Date)
}

func (s *Server) handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	patch, err := decodeEntryPatch(raw)
	if err != nil {
		var fe fieldError
		if errors.As(err, &fe) {
			writeFieldError(w, fe)
		} else {
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}
	before, after, err := s.plans.UpdateEntry(r.Context(), r.PathValue("id"), patch)
	if s.writeEntryError(w, r, err) {
		return
	}
	s.respondWeeks(w, r, http.StatusOK, before.Date, after.Date)
}

func decodeEntryPatch(raw map[string]json.RawMessage) (store.EntryPatch, error) {
	var patch store.EntryPatch
	for key, value := range raw {
		switch key {
		case "date":
			var s string
			if json.Unmarshal(value, &s) != nil {
				return patch, errors.New("invalid date, expected YYYY-MM-DD")
			}
			date, err := isoweek.ParseDate(s)
			if err != nil {
				return patch, errors.New("invalid date, expected YYYY-MM-DD")
			}
			formatted := isoweek.FormatDate(date)
			patch.Date = &formatted
		case "meal":
			var meal string
			if json.Unmarshal(value, &meal) != nil || !store.IsMeal(meal) {
				return patch, errors.New("meal must be breakfast, lunch, dinner or snack")
			}
			patch.Meal = &meal
		case "servings":
			var servings *int
			if json.Unmarshal(value, &servings) != nil || (servings != nil && (*servings < 1 || *servings > 99)) {
				return patch, fieldError{"servings", "Portionen müssen eine ganze Zahl von 1 bis 99 sein."}
			}
			patch.SetServings, patch.Servings = true, servings
		case "text":
			var text string
			if json.Unmarshal(value, &text) != nil {
				return patch, errors.New(`"text" must be a string`)
			}
			patch.Text = &text
		default:
			return patch, errors.New("unknown field " + key)
		}
	}
	return patch, nil
}

func (s *Server) handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	dates, err := s.plans.DeleteEntry(r.Context(), r.PathValue("id"))
	if s.writeEntryError(w, r, err) {
		return
	}
	s.respondWeeks(w, r, http.StatusOK, dates...)
}

func (s *Server) handleCopyWeek(w http.ResponseWriter, r *http.Request) {
	from, err := isoweek.ParseWeek(r.PathValue("week"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid week, expected YYYY-Www")
		return
	}
	var body struct {
		To   string `json:"to"`
		Mode string `json:"mode"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	to, err := isoweek.ParseWeek(body.To)
	if err != nil {
		writeError(w, http.StatusBadRequest, `"to" must be a week like 2026-W42`)
		return
	}
	if body.Mode != "append" && body.Mode != "replace" {
		writeError(w, http.StatusBadRequest, `"mode" must be "append" or "replace"`)
		return
	}
	if from == to {
		writeError(w, http.StatusUnprocessableEntity, "Quell- und Zielwoche müssen verschieden sein.")
		return
	}

	skipped, err := s.plans.CopyWeek(r.Context(), from.Days(), to.Days(), body.Mode == "replace")
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	plan, err := s.loadWeek(r.Context(), to)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Week    weekPlan `json:"week"`
		Skipped int      `json:"skipped"`
	}{plan, skipped})
}

func (s *Server) handleRecipeHistory(w http.ResponseWriter, r *http.Request) {
	if _, err := s.recipes.GetRecipe(r.Context(), r.PathValue("id")); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "recipe not found")
		return
	} else if err != nil {
		s.internalError(w, r, err)
		return
	}
	dates, err := s.plans.RecipeHistory(r.Context(), r.PathValue("id"))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string][]string{"dates": dates})
}

// writeEntryError beantwortet Fehler beim Ändern von Einträgen und meldet, ob es einen gab.
func (s *Server) writeEntryError(w http.ResponseWriter, r *http.Request, err error) bool {
	var invalid store.ErrInvalidEntry
	switch {
	case err == nil:
		return false
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "entry not found")
	case errors.As(err, &invalid):
		writeError(w, http.StatusUnprocessableEntity, invalid.Reason)
	default:
		s.internalError(w, r, err)
	}
	return true
}

func (s *Server) respondWeeks(w http.ResponseWriter, r *http.Request, status int, dates ...string) {
	response, err := s.loadWeeksOf(r.Context(), dates...)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, status, response)
}

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.settings.Settings(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (s *Server) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var values map[string]json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&values); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	settings, err := s.settings.UpdateSettings(r.Context(), values)
	var invalid store.ErrInvalidSetting
	switch {
	case errors.As(err, &invalid):
		writeError(w, http.StatusUnprocessableEntity, invalid.Reason)
	case err != nil:
		s.internalError(w, r, err)
	default:
		writeJSON(w, http.StatusOK, settings)
	}
}
