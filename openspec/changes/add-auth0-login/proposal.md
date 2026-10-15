## Why

Der Essenplaner läuft nach `add-vps-deployment` auf dem echten Server, ist dort aber zunächst durch einen vorübergehenden HTTP-Basic-Auth-Zugang geschützt. Dieser Schutz eignet sich nicht als dauerhafte Familienanmeldung. Die Anmeldung läuft deshalb über Auth0 und wird direkt unter den realen HTTPS- und Proxy-Bedingungen geprüft. So müssen wir keine Passwörter selbst verwalten, und welche Anmeldemethoden es gibt (zum Beispiel Google, E-Mail und Passwort oder Passkey), wird in Auth0 eingestellt, ohne den Code zu ändern.

## What Changes

- Anmeldung über Auth0 Universal Login (OpenID Connect). Zugriff haben nur E-Mail-Adressen aus einer konfigurierten Freigabeliste.
- Sitzungen über ein sicheres Cookie
- Abmelden, das auch die Auth0-Sitzung beendet
- Alle `/api/…`-Endpunkte außer den Login-Routen und `/healthz` erfordern eine gültige Sitzung
- Schutz vor Cross-Site-Request-Forgery bei ändernden Anfragen
- Frontend: Login-Seite, Anzeige des angemeldeten Nutzers, Abmelden, Weiterleitung zum Login bei abgelaufener Sitzung
- Sicherheits-Header für die ausgelieferten Seiten
- Nach erfolgreicher Prüfung auf dem VPS wird der temporäre HTTP-Basic-Auth-Schutz entfernt

## Capabilities

### New Capabilities
- `authentication`: Anmeldung über Auth0, Freigabeliste, Sitzungen, Abmelden und der Schutz der API

### Modified Capabilities
- `deployment`: Auth0 löst den temporären HTTP-Basic-Auth-Schutz am Reverse Proxy ab

## Impact

- Backend: neue Abhängigkeiten `golang.org/x/oauth2` und `github.com/coreos/go-oidc/v3`, eine neue Tabelle für Sitzungen, Middleware vor allen API-Routen
- Konfiguration: Auth0-Domain, Client-ID und Client-Secret, öffentliche Basis-URL und Freigabeliste als Umgebungsvariablen
- Einmalig in Auth0: einen Tenant und eine „Regular Web Application“ anlegen, Callback- und Logout-URLs eintragen, Anmeldemethoden wählen, Selbstregistrierung abschalten
- Deployment: Auth0-Werte vor dem ersten Test auf dem VPS hinterlegen; nach erfolgreicher Prüfung die temporäre Basic-Auth-Middleware aus der Compose-Datei entfernen
- **BREAKING** für API-Clients: Anfragen ohne Sitzung erhalten ab jetzt 401
