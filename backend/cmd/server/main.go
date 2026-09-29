// Der Essenplaner-Server liefert die JSON-API und das eingebettete Frontend aus.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/httpapi"
	"github.com/felikowski/essenplaner/backend/internal/seed"
	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/web"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server beendet", "err", err)
		os.Exit(1)
	}
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

	api := httpapi.NewServer(db, db, db, logger)
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
		logger.Info("essenplaner lauscht", "port", cfg.Port, "database", cfg.DatabasePath)
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
