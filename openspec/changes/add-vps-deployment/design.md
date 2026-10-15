## Context

Aus `add-go-backend` gibt es ein mehrstufiges `Dockerfile`: Es baut ein distroless-Image mit einem einzigen Binary, das API und Frontend ausliefert und seine Daten unter `/data` ablegt. Einen anwendungsseitigen Zugriffsschutz gibt es noch nicht. Deshalb wird der erste Livegang vorübergehend am Reverse Proxy mit HTTP Basic Auth geschützt; `add-auth0-login` löst diesen Schutz anschließend ab.

Auf dem Hostinger-VPS `srv1115517.hstgr.cloud` läuft bereits ein gemeinsamer Traefik. Er liegt als eigenes Compose-Projekt unter `/docker/traefik/`, hängt am externen Netz `root_default` und stellt TLS-Zertifikate über den Resolver `mytlschallenge` aus. Für `*.srv1115517.hstgr.cloud` gibt es schon einen Wildcard-DNS-Eintrag. Andere Dienste (n8n, Infisical, finops-staging) liegen jeweils als Compose-Projekt unter `/docker/<name>/`. Das Deployment von finops-staging (GHCR-Image, `scp` der Compose-Datei, `docker compose pull && up -d` per SSH) funktioniert und dient als Vorlage. Der VPS ist der kleinste Tarif mit 3,8 GB RAM.

## Goals / Non-Goals

**Goals:**
- Build once: Das in CI getestete Image ist genau das, was auf dem Server läuft. Auf dem VPS wird nichts gebaut.
- Der Server-Zustand, der nur einmal von Hand eingerichtet wird (Geheimnisse, Volume), ist klar von dem getrennt, was jedes Deployment überschreibt (Compose-Datei, Image-Tag)
- Ein fehlgeschlagenes Deployment fällt sofort auf, nicht erst, wenn die Familie die App öffnet
- Die noch nicht durch Auth0 geschützte Anwendung ist zu keinem Zeitpunkt frei zugänglich

**Non-Goals:**
- Staging-Umgebung oder Releases mit Versionsnummern: Es gibt genau eine Produktion, die `main` folgt
- Backups der SQLite-Datei: eigene Folge-Change, voraussichtlich über die vorhandene rclone-Pipeline nach Google Drive
- Monitoring und Alarmierung über den Health-Check hinaus (Uptime Kuma ist auf dem VPS vorbereitet, aber nicht aktiv)
- Deployments ohne Ausfallzeit: Ein Neustart von wenigen Sekunden ist für eine Familien-App in Ordnung
- Einrichtung des VPS selbst (Docker, Traefik)

## Decisions

**Zwei Workflows.** `ci.yml` testet: `go vet`/`go test`, Frontend-Tests und Lint, dazu eine Prüfung von `deploy/docker-compose.yml` mit `docker compose config`. Er läuft bei Pull Requests und bei Pushes auf andere Branches als `main`. Außerdem ist er als wiederverwendbarer Workflow (`workflow_call`) nutzbar. `deploy.yml` läuft bei Pushes auf `main` und bei manuellem Start (`workflow_dispatch`) und besteht aus drei Jobs: `test` ruft `ci.yml` auf, `image` baut und pusht, `deploy` liefert aus. Diese Jobs hängen per `needs` voneinander ab, ein Fehler stoppt also die Kette.
- Alternative: `workflow_run` wie bei finops (Deploy-Workflow startet nach dem Image-Workflow). Verworfen: Ein einziger Workflow mit `needs` zeigt den ganzen Ablauf in einem Lauf und vermeidet die Eigenheiten von `workflow_run` (läuft nur im Kontext des Default-Branches, zweiter Lauf in der UI).

**Image in GHCR, öffentlich.** Das Image heißt `ghcr.io/felikowski/essenplaner` und bekommt die Tags `sha-<vollständiger Hash>` (unveränderlich, wird deployt) und `main` (nur zur Orientierung). Das Repository ist öffentlich, das Image enthält keine Geheimnisse. Ein öffentliches Paket erspart Registry-Zugangsdaten auf dem VPS, wie bei finops. Das Label `org.opencontainers.image.source` verknüpft das Paket mit dem Repository. Gebaut wird nur `linux/amd64` für den KVM-VPS (Architektur beim Einrichten prüfen), mit GitHub-Actions-Cache für die Docker-Layer.

**Version im Binary.** Das `Dockerfile` erhält `ARG VERSION=dev` und baut mit `-ldflags "-X main.version=$VERSION"`. `deploy.yml` übergibt `github.sha`. `/healthz` antwortet mit `{"status":"ok","version":"<sha>"}`. Daran erkennt der Deploy-Job, dass wirklich die neue Version antwortet und nicht die alte, die noch läuft.

**Unterbefehl `healthcheck`.** Das distroless-Image enthält keine Shell und kein `curl`. `essenplaner healthcheck` ruft `http://127.0.0.1:$PORT/healthz` auf und endet mit Code 0 oder 1. Compose nutzt ihn als `healthcheck`. `docker compose up -d --wait` wartet dann, bis der Container gesund ist, und schlägt sonst fehl.

**Compose-Datei im Repository, Tag auf dem Server.** `deploy/docker-compose.yml` referenziert `ghcr.io/felikowski/essenplaner:${ESSENPLANER_TAG:?}`. Der Deploy-Job schreibt `/docker/essenplaner/.env` mit `ESSENPLANER_TAG=sha-<hash>`. Damit verwendet auch ein späteres manuelles `docker compose up -d` oder ein Neustart nach einem Reboot den zuletzt ausgelieferten Tag und nicht `latest`. Weitere Einstellungen:
- `restart: unless-stopped`, damit die App nach Reboots von Hostinger wieder anläuft
- Named Volume `essenplaner_data` unter `/data`. Das Image legt `/data` mit dem Nutzer `nonroot` an, Docker übernimmt beim ersten Anlegen des Volumes diese Rechte.
- `env_file: /etc/essenplaner/production.env`. Dort steht zunächst `ESSENPLANER_BASIC_AUTH_USERS` mit einem bcrypt-Hash für den temporären Zugang; `add-auth0-login` ergänzt später `AUTH0_*`, `ALLOWED_EMAILS` und `PUBLIC_URL`. Die Datei gehört `root` und hat die Rechte `0600`. Der Workflow fasst sie nie an, er kopiert gezielt nur die Compose-Datei (keine Verzeichnis-Synchronisierung). Für die Variablenersetzung liest Compose diese Datei zusätzlich mit `--env-file`; die automatisch geschriebene `.env` mit `ESSENPLANER_TAG` wird als zweites Env-File übergeben.
- kein `ports:`. Der Container hängt nur am Netz `root_default` und ist nur über Traefik erreichbar.
- Traefik-Labels nach dem Vorbild von finops: Router `essenplaner` mit ``Host(`essenplaner.srv1115517.hstgr.cloud`)``, `entrypoints=websecure`, `tls.certresolver=mytlschallenge`, Service-Port 8080 und ausdrücklich `traefik.docker.network=root_default` (Schutz vor dem bekannten Routing-Fehler, wenn ein Container an mehreren Netzen hängt). Am Router hängt zunächst die Middleware `essenplaner-bootstrap` mit `basicauth.users=${ESSENPLANER_BASIC_AUTH_USERS:?}`. Ein höher priorisierter Router nur für `/healthz` nutzt keine Middleware, damit der Deploy-Job die Version ohne Zugangsdaten prüfen kann. Dazu kommt ein weiterer Router auf dem HTTP-Entrypoint mit einer Middleware `redirectscheme` (`scheme=https`, `permanent=true`). Ob Traefik bereits global umleitet und wie der HTTP-Entrypoint heißt, wird beim Einrichten nachgesehen. Leitet er global um, entfällt der zusätzliche Router.

**Ablauf des Deploy-Jobs** (GitHub Environment `production`, `concurrency: deploy-production` ohne Abbruch laufender Deployments):
1. Den SSH-Schlüssel aus `DEPLOY_SSH_PRIVATE_KEY` einrichten. `known_hosts` kommt aus dem Secret `DEPLOY_SSH_KNOWN_HOSTS` statt aus `ssh-keyscan` zur Laufzeit. So wird der Host-Schlüssel festgelegt, und ein untergeschobener Server fällt auf.
2. `scp deploy/docker-compose.yml` nach `/docker/essenplaner/docker-compose.yml`
3. Per SSH: `.env` mit dem Tag schreiben, danach `docker compose --env-file /etc/essenplaner/production.env --env-file .env pull` und entsprechend `up -d --wait --wait-timeout 90`
4. Vom Runner aus `https://essenplaner.srv1115517.hstgr.cloud/healthz` bis zu zwei Minuten lang abfragen, bis Status 200 kommt und `version` dem Commit entspricht. Kurz nach dem Start antwortet Traefik noch mit 404/502, das ist vom finops-Deployment bekannt und kein Fehler.

**Rollback über `workflow_dispatch`.** Die Eingabe `sha` ist optional. Ist sie gesetzt, überspringt `deploy.yml` die Jobs `test` und `image`, prüft mit `docker manifest inspect`, ob `sha-<sha>` in GHCR existiert, und deployt dieses Image. Ohne Eingabe baut und deployt der manuelle Start den aktuellen Stand von `main`. Weil nicht neu gebaut wird, läuft beim Rollback genau das Image, das schon einmal live war.

**Eigener CI-Schlüssel und Zugang als root.** Der Schlüssel ist ein neues ed25519-Paar, nur für diesen Workflow und getrennt vom Debug-Schlüssel und vom finops-CI-Schlüssel. Er lässt sich einzeln widerrufen. Den Public Key trägst du selbst in `authorized_keys` ein. Die Pipeline meldet sich wie bei finops als `root` an.
- Alternative: ein eigener Nutzer `deploy` in der Gruppe `docker`. Das bringt kaum Sicherheit, weil Mitglieder der Gruppe `docker` faktisch root-Rechte haben. Eine Einschränkung per `command=` in `authorized_keys` würde `scp` und die Befehlsfolge verkomplizieren. Wir bleiben bei root, weil es dem bestehenden Muster entspricht und das Risiko über den eigenen, widerrufbaren Schlüssel begrenzt ist.

## Risks / Trade-offs

- [Ein Rollback auf eine Version mit älterem Datenbankschema] → Migrationen fügen nur Tabellen und Spalten hinzu, ältere Binaries ignorieren sie. Bevor ein Deployment Migrationen enthält, die Daten verändern, braucht es ein Backup. Das ist ein Grund, die Backup-Change bald nachzuziehen.
- [Datenverlust ohne Backup] → Bis zur Backup-Change bleibt nur das Volume auf dem VPS. `docs/deployment.md` beschreibt eine manuelle Sicherung mit `sqlite3 .backup` aus einem temporären Container.
- [Der Push auf `main` passiert, bevor Secrets und Server eingerichtet sind; beim ersten finops-Deploy ist genau das passiert] → Der Workflow bricht mit einer klaren Meldung ab, wenn ein Deploy-Secret leer ist. `docs/deployment.md` legt die Reihenfolge fest: zuerst einrichten, dann mergen. Ein fehlgeschlagener Lauf lässt sich mit „Re-run“ wiederholen.
- [Ein Neustart des VPS durch den Hostinger-Hypervisor] → `restart: unless-stopped` und der feste Tag in `.env` lassen die App danach wieder anlaufen.
- [Das GHCR-Paket ist nach dem ersten Push privat] → Die Sichtbarkeit einmalig in den Paket-Einstellungen auf „Public“ stellen. Solange das nicht passiert ist, schlägt `docker compose pull` fehl, und der Deploy-Lauf wird rot.
- [Ausfallzeit beim Neustart des Containers] → Wenige Sekunden. SQLite im WAL-Modus und der saubere Shutdown aus `add-go-backend` verhindern kaputte Schreibvorgänge.
- [Der temporäre HTTP-Basic-Auth-Zugang schützt sensible Familiendaten nur mit einem Passwort] → Er läuft ausschließlich über HTTPS, verwendet ein langes zufälliges Passwort und wird direkt nach der erfolgreichen Auth0-Prüfung entfernt. Der bcrypt-Hash liegt in einer Datei mit `0600`, die root gehört.

## Migration Plan

1. Ein langes zufälliges Passwort erzeugen und seinen bcrypt-Hash für Traefik vorbereiten.
2. Einmalig auf dem VPS (von dir, nach `docs/deployment.md`): `/docker/essenplaner/` anlegen, `/etc/essenplaner/production.env` mit `ESSENPLANER_BASIC_AUTH_USERS` und den Rechten `0600` befüllen und den Public Key des CI-Schlüssels eintragen.
3. Einmalig in GitHub: Environment `production` mit `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_PRIVATE_KEY` und `DEPLOY_SSH_KNOWN_HOSTS` anlegen.
4. Den Pull Request mit den Workflows mergen. Der erste Lauf baut und pusht das Image. Scheitert der Deploy, weil das Paket noch privat ist, das Paket auf „Public“ stellen und den Lauf wiederholen.
5. Rollback: `deploy.yml` manuell mit dem Commit-Hash der vorherigen Version starten. Im Notfall auf dem VPS `ESSENPLANER_TAG` in `/docker/essenplaner/.env` ändern und den dokumentierten Compose-Befehl ausführen.
6. `add-auth0-login` auf dieser Installation umsetzen und testen; erst danach die Basic-Auth-Middleware entfernen.

## Open Questions

- Heißt der HTTP-Entrypoint des vorhandenen Traefik `web`, und leitet er schon global auf HTTPS um? Das wird beim Einrichten nachgesehen. Es entscheidet nur, ob der zweite Router nötig ist.
- Ist der VPS `x86_64`? Davon wird ausgegangen. Wenn nicht, wird die Build-Plattform angepasst.
