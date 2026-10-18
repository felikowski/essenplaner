// Package healthcheck prüft von innen, ob der laufende Server gesund ist.
// Das distroless-Image enthält kein curl, deshalb übernimmt das Binary selbst
// den Health-Check des Containers (`essenplaner healthcheck`).
package healthcheck

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

const Timeout = 3 * time.Second

// Check ruft url auf und meldet einen Fehler, wenn der Server nicht innerhalb
// von Timeout mit Status 200 antwortet.
func Check(ctx context.Context, url string) error {
	ctx, cancel := context.WithTimeout(ctx, Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s antwortet mit Status %d", url, resp.StatusCode)
	}
	return nil
}

// URL liefert die Adresse des Health-Checks für den lokalen Server auf port.
func URL(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d/healthz", port)
}
