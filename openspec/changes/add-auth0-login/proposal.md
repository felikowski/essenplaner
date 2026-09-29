## Why

Der Essenplaner soll im Internet erreichbar sein. Ohne Zugriffsschutz könnte jeder den Familienplan lesen und ändern und später auch auf die Rezepte aus Google Drive zugreifen. Die Anmeldung läuft über Auth0. So müssen wir keine Passwörter selbst verwalten, und welche Anmeldemethoden es gibt (zum Beispiel Google, E-Mail und Passwort oder Passkey), wird in Auth0 eingestellt, ohne den Code zu ändern.

## What Changes

- Anmeldung über Auth0 Universal Login (OpenID Connect). Zugriff haben nur E-Mail-Adressen aus einer konfigurierten Freigabeliste.
- Sitzungen über ein sicheres Cookie
- Abmelden, das auch die Auth0-Sitzung beendet
- Alle `/api/…`-Endpunkte außer den Login-Routen und `/healthz` erfordern eine gültige Sitzung
- Schutz vor Cross-Site-Request-Forgery bei ändernden Anfragen
- Frontend: Login-Seite, Anzeige des angemeldeten Nutzers, Abmelden, Weiterleitung zum Login bei abgelaufener Sitzung
- Sicherheits-Header für die ausgelieferten Seiten

## Capabilities

### New Capabilities
- `authentication`: Anmeldung über Auth0, Freigabeliste, Sitzungen, Abmelden und der Schutz der API

### Modified Capabilities
<!-- keine: bestehende Requirements ändern sich nicht, die API wird nur zusätzlich geschützt (Requirement liegt in `authentication`) -->

## Impact

- Backend: neue Abhängigkeiten `golang.org/x/oauth2` und `github.com/coreos/go-oidc/v3`, eine neue Tabelle für Sitzungen, Middleware vor allen API-Routen
- Konfiguration: Auth0-Domain, Client-ID und Client-Secret, öffentliche Basis-URL und Freigabeliste als Umgebungsvariablen
- Einmalig in Auth0: einen Tenant und eine „Regular Web Application“ anlegen, Callback- und Logout-URLs eintragen, Anmeldemethoden wählen, Selbstregistrierung abschalten
- **BREAKING** für API-Clients: Anfragen ohne Sitzung erhalten ab jetzt 401
