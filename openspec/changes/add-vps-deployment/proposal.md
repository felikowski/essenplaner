## Why

Bisher läuft der Essenplaner nur lokal. Die Familie soll ihn am Handy von überall nutzen können, und jede Änderung auf `main` soll ohne Handarbeit beim Server ankommen. Das Deployment wird bewusst vor `add-auth0-login` umgesetzt, damit Anmeldung, sichere Cookies und Weiterleitungen anschließend unter realen HTTPS- und Proxy-Bedingungen geprüft werden können. Bis dahin schützt vorübergehend HTTP Basic Auth den gesamten Zugriff außer `/healthz`.

## What Changes

- Die App läuft als Docker-Container auf dem vorhandenen Hostinger-VPS hinter dem dort bereits betriebenen Traefik und ist unter `https://essenplaner.srv1115517.hstgr.cloud` mit gültigem TLS-Zertifikat erreichbar
- Die SQLite-Datenbank liegt auf einem Docker-Volume und übersteht Deployments, Container-Neustarts und Neustarts des VPS
- GitHub Actions führt bei jedem Push auf `main` die Tests aus, baut ein Image, veröffentlicht es in der GitHub Container Registry und deployt es auf den VPS. Schlagen die Tests fehl, wird nichts deployt.
- Ein Deployment gilt erst als erfolgreich, wenn die öffentliche URL gesund ist und die neue Version meldet. Andernfalls wird der Workflow rot.
- `GET /healthz` meldet zusätzlich die ausgelieferte Version (Commit). So ist sichtbar, welcher Stand live ist.
- Eine frühere Version lässt sich manuell über den Workflow erneut deployen (Rollback)
- Pull Requests werden ebenfalls getestet, aber nicht deployt
- Ein vorübergehender HTTP-Basic-Auth-Schutz verhindert bis zur Auth0-Change den freien Zugriff; `/healthz` bleibt für die Deployment-Prüfung öffentlich
- Geheimnisse wie der temporäre Zugang und später die Auth0-Konfiguration liegen nur auf dem VPS, nicht im Repository oder Image. Der Deploy-Zugang nutzt einen eigenen SSH-Schlüssel, der nur für CI gedacht ist.
- Die Change kommt direkt vor `add-auth0-login`; Gefrierfach und Nährwerte sind optionale Folge-Changes

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `deployment`: neue Requirements für öffentlichen Betrieb über HTTPS, automatisches Deployment nach Push auf `main`, Prüfung nach dem Deployment, erkennbare Version, dauerhafte Daten auf dem Server, Umgang mit Geheimnissen und Rollback. Die bestehenden Requirements bleiben unverändert.

## Impact

- Neu im Repository: `.github/workflows/ci.yml` und `.github/workflows/deploy.yml`, `deploy/docker-compose.yml`, `docs/deployment.md`
- Backend: Die Version wird beim Build eingebettet und über `/healthz` ausgegeben. Für den Container-Health-Check kommt ein Unterbefehl `healthcheck` hinzu, weil das distroless-Image kein `curl` enthält.
- Dockerfile: Build-Argument für die Version
- GitHub: Environment `production` mit den Secrets `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER` und `DEPLOY_SSH_PRIVATE_KEY`; Paket `ghcr.io/felikowski/essenplaner` öffentlich
- VPS (einmalig, von Hand): Verzeichnis `/docker/essenplaner/`, Datei `/etc/essenplaner/production.env` mit dem bcrypt-Hash für den temporären HTTP-Basic-Auth-Zugang (Rechte `0600`), Public Key des CI-Schlüssels in `authorized_keys`
- Die nachfolgende Change `add-auth0-login` ergänzt ihre Konfiguration, prüft die Anmeldung auf dieser Installation und entfernt danach den temporären Schutz
- RAM auf dem VPS: Der Container braucht nur wenige MB, das ist beim kleinsten VPS-Tarif unkritisch
