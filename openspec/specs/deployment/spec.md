# deployment Specification

## Purpose

Legt fest, wie der Essenplaner betrieben wird: ein einzelnes Programm, das per Umgebungsvariablen konfiguriert wird und seine Daten dauerhaft ablegt, sowie der öffentliche Betrieb auf dem VPS mit automatischem Deployment, Versionsprüfung und Rollback.

## Requirements

### Requirement: Ein Binary liefert API und Frontend
Das System SHALL als ein einzelnes ausführbares Programm laufen, das unter `/api/…` die API und unter allen anderen Pfaden das gebaute Frontend ausliefert. Pfade ohne passende Datei MUST mit der `index.html` des Frontends beantwortet werden, damit Deep-Links wie `/woche/2026-W40` funktionieren. Unbekannte Pfade unter `/api/` MUST mit Status 404 und einem JSON-Fehler beantwortet werden.

#### Scenario: Deep-Link
- **WHEN** ein Browser `/rezepte/abc` direkt aufruft
- **THEN** liefert das System die `index.html` des Frontends mit Status 200

#### Scenario: Unbekannter API-Pfad
- **WHEN** ein Client `/api/gibtsnicht` aufruft
- **THEN** antwortet das System mit Status 404 und `{"error": "not found"}`

### Requirement: Konfiguration über Umgebungsvariablen
Das System SHALL Port und Datenbankpfad aus Umgebungsvariablen lesen und MUST für beides sinnvolle Standardwerte für die lokale Entwicklung haben.

#### Scenario: Standardwerte
- **WHEN** das Programm ohne Umgebungsvariablen gestartet wird
- **THEN** lauscht es auf Port 8080 und verwendet `./data/essenplaner.db`

### Requirement: Daten überleben Neustarts
Das System SHALL Rezepte und Wochenpläne dauerhaft speichern. Nach einem Neustart MUST derselbe Stand vorhanden sein. Beim ersten Start mit leerer Datenbank MUST das Datenbankschema automatisch angelegt werden.

#### Scenario: Neustart
- **WHEN** ein Tag belegt und das Programm danach neu gestartet wird
- **THEN** liefert `GET /api/weeks/{week}` diese Belegung weiterhin

### Requirement: Health-Check
Das System SHALL unter `GET /healthz` den Status 200 liefern, wenn es Anfragen bedienen kann und die Datenbank erreichbar ist. Andernfalls MUST es Status 503 liefern.

#### Scenario: Gesund
- **WHEN** ein Monitoring-System `GET /healthz` aufruft und die Datenbank erreichbar ist
- **THEN** antwortet das System mit Status 200

### Requirement: Öffentlich über HTTPS erreichbar
Das System SHALL unter `https://essenplaner.srv1115517.hstgr.cloud` mit einem gültigen, öffentlich vertrauenswürdigen TLS-Zertifikat erreichbar sein. Anfragen über HTTP MUST auf dieselbe Adresse mit HTTPS weitergeleitet werden. Der Container MUST nur über den Reverse Proxy erreichbar sein und keinen eigenen Port auf dem Host öffnen. Bis der Auth0-Login umgesetzt und geprüft ist, MUST der Reverse Proxy alle Pfade außer `/healthz` zusätzlich mit HTTP Basic Auth schützen.

#### Scenario: Aufruf im Browser
- **WHEN** ein Familienmitglied `https://essenplaner.srv1115517.hstgr.cloud` am Handy öffnet und die vorübergehenden Zugangsdaten eingibt
- **THEN** lädt die App ohne Zertifikatswarnung

#### Scenario: Ohne vorübergehende Zugangsdaten
- **WHEN** ein Client vor der Einführung des Auth0-Logins die App ohne gültige HTTP-Basic-Auth-Zugangsdaten aufruft
- **THEN** antwortet der Reverse Proxy mit 401, während `/healthz` weiterhin ohne Zugangsdaten erreichbar ist

#### Scenario: Aufruf über HTTP
- **WHEN** ein Client `http://essenplaner.srv1115517.hstgr.cloud/woche/2026-W40` aufruft
- **THEN** antwortet das System mit einer permanenten Weiterleitung auf `https://essenplaner.srv1115517.hstgr.cloud/woche/2026-W40`

### Requirement: Automatisches Deployment nach Push auf main
Nach jedem Push auf den Branch `main` SHALL das System automatisch die Tests ausführen, ein Container-Image bauen und es auf den Server ausliefern. Schlägt ein Test oder der Build fehl, MUST das Deployment unterbleiben, und die zuletzt ausgelieferte Version MUST weiterlaufen. Pushes auf andere Branches und Pull Requests MUST getestet, aber nicht ausgeliefert werden. Laufen zwei Deployments kurz nacheinander an, MUST sie nacheinander ausgeführt werden, nicht gleichzeitig.

#### Scenario: Erfolgreicher Push
- **WHEN** ein Commit auf `main` gepusht wird und alle Tests erfolgreich sind
- **THEN** läuft wenige Minuten später genau dieser Commit auf dem Server

#### Scenario: Fehlschlagende Tests
- **WHEN** ein Commit auf `main` gepusht wird und ein Test fehlschlägt
- **THEN** wird kein Image ausgeliefert, und auf dem Server läuft weiterhin die vorherige Version

#### Scenario: Pull Request
- **WHEN** ein Pull Request gegen `main` geöffnet oder aktualisiert wird
- **THEN** werden die Tests ausgeführt, und es wird nichts ausgeliefert

### Requirement: Deployment wird überprüft
Ein Deployment SHALL erst als erfolgreich gelten, wenn `GET /healthz` über die öffentliche Adresse innerhalb von zwei Minuten Status 200 liefert und dabei die gerade ausgelieferte Version meldet. Andernfalls MUST der Deployment-Lauf als fehlgeschlagen markiert werden.

#### Scenario: Neue Version startet nicht
- **WHEN** der Container der neuen Version nicht startet, zum Beispiel wegen einer fehlenden Umgebungsvariable
- **THEN** wird der Deployment-Lauf als fehlgeschlagen markiert

### Requirement: Ausgelieferte Version erkennbar
Das System SHALL in der Antwort von `GET /healthz` im Feld `version` den Commit melden, aus dem es gebaut wurde. Bei lokalen Builds ohne diese Angabe MUST dort `dev` stehen.

#### Scenario: Version abfragen
- **WHEN** ein Client `GET /healthz` auf dem Server aufruft
- **THEN** enthält die Antwort `"status": "ok"` und im Feld `version` den vollständigen Commit-Hash des ausgelieferten Stands

### Requirement: Daten bleiben bei Deployments und Neustarts erhalten
Rezepte, Wochenpläne und weitere Anwendungsdaten SHALL außerhalb des Containers gespeichert werden. Ein Deployment, ein Neustart des Containers oder ein Neustart des Servers MUST sie unverändert lassen. Nach einem Neustart des Servers MUST die App ohne manuellen Eingriff wieder laufen.

#### Scenario: Deployment einer neuen Version
- **WHEN** für Freitag ein Rezept geplant ist und danach eine neue Version ausgeliefert wird
- **THEN** ist die Zuordnung für Freitag in der neuen Version weiterhin vorhanden

#### Scenario: Neustart des Servers
- **WHEN** der Server neu gestartet wird
- **THEN** ist die App danach ohne manuellen Eingriff wieder erreichbar und zeigt den bisherigen Stand

### Requirement: Geheimnisse nicht im Repository
Zugangsdaten wie der temporäre HTTP-Basic-Auth-Zugang und spätere Anwendungsgeheimnisse SHALL weder im Repository noch im Container-Image enthalten sein. Sie MUST ausschließlich auf dem Server hinterlegt sein, in einer Datei, die nur der Administrator lesen kann. Der Zugang der Deployment-Pipeline zum Server MUST einen eigenen Schlüssel verwenden, der nur dafür bestimmt ist und sich einzeln widerrufen lässt.

#### Scenario: Image untersuchen
- **WHEN** jemand das öffentliche Container-Image herunterlädt und untersucht
- **THEN** findet er darin weder den temporären Zugang noch andere Anwendungsgeheimnisse

### Requirement: Frühere Version erneut ausliefern
Das System SHALL es ermöglichen, eine frühere, bereits gebaute Version manuell erneut auszuliefern, ohne sie neu zu bauen. Die Auswahl MUST über den Commit-Hash erfolgen.

#### Scenario: Rollback
- **WHEN** eine fehlerhafte Version live ist und der Administrator das Deployment mit dem Commit-Hash der vorherigen Version startet
- **THEN** läuft danach wieder die vorherige Version, und die Daten sind unverändert

### Requirement: Auth0 löst den temporären Proxy-Schutz ab
Das System SHALL den temporären HTTP-Basic-Auth-Schutz am Reverse Proxy erst entfernen, nachdem der Auth0-Anmeldeablauf auf der Produktionsadresse erfolgreich geprüft wurde. Danach MUST ein nicht angemeldeter Aufruf die Login-Seite der Anwendung erreichen, ohne eine HTTP-Basic-Auth-Abfrage auszulösen. `/healthz` MUST weiterhin ohne Anmeldung erreichbar bleiben. Vor einem Rollback auf eine Version ohne anwendungsseitigen Zugriffsschutz MUST HTTP Basic Auth wieder aktiviert werden.

#### Scenario: Dauerhaften Login freischalten
- **WHEN** Anmeldung, Abmeldung, Freigabeliste und Rücksprungziel auf der Produktionsadresse erfolgreich geprüft wurden und der temporäre Proxy-Schutz entfernt wird
- **THEN** erreicht ein nicht angemeldeter Nutzer die Login-Seite der Anwendung ohne vorgeschaltete HTTP-Basic-Auth-Abfrage

#### Scenario: Rollback vor Auth0
- **WHEN** eine Version ausgeliefert werden soll, die noch keinen Auth0-Schutz enthält
- **THEN** muss zuvor der temporäre HTTP-Basic-Auth-Schutz wieder aktiviert sein
