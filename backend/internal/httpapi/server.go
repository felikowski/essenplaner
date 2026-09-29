// Package httpapi stellt die JSON-API unter /api/ und den Health-Check bereit.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/felikowski/essenplaner/backend/internal/isoweek"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

const maxBodyBytes = 1 << 20

type HealthChecker interface {
	Ping(ctx context.Context) error
}

type Server struct {
	recipes store.RecipeStore
	plans   store.PlanStore
	health  HealthChecker
	logger  *slog.Logger
}

func NewServer(recipes store.RecipeStore, plans store.PlanStore, health HealthChecker, logger *slog.Logger) *Server {
	return &Server{recipes: recipes, plans: plans, health: health, logger: logger}
}

// Handler liefert den vollständigen Router. static beantwortet alle Pfade außerhalb
// von /api/ und /healthz (das eingebettete Frontend); nil bedeutet nur API.
func (s *Server) Handler(static http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/recipes", s.handleListRecipes)
	mux.HandleFunc("GET /api/recipes/{id}", s.handleGetRecipe)
	mux.HandleFunc("GET /api/weeks/{week}", s.handleGetWeek)
	mux.HandleFunc("PUT /api/days/{date}", s.handleSetDay)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	mux.HandleFunc("GET /healthz", s.handleHealth)
	if static != nil {
		mux.Handle("/", static)
	}
	return Logging(s.logger, Recover(s.logger, mux))
}

// internalError protokolliert den Fehler und antwortet ohne technische Details.
func (s *Server) internalError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Error("interner fehler", "method", r.Method, "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}

func (s *Server) handleListRecipes(w http.ResponseWriter, r *http.Request) {
	recipes, err := s.recipes.ListRecipes(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, recipes)
}

func (s *Server) handleGetRecipe(w http.ResponseWriter, r *http.Request) {
	recipe, err := s.recipes.GetRecipe(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "recipe not found")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, recipe)
}

// weekPlan entspricht dem Typ WeekPlan im Frontend: alle sieben Tage, leere Tage sind null.
type weekPlan struct {
	Week string             `json:"week"`
	Days map[string]*string `json:"days"`
}

func (s *Server) loadWeek(ctx context.Context, week isoweek.Week) (weekPlan, error) {
	days := week.Days()
	planned, err := s.plans.PlannedDays(ctx, days[0], days[len(days)-1])
	if err != nil {
		return weekPlan{}, err
	}
	plan := weekPlan{Week: week.String(), Days: make(map[string]*string, len(days))}
	for _, date := range days {
		if recipeID, ok := planned[date]; ok {
			plan.Days[date] = &recipeID
		} else {
			plan.Days[date] = nil
		}
	}
	return plan, nil
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

func (s *Server) handleSetDay(w http.ResponseWriter, r *http.Request) {
	date, err := isoweek.ParseDate(r.PathValue("date"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid date, expected YYYY-MM-DD")
		return
	}
	recipeID, err := decodeSetDay(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	err = s.plans.SetDay(r.Context(), isoweek.FormatDate(date), recipeID)
	if errors.Is(err, store.ErrUnknownRecipe) {
		writeError(w, http.StatusUnprocessableEntity, "unknown recipeId")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}

	plan, err := s.loadWeek(r.Context(), isoweek.Of(date))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

// decodeSetDay liest {"recipeId": "<id>"} oder {"recipeId": null}.
func decodeSetDay(body io.Reader) (*string, error) {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(body).Decode(&raw); err != nil {
		return nil, errors.New("invalid JSON body")
	}
	value, ok := raw["recipeId"]
	if !ok {
		return nil, errors.New(`body must contain "recipeId"`)
	}
	var recipeID *string
	if err := json.Unmarshal(value, &recipeID); err != nil {
		return nil, errors.New(`"recipeId" must be a string or null`)
	}
	if recipeID != nil && *recipeID == "" {
		return nil, errors.New(`"recipeId" must not be empty`)
	}
	return recipeID, nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.health.Ping(r.Context()); err != nil {
		s.logger.Error("health-check fehlgeschlagen", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
