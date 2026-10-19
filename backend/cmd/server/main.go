// Der Essenplaner-Server liefert die JSON-API und das eingebettete Frontend aus.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/auth"
	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/healthcheck"
	"github.com/felikowski/essenplaner/backend/internal/httpapi"
	"github.com/felikowski/essenplaner/backend/internal/safefetch"
	"github.com/felikowski/essenplaner/backend/internal/seed"
	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/voice"
	"github.com/felikowski/essenplaner/backend/internal/web"
	"github.com/felikowski/essenplaner/backend/internal/webimport"
)

// version wird beim Build per -ldflags "-X main.version=<commit>" gesetzt.
var version = "dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthcheck())
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server beendet", "err", err)
		os.Exit(1)
	}
}

// runHealthcheck prüft den laufenden Server im selben Container (Exit-Code 0 oder 1).
func runHealthcheck() int {
	port, err := config.PortFromEnv(os.Getenv)
	if err == nil {
		err = healthcheck.Check(context.Background(), healthcheck.URL(port))
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	return 0
}

func run(logger *slog.Logger) error {
	cfg, err := config.FromEnv(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DatabasePath)
	if err != nil {
		return err
	}
	defer db.Close()

	seeded, err := seed.Run(ctx, db)
	if err != nil {
		return err
	}
	if seeded {
		logger.Info("beispielrezepte angelegt")
	}

	importer := webimport.Importer{Client: safefetch.New(safefetch.Options{UserAgent: "Essenplaner/1.0"})}
	authService := auth.New(cfg.Auth, db, logger, auth.Options{})
	api := httpapi.NewServer(httpapi.StoresFrom(db), logger).
		WithImporter(importer).
		WithVersion(version).
		WithAuth(authService, strings.HasPrefix(cfg.Auth.PublicURL, "https://"))
	if cfg.Voice.Enabled() {
		api.WithVoice(voice.NewOpenAI(cfg.Voice.APIKey, cfg.Voice.TranscribeModel, cfg.Voice.ParseModel))
	}
	server := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           api.Handler(web.Handler(web.Dist())),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		logger.Info("essenplaner lauscht", "version", version, "port", cfg.Port, "public_url", cfg.Auth.PublicURL, "allowed_subjects", len(cfg.Auth.AllowedSubjects), "database", cfg.DatabasePath, "voice", cfg.Voice.Enabled())
		errc <- server.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	logger.Info("fahre herunter")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
