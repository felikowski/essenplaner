# Deployment auf den VPS

Der Essenplaner läuft als Container auf dem Hostinger-VPS `srv1115517.hstgr.cloud` hinter dem
gemeinsamen Traefik (`/docker/traefik`, Netz `root_default`, Resolver `mytlschallenge`) und ist unter
**https://essenplaner.srv1115517.hstgr.cloud** erreichbar.

Ablauf bei jedem Push auf `main` ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

1. `test`: Go-Tests, Frontend-Tests, Lint, Build und Prüfung der Compose-Datei ([`ci.yml`](../.github/workflows/ci.yml))
2. `image`: baut `ghcr.io/felikowski/essenplaner:sha-<commit>` (dazu `:main`) und pusht es nach GHCR
3. `deploy`: kopiert [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) nach `/docker/essenplaner/`,
   schreibt dort `.env` mit `ESSENPLANER_TAG=sha-<commit>`, zieht das Image und startet es
   (`up -d --wait`). Danach muss `https://essenplaner.srv1115517.hstgr.cloud/healthz` innerhalb von zwei
   Minuten den neuen Commit melden, sonst wird der Lauf rot.

Pull Requests und andere Branches werden nur getestet.

Bis `add-auth0-login` fertig ist, schützt Traefik alle Pfade außer `/healthz` mit HTTP Basic Auth.

## Was wo liegt

| Ort                                     | Inhalt                                               | Wer schreibt        |
| --------------------------------------- | ---------------------------------------------------- | ------------------- |
| `/docker/essenplaner/docker-compose.yml` | Kopie aus dem Repository                             | Deploy-Workflow     |
| `/docker/essenplaner/.env`               | `ESSENPLANER_TAG=sha-<commit>` (zuletzt ausgeliefert) | Deploy-Workflow     |
| `/etc/essenplaner/production.env`        | Geheimnisse, `root:root`, `0600`                      | von Hand, nie CI    |
| Volume `essenplaner_essenplaner_data`    | SQLite-Datenbank unter `/data`                       | App                 |

## Einmalige Einrichtung

Reihenfolge: **erst einrichten, dann nach `main` mergen.** Fehlt etwas, bricht der Deploy-Job mit
einer Meldung ab. Ein fehlgeschlagener Lauf lässt sich danach mit „Re-run jobs“ wiederholen.

### 1. Zugang für die Familie (temporär, HTTP Basic Auth)

Ein langes Zufallspasswort erzeugen und den bcrypt-Hash für Traefik bilden:

```bash
openssl rand -base64 24
```

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbB familie '<passwort>'
```

Das Passwort im Passwortmanager ablegen, die Ausgabe (`familie:$2y$05$…`) kommt in Schritt 2.

### 2. Auf dem VPS

```bash
ssh root@srv1115517.hstgr.cloud
```

```bash
mkdir -p /docker/essenplaner && install -d -m 700 /etc/essenplaner
```

Die Env-Datei anlegen. Der Wert **muss in einfachen Anführungszeichen** stehen, sonst ersetzt Compose
die `$` im Hash:

```bash
install -m 600 /dev/null /etc/essenplaner/production.env
```

```bash
echo "ESSENPLANER_BASIC_AUTH_USERS='familie:\$2y\$05\$…'" > /etc/essenplaner/production.env
```

Den Public Key des CI-Schlüssels (siehe Schritt 3) in `/root/.ssh/authorized_keys` eintragen.

### 3. GitHub

Ein eigenes Schlüsselpaar nur für den Workflow (lässt sich einzeln widerrufen):

```bash
ssh-keygen -t ed25519 -N '' -C essenplaner-deploy -f essenplaner-deploy
```

Im Repository unter *Settings → Environments* das Environment `production` anlegen und dort diese
Secrets setzen:

| Secret                   | Wert                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `DEPLOY_SSH_HOST`        | `srv1115517.hstgr.cloud`                                           |
| `DEPLOY_SSH_USER`        | `root`                                                             |
| `DEPLOY_SSH_PRIVATE_KEY` | Inhalt von `essenplaner-deploy`                                    |
| `DEPLOY_SSH_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan -t ed25519 srv1115517.hstgr.cloud`, einmal gegen den Fingerprint geprüft |

Danach die lokalen Schlüsseldateien löschen.

### 4. GHCR-Paket öffentlich stellen

Nach dem ersten Push ist `ghcr.io/felikowski/essenplaner` privat, und `docker compose pull` auf dem VPS
schlägt fehl. Einmalig unter *github.com/felikowski → Packages → essenplaner → Package settings →
Change visibility* auf **Public** stellen und den Lauf wiederholen. Das Image enthält keine Geheimnisse.

## Betrieb

Alle Befehle auf dem VPS in `/docker/essenplaner`:

```bash
cd /docker/essenplaner
```

Status und Logs:

```bash
docker compose --env-file /etc/essenplaner/production.env --env-file .env ps
```

```bash
docker compose --env-file /etc/essenplaner/production.env --env-file .env logs -f --tail 100
```

Welche Version läuft:

```bash
curl -s https://essenplaner.srv1115517.hstgr.cloud/healthz
```

### Rollback

Unter *Actions → Deploy → Run workflow* den **vollständigen** Commit-Hash eines früher ausgelieferten
Stands als `sha` eintragen. Tests und Build werden übersprungen, es läuft genau das Image, das damals live
war. Ohne `sha` baut und liefert der manuelle Start den aktuellen Stand von `main`.

Im Notfall direkt auf dem VPS: `ESSENPLANER_TAG` in `.env` auf `sha-<commit>` ändern und starten:

```bash
docker compose --env-file /etc/essenplaner/production.env --env-file .env up -d --wait
```

Migrationen fügen bisher nur Tabellen und Spalten hinzu, ältere Versionen laufen deshalb mit einer neueren
Datenbank. Vor einem Deployment mit Migrationen, die Daten ändern, ein Backup ziehen.

### Manuelles Backup

Bis eine automatische Sicherung kommt: eine konsistente Kopie per `sqlite3 .backup` aus einem temporären
Container (funktioniert im laufenden Betrieb):

```bash
mkdir -p /root/backups/essenplaner
```

```bash
docker run --rm -v essenplaner_essenplaner_data:/data:ro -v /root/backups/essenplaner:/backup alpine sh -c "apk add -q sqlite && sqlite3 'file:/data/essenplaner.db?mode=ro' \".backup /backup/essenplaner-$(date +%F).db\""
```

Zurückspielen: Container stoppen, die Sicherung als `essenplaner.db` ins Volume kopieren (Besitzer
`65532:65532`, das ist `nonroot`), `essenplaner.db-wal` und `essenplaner.db-shm` löschen, wieder starten.
