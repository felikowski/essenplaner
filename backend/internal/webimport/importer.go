package webimport

import (
	"context"
	"net/url"

	"github.com/felikowski/essenplaner/backend/internal/safefetch"
)

// Result ist ein von einer Webseite gelesenes Rezept samt der Adresse, unter der es als Duplikat erkannt wird.
type Result struct {
	CanonicalURL string
	Recipe       Recipe
}

// Importer ruft Rezeptseiten über einen abgesicherten Client ab und liest ihre Rezeptdaten.
type Importer struct {
	Client *safefetch.Client
}

// Import lädt die Seite und liest das Rezept. Fehler sind safefetch.ErrInvalidURL, ErrBlocked, ErrFetch,
// ErrTooLarge oder ErrNoRecipe.
func (i Importer) Import(ctx context.Context, u *url.URL) (*Result, error) {
	page, err := i.Client.Fetch(ctx, u)
	if err != nil {
		return nil, err
	}
	parsed, err := Parse(page.Body, page.URL)
	if err != nil {
		return nil, err
	}
	return &Result{CanonicalURL: CanonicalURL(parsed, page.URL), Recipe: parsed.Recipe}, nil
}
