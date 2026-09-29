package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("antwort schreiben", "err", err)
	}
}

// writeError schreibt {"error": message}. Für Status 500 immer "internal error" verwenden (siehe internalError).
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorBody{Error: message})
}
