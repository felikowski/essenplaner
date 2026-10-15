## 1. Vorbereitung

- [ ] 1.1 Anleitung in `docs/auth0-setup.md`: Tenant, Regular Web Application, Callback-/Logout-/Web-Origin-URLs für lokal und Produktion, Anmeldemethoden, Selbstregistrierung abschalten, optionale Post-Login-Action; anhand der Anleitung die Anwendung anlegen und die Produktionswerte vor dem ersten manuellen Deploy in `/etc/essenplaner/production.env` hinterlegen
- [ ] 1.2 Neue Konfiguration (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `PUBLIC_URL`, `ALLOWED_EMAILS`) mit Prüfung beim Start; Test: fehlender Wert → Start bricht mit Nennung der Variable ab

## 2. Sitzungen

- [ ] 2.1 Migration `sessions` und `SessionStore` (anlegen, laden per Hash, `last_seen` aktualisieren, löschen, Ablauf nach 30 Tagen); Unit-Tests inklusive Ablauf mit fester Uhr
- [ ] 2.2 Cookie-Hilfsfunktionen (Attribute abhängig von `PUBLIC_URL`); Test prüft `HttpOnly`, `SameSite=Lax` und `Secure`

## 3. Login-Flow

- [ ] 3.1 OIDC-Provider per Discovery von `AUTH0_DOMAIN`; `GET /api/auth/login` mit state/nonce/PKCE und validiertem `returnTo`; Tests für relative Pfade, `//evil` und absolute URLs
- [ ] 3.2 `GET /api/auth/callback` mit Token-Prüfung, `email_verified` und Freigabeliste; Tests gegen einen Fake-OIDC-Provider: Erfolg, falscher state, falscher nonce, Auth0-Fehler am Callback, nicht freigegeben, E-Mail unverifiziert
- [ ] 3.3 `POST /api/auth/logout` mit Weiterleitung zu `/oidc/logout` sowie `GET /api/me`; Tests prüfen gelöschte Sitzung und die Logout-URL

## 4. Schutz

- [ ] 4.1 Auth-Middleware vor `/api/` (Ausnahmen: `/api/auth/*`, `/healthz`), inklusive erneuter Prüfung der Freigabeliste; Tests: 401 ohne Cookie, 401 nach Entfernen von der Liste, 200 mit gültiger Sitzung
- [ ] 4.2 Origin-Prüfung für POST/PUT/PATCH/DELETE; Tests: fremde Origin → 403, gleiche Origin → erlaubt
- [ ] 4.3 Ein Test durchläuft alle registrierten `/api/…`-Routen (außer Anmeldung) und prüft 401 ohne Sitzung, damit keine Route aus den früheren Changes ungeschützt bleibt
- [ ] 4.4 Sicherheits-Header-Middleware; Test prüft die Header an einer HTML- und einer API-Antwort

## 5. Frontend

- [ ] 5.1 Login-Seite mit „Anmelden“ und Fehlermeldungen („Dieses Konto hat keinen Zugriff“, „Bitte E-Mail-Adresse bestätigen“, „Anmeldung abgebrochen“); Test
- [ ] 5.2 401-Behandlung in `HttpPlannerApi` → Weiterleitung zum Login mit `returnTo`; Test
- [ ] 5.3 Kopfzeile mit Profil und „Abmelden“; Test
- [ ] 5.4 Feature-Branch manuell über `deploy.yml` auf den VPS ausliefern, während HTTP Basic Auth noch aktiv ist; unter `https://essenplaner.srv1115517.hstgr.cloud` mit freigegebenem Konto an- und abmelden (danach fragt Auth0 erneut), mit fremdem Konto abgewiesen werden, Deep-Link nach Login erreichen und sichere Cookies prüfen

## 6. Abschluss

- [ ] 6.1 Nach erfolgreicher Live-Prüfung die Basic-Auth-Middleware aus `deploy/docker-compose.yml` und `ESSENPLANER_BASIC_AUTH_USERS` aus der Serverkonfiguration entfernen; erneut ausliefern und prüfen, dass ein nicht angemeldeter Aufruf die Login-Seite statt einer HTTP-Basic-Auth-Abfrage zeigt
- [ ] 6.2 README, `.env.example`, `docs/deployment.md` und Rollback-Anleitung aktualisieren; vor einem Rollback auf einen Stand ohne Auth0 muss HTTP Basic Auth wieder aktiviert werden
