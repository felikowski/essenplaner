# syntax=docker/dockerfile:1

# 1. Frontend bauen
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# Die Tests teilen sich Fälle mit dem Backend; tsc prüft sie beim Build mit.
COPY testdata/ /src/testdata/
COPY frontend/ ./
RUN npm run build

# 2. Go-Binary mit eingebettetem Frontend bauen (ohne cgo)
FROM golang:1.26-alpine AS backend
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /src/frontend/dist/ ./internal/web/dist/
# Commit, den /healthz als Version meldet (in CI: github.sha)
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/essenplaner ./cmd/server \
    && mkdir -p /out/data

# 3. Schlankes Laufzeit-Image
FROM gcr.io/distroless/static-debian12:nonroot
LABEL org.opencontainers.image.source=https://github.com/felikowski/essenplaner
COPY --from=backend /out/essenplaner /essenplaner
COPY --from=backend --chown=nonroot:nonroot /out/data /data
ENV PORT=8080 \
    DATABASE_PATH=/data/essenplaner.db
EXPOSE 8080
VOLUME /data
USER nonroot:nonroot
ENTRYPOINT ["/essenplaner"]
