## Why

Der Essenplaner soll im Internet erreichbar sein. Ohne Zugriffsschutz könnte jeder den Familienplan lesen und ändern und später auch auf die Rezepte aus Google Drive zugreifen. Weil ohnehin Google Drive angebunden wird, ist die Anmeldung mit Google für die Familie der einfachste Weg.

## What Changes

- Anmeldung mit Google (OpenID Connect). Zugriff haben nur E-Mail-Adressen aus einer konfigurierten Freigabeliste.
- Sitzungen über ein sicheres Cookie, dazu Abmelden
- Alle `/api/…`-Endpunkte außer den Login-Routen und `/healthz` erfordern eine gültige Sitzung
- Schutz vor Cross-Site-Request-Forgery bei ändernden Anfragen
- Frontend: Login-Seite, Anzeige des angemeldeten Nutzers, Abmelden, Weiterleitung zum Login bei abgelaufener Sitzung
- Sicherheits-Header für die ausgelieferten Seiten

## Capabilities

### New Capabilities
- `authentication`: Anmeldung mit Google, Freigabeliste, Sitzungen, Abmelden und der Schutz der API

### Modified Capabilities
<!-- keine: bestehende Requirements ändern sich nicht, die API wird nur zusätzlich geschützt (Requirement liegt in `authentication`) -->

## Impact

- Backend: neue Abhängigkeiten `golang.org/x/oauth2` und `github.com/coreos/go-oidc/v3`, eine neue Tabelle für Sitzungen, Middleware vor allen API-Routen
- Konfiguration: Google OAuth Client-ID und Secret, öffentliche Basis-URL, Freigabeliste und Sitzungsschlüssel als Umgebungsvariablen
- Einmalig in der Google Cloud Console: ein Projekt mit OAuth-Zustimmungsbildschirm und Web-Client anlegen. Dieses Projekt nutzt auch `add-google-drive-recipes`.
- **BREAKING** für API-Clients: Anfragen ohne Sitzung erhalten ab jetzt 401
