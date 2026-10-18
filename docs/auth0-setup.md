# Auth0 einrichten

Der Essenplaner meldet Nutzer über Auth0 an (OpenID Connect, Authorization Code Flow mit PKCE). Es gibt
**Named Users**: Konten legt der Administrator im Auth0-Dashboard an, mit Benutzername und Passwort.
Eine Registrierung oder E-Mail-Bestätigung gibt es nicht. Zusätzlich lässt die App nur Auth0-Nutzer-IDs
aus `ALLOWED_SUBJECTS` herein.

Eingerichtet ist das im vorhandenen Tenant `dev-axmg5opc18ioigzp` (Region US). Dort liegen auch die
Konten anderer Apps (FinOps, Reisecockpit), deshalb hat der Essenplaner eine eigene Connection.

## Application

*Applications → Create Application*: Name **Essenplaner**, Typ **Regular Web Application**.

Unter *Settings*:

| Feld                  | Werte                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Allowed Callback URLs | `https://essenplaner.srv1115517.hstgr.cloud/api/auth/callback`, `http://localhost:5173/api/auth/callback` |
| Allowed Logout URLs   | `https://essenplaner.srv1115517.hstgr.cloud/login`, `http://localhost:5173/login`             |
| Allowed Web Origins   | leer (der Login läuft serverseitig)                                                           |

Domain, Client ID und Client Secret stehen oben in *Settings → Basic Information*.

## Connection

*Authentication → Database → Create DB Connection*:

- Name **`essenplaner-users`**
- Kennung (Identifier): nur **Username**, keine E-Mail-Adresse
- Anmeldemethode: **Password**
- **Disable Sign Ups**: an

Unter *Applications* der Connection ist nur **Essenplaner** aktiviert. Umgekehrt sind unter
*Applications → Essenplaner → Connections* alle anderen Connections aus (`Username-Password-Authentication`,
`User-PW`, `google-oauth2`). Die Login-Seite von Auth0 zeigt dann nur Benutzername und Passwort.

## Konten anlegen

*User Management → Users → Create User*, Connection **essenplaner-users**, Benutzername und Passwort
vergeben. Die Nutzer-ID steht danach auf der Detailseite des Kontos (`auth0|…`).

Ein neues Konto bekommt erst Zugriff, wenn seine ID in `ALLOWED_SUBJECTS` steht (siehe unten) und der
Dienst neu gestartet wurde. Umgekehrt sperrt das Entfernen der ID das Konto beim nächsten Neustart, auch
mit laufender Sitzung.

## Konfiguration der App

| Variable              | Wert                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `AUTH0_DOMAIN`        | `dev-axmg5opc18ioigzp.us.auth0.com`                                      |
| `AUTH0_CLIENT_ID`     | Client ID der Application Essenplaner                                    |
| `AUTH0_CLIENT_SECRET` | Client Secret der Application (geheim)                                   |
| `PUBLIC_URL`          | `https://essenplaner.srv1115517.hstgr.cloud` (lokal `http://localhost:5173`) |
| `ALLOWED_SUBJECTS`    | kommagetrennte Nutzer-IDs, etwa `auth0|6630…,auth0|6631…`                |

Fehlt einer dieser Werte, startet der Dienst nicht und nennt die fehlende Variable.

**Produktion:** Die Werte stehen in `/etc/essenplaner/production.env` auf dem VPS (`root:root`, `0600`),
siehe [deployment.md](deployment.md). Nach einer Änderung den Container neu erstellen (ein `restart`
liest die Env-Datei nicht neu ein):

```bash
cd /docker/essenplaner && docker compose --env-file /etc/essenplaner/production.env --env-file .env up -d --force-recreate --wait
```

**Lokal:** Die Werte als Umgebungsvariablen für `go run ./cmd/server` setzen, mit
`PUBLIC_URL=http://localhost:5173`, und das Frontend über den Vite-Dev-Server auf Port 5173 öffnen. Vite
leitet `/api/auth/*` an das Backend weiter. Über `http://localhost` setzt die App Cookies ohne
`Secure`-Flag.
