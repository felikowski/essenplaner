## ADDED Requirements

### Requirement: Öffentlich über HTTPS erreichbar
Das System SHALL unter `https://essenplaner.srv1115517.hstgr.cloud` mit einem gültigen, öffentlich vertrauenswürdigen TLS-Zertifikat erreichbar sein. Anfragen über HTTP MUST auf dieselbe Adresse mit HTTPS weitergeleitet werden. Der Container MUST nur über den Reverse Proxy erreichbar sein und keinen eigenen Port auf dem Host öffnen.

#### Scenario: Aufruf im Browser
- **WHEN** ein Familienmitglied `https://essenplaner.srv1115517.hstgr.cloud` am Handy öffnet
- **THEN** lädt die App ohne Zertifikatswarnung

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
Rezepte, Wochenpläne und Sitzungen SHALL außerhalb des Containers gespeichert werden. Ein Deployment, ein Neustart des Containers oder ein Neustart des Servers MUST sie unverändert lassen. Nach einem Neustart des Servers MUST die App ohne manuellen Eingriff wieder laufen.

#### Scenario: Deployment einer neuen Version
- **WHEN** für Freitag ein Rezept geplant ist und danach eine neue Version ausgeliefert wird
- **THEN** ist die Zuordnung für Freitag in der neuen Version weiterhin vorhanden

#### Scenario: Neustart des Servers
- **WHEN** der Server neu gestartet wird
- **THEN** ist die App danach ohne manuellen Eingriff wieder erreichbar und zeigt den bisherigen Stand

### Requirement: Geheimnisse nicht im Repository
Zugangsdaten wie das Auth0-Client-Secret und die Freigabeliste SHALL weder im Repository noch im Container-Image enthalten sein. Sie MUST ausschließlich auf dem Server hinterlegt sein, in einer Datei, die nur der Administrator lesen kann. Der Zugang der Deployment-Pipeline zum Server MUST einen eigenen Schlüssel verwenden, der nur dafür bestimmt ist und sich einzeln widerrufen lässt.

#### Scenario: Image untersuchen
- **WHEN** jemand das öffentliche Container-Image herunterlädt und untersucht
- **THEN** findet er darin keine Auth0-Zugangsdaten und keine E-Mail-Adressen der Freigabeliste

### Requirement: Frühere Version erneut ausliefern
Das System SHALL es ermöglichen, eine frühere, bereits gebaute Version manuell erneut auszuliefern, ohne sie neu zu bauen. Die Auswahl MUST über den Commit-Hash erfolgen.

#### Scenario: Rollback
- **WHEN** eine fehlerhafte Version live ist und der Administrator das Deployment mit dem Commit-Hash der vorherigen Version startet
- **THEN** läuft danach wieder die vorherige Version, und die Daten sind unverändert
