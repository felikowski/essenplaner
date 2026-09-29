.PHONY: dev dev-backend dev-frontend test build frontend clean

BIN := backend/bin/essenplaner
WEB_DIST := backend/internal/web/dist

## dev: Backend (Port 8080) und Vite-Dev-Server (Port 5173, leitet /api weiter) parallel starten
dev:
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend:
	cd backend && go run ./cmd/server

dev-frontend: frontend/node_modules
	cd frontend && npm run dev

## test: Go-Tests und go vet, Frontend-Tests und Lint
test: frontend/node_modules
	cd backend && go vet ./... && go test ./...
	cd frontend && npm test && npm run lint

## build: Frontend bauen, einbetten und ein einzelnes Binary nach backend/bin/ erzeugen
build: frontend
	find $(WEB_DIST) -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
	cp -R frontend/dist/. $(WEB_DIST)/
	cd backend && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/essenplaner ./cmd/server
	@echo "Fertig: $(BIN)"

frontend: frontend/node_modules
	cd frontend && npm run build

frontend/node_modules: frontend/package-lock.json
	cd frontend && npm ci
	@touch $@

clean:
	rm -rf backend/bin frontend/dist
	find $(WEB_DIST) -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
