package healthcheck

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheck(t *testing.T) {
	healthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer healthy.Close()
	if err := Check(context.Background(), healthy.URL+"/healthz"); err != nil {
		t.Errorf("gesunder Server: %v", err)
	}

	unavailable := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer unavailable.Close()
	if err := Check(context.Background(), unavailable.URL+"/healthz"); err == nil {
		t.Error("503: Fehler erwartet")
	}

	gone := httptest.NewServer(http.NotFoundHandler())
	url := gone.URL + "/healthz"
	gone.Close()
	if err := Check(context.Background(), url); err == nil {
		t.Error("nicht erreichbar: Fehler erwartet")
	}
}

func TestURL(t *testing.T) {
	if got := URL(8080); got != "http://127.0.0.1:8080/healthz" {
		t.Errorf("URL(8080) = %q", got)
	}
}
