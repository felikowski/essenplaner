## 1. Backend und Image

- [ ] 1.1 Version ins Binary einbetten (`main.version`, Standard `dev`) und in `/healthz` als `version` ausgeben; httptest-Test prüft `{"status":"ok","version":"dev"}` sowie die Version, die beim Erzeugen des Servers übergeben wird
- [ ] 1.2 Unterbefehl `essenplaner healthcheck` (fragt `http://127.0.0.1:$PORT/healthz` ab, Exit-Code 0/1, Timeout 3 s); Test gegen einen httptest-Server für gesund, 503 und nicht erreichbar
- [ ] 1.3 `Dockerfile` um `ARG VERSION` und das Label `org.opencontainers.image.source` erweitern; `docker build --build-arg VERSION=test` und danach `docker run` zeigen `"version":"test"` unter `/healthz`

## 2. Compose-Datei

- [ ] 2.1 `deploy/docker-compose.yml` nach design.md anlegen (Image mit `${ESSENPLANER_TAG:?}`, `env_file`, Volume `essenplaner_data`, `restart: unless-stopped`, Health-Check, nur Netz `root_default`, Traefik-Labels inklusive HTTP→HTTPS-Router); `docker compose config` mit einer Dummy-`production.env` läuft ohne Fehler
- [ ] 2.2 Lokal nachstellen: mit einem lokal gebauten Image, einem Dummy-Netz `root_default` und einer Test-`production.env` startet `docker compose up -d --wait`, der Container wird `healthy`, und die Daten überstehen `docker compose down` und `up` (ohne `-v`); danach aufräumen

## 3. Workflows

- [ ] 3.1 `.github/workflows/ci.yml`: bei `pull_request` und bei Pushes außer auf `main`, zusätzlich als `workflow_call`; Go (`vet`, `test`), Frontend (`npm ci`, `test`, `lint`, `build`) und `docker compose config` für `deploy/docker-compose.yml`; ein Pull Request mit diesem Workflow läuft grün
- [ ] 3.2 `.github/workflows/deploy.yml`: Jobs `test` (ruft `ci.yml` auf) → `image` (Buildx, `linux/amd64`, GHA-Cache, Tags `sha-<sha>` und `main`, `VERSION=<sha>`) → `deploy` (Environment `production`, `concurrency: deploy-production`, festgelegte `known_hosts`, `scp` der Compose-Datei, `.env` mit dem Tag, `pull` und `up -d --wait`, danach bis zu 2 Minuten Abfrage der öffentlichen `/healthz`, bis die Version übereinstimmt); leere Secrets brechen mit klarer Meldung ab
- [ ] 3.3 Rollback-Pfad in `deploy.yml`: `workflow_dispatch` mit optionaler Eingabe `sha`. Ist sie gesetzt, werden `test` und `image` übersprungen, `docker manifest inspect` prüft `sha-<sha>`, und dieses Image wird deployt; mit `actionlint` prüfen, dass beide Pfade (Push und manueller Start mit und ohne `sha`) gültig sind

## 4. Anleitung und einmalige Einrichtung

- [ ] 4.1 `docs/deployment.md`: Voraussetzungen (Auth0-Produktionsanwendung mit URLs), Einrichtung auf dem VPS (`/docker/essenplaner/`, `/etc/essenplaner/production.env` mit `0600`, Public Key), GitHub-Environment und Secrets inklusive `known_hosts`, Sichtbarkeit des GHCR-Pakets, Reihenfolge „erst einrichten, dann mergen“, Rollback, Logs ansehen, manuelles Backup mit `sqlite3 .backup`; README verweist darauf und ersetzt den Warnhinweis
- [ ] 4.2 CI-Schlüsselpaar erzeugen, Private Key und `known_hosts` als Secrets im Environment `production` hinterlegen und dir den Public Key zum Eintragen geben (nicht selbst auf dem VPS eintragen)
- [ ] 4.3 Mit dir gemeinsam (nur lesend, nach deiner Freigabe) auf dem VPS nachsehen: Architektur (`uname -m`), Name des HTTP-Entrypoints und ob Traefik bereits global auf HTTPS umleitet; `deploy/docker-compose.yml` und design.md bei Bedarf anpassen

## 5. Erster Livegang

- [ ] 5.1 Nach deiner Einrichtung (Env-Datei, Public Key, Auth0-URLs) den Pull Request mergen und den ersten Lauf von `deploy.yml` verfolgen; GHCR-Paket auf öffentlich stellen, falls nötig, und den Lauf wiederholen
- [ ] 5.2 Live prüfen: `https://essenplaner.srv1115517.hstgr.cloud` lädt ohne Zertifikatswarnung, HTTP leitet auf HTTPS um, `/healthz` meldet den Commit, Login mit freigegebenem Konto funktioniert, eine Zuordnung übersteht ein weiteres Deployment
- [ ] 5.3 Rollback einmal ausprobieren: `deploy.yml` mit dem vorherigen Commit-Hash starten, `/healthz` meldet ihn, die Daten sind unverändert; danach wieder auf den aktuellen Stand deployen
