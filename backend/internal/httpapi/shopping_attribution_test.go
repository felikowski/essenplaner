package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/auth"
	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/store"
)

// Wer etwas einträgt, kommt aus der Sitzung; ausgeliefert wird nur der Name, nie die Auth0-Kennung.
func TestShoppingAddedByFromSession(t *testing.T) {
	_, db := newTestAPI(t)
	const subject = "auth0|linh-4711"
	cfg := config.Auth{Domain: "auth.example", ClientID: "id", ClientSecret: "secret", PublicURL: "https://essenplaner.example", AllowedSubjects: []string{subject}}
	h := NewServer(StoresFrom(db), quietLogger()).WithAuth(auth.New(cfg, db, quietLogger(), auth.Options{}), true).Handler(nil)

	sum := sha256.Sum256([]byte("sitzung-linh"))
	now := time.Now()
	if err := db.CreateSession(context.Background(), hex.EncodeToString(sum[:]),
		store.Session{Subject: subject, Name: "linh", CreatedAt: now, LastSeenAt: now}); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("POST", "/api/shopping/items", strings.NewReader(`{"text":"Feta"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://essenplaner.example")
	req.AddCookie(&http.Cookie{Name: "essenplaner_session", Value: "sitzung-linh"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if strings.Contains(rec.Body.String(), subject) {
		t.Errorf("antwort enthält die kennung: %s", rec.Body.String())
	}
	feta := findItem(t, shoppingOf(t, rec), "Feta")
	if len(feta.Sources) != 1 || feta.Sources[0].AddedBy != "linh" || feta.SourceDisplay == nil {
		t.Errorf("feta = %+v", feta)
	}
}

func TestShoppingWithoutSessionHasNoAddedBy(t *testing.T) {
	h, _ := newTestAPI(t)
	rec := do(t, h, "POST", "/api/shopping/items", `{"text":"Feta"}`)
	if strings.Contains(rec.Body.String(), "addedBy") {
		t.Errorf("ohne sitzung: %s", rec.Body.String())
	}
}
