## 1. Vorbereitung

- [x] 1.1 Anleitung in `docs/auth0-setup.md`: vorhandener Tenant, Regular Web Application, eigene Datenbank-Connection `essenplaner-users` nur für diese Application mit „Disable Sign Ups“, Callback-/Logout-/Web-Origin-URLs für lokal und Produktion, Konten anlegen, Nutzer-IDs ablesen; danach im Chrome des Nutzers (jeweils nach Zustimmung) Application und Connection einrichten und klären, ob die Anmeldung mit Benutzername geht und ob Auth0 trotzdem eine E-Mail verlangt
- [ ] 1.2 Der Nutzer legt die Familienkonten in `essenplaner-users` an; Claude liest Nutzer-IDs und Client-Secret ab und hinterlegt die Produktionswerte vor dem ersten manuellen Deploy per SSH in `/etc/essenplaner/production.env` (nicht im Chat nennen)
- [x] 1.3 Neue Konfiguration (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `PUBLIC_URL`, `ALLOWED_SUBJECTS`) mit Prüfung beim Start; Test: fehlender Wert → Start bricht mit Nennung der Variable ab

## 2. Sitzungen

- [x] 2.1 Migration `sessions` und `SessionStore` (anlegen, laden per Hash, `last_seen` aktualisieren, löschen, Ablauf nach 30 Tagen); Unit-Tests inklusive Ablauf mit fester Uhr
- [x] 2.2 Cookie-Hilfsfunktionen (Attribute abhängig von `PUBLIC_URL`); Test prüft `HttpOnly`, `SameSite=Lax` und `Secure`

## 3. Login-Flow

- [x] 3.1 OIDC-Provider per Discovery von `AUTH0_DOMAIN`; `GET /api/auth/login` mit state/nonce/PKCE und validiertem `returnTo`; Tests für relative Pfade, `//evil` und absolute URLs
- [x] 3.2 `GET /api/auth/callback` mit Token-Prüfung und Freigabeliste der Nutzer-IDs; Tests gegen einen Fake-OIDC-Provider: Erfolg, falscher state, falscher nonce, Auth0-Fehler am Callback, nicht freigegebene ID, freigegebenes Konto mit `email_verified: false` bzw. ohne E-Mail wird zugelassen
- [x] 3.3 `POST /api/auth/logout` mit Weiterleitung zu `/oidc/logout` sowie `GET /api/me`; Tests prüfen gelöschte Sitzung und die Logout-URL

## 4. Schutz

- [x] 4.1 Auth-Middleware vor `/api/` (Ausnahmen: `/api/auth/*`, `/healthz`), inklusive erneuter Prüfung der Freigabeliste; Tests: 401 ohne Cookie, 401 nach Entfernen von der Liste, 200 mit gültiger Sitzung
- [x] 4.2 Origin-Prüfung für POST/PUT/PATCH/DELETE; Tests: fremde Origin → 403, gleiche Origin → erlaubt
- [x] 4.3 Ein Test durchläuft alle registrierten `/api/…`-Routen (außer Anmeldung) und prüft 401 ohne Sitzung, damit keine Route aus den früheren Changes ungeschützt bleibt
- [x] 4.4 Sicherheits-Header-Middleware; Test prüft die Header an einer HTML- und einer API-Antwort

## 5. Frontend

- [x] 5.1 Login-Seite mit „Anmelden“ und Fehlermeldungen („Dieses Konto hat keinen Zugriff“, „Anmeldung abgebrochen“); Test
- [x] 5.2 401-Behandlung in `HttpPlannerApi` → Weiterleitung zum Login mit `returnTo`; Test
- [x] 5.3 Kopfzeile mit Profil und „Abmelden“; Test
- [ ] 5.4 Feature-Branch manuell über `deploy.yml` auf den VPS ausliefern, während HTTP Basic Auth noch aktiv ist; unter `https://essenplaner.srv1115517.hstgr.cloud` mit freigegebenem Konto an- und abmelden (danach fragt Auth0 erneut), mit einem nicht freigegebenen Konto abgewiesen werden, Deep-Link nach Login erreichen und sichere Cookies prüfen

## 6. Abschluss

- [ ] 6.1 Nach erfolgreicher Live-Prüfung die Basic-Auth-Middleware aus `deploy/docker-compose.yml` und `ESSENPLANER_BASIC_AUTH_USERS` aus der Serverkonfiguration entfernen; erneut ausliefern und prüfen, dass ein nicht angemeldeter Aufruf die Login-Seite statt einer HTTP-Basic-Auth-Abfrage zeigt
- [ ] 6.2 README, `.env.example`, `docs/deployment.md` und Rollback-Anleitung aktualisieren; vor einem Rollback auf einen Stand ohne Auth0 muss HTTP Basic Auth wieder aktiviert werden
