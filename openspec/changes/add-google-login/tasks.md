## 1. Vorbereitung

- [ ] 1.1 Anleitung in `docs/google-cloud-setup.md`: Projekt, OAuth-Zustimmungsbildschirm, Web-Client, Redirect-URIs für lokal und Produktion; anhand der Anleitung einen lokalen Client anlegen, der funktioniert
- [ ] 1.2 Neue Konfiguration (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`, `ALLOWED_EMAILS`) mit Prüfung beim Start; Test: fehlender Wert → Start bricht mit Nennung der Variable ab

## 2. Sitzungen

- [ ] 2.1 Migration `sessions` und `SessionStore` (anlegen, laden per Hash, `last_seen` aktualisieren, löschen, Ablauf nach 30 Tagen); Unit-Tests inklusive Ablauf mit fester Uhr
- [ ] 2.2 Cookie-Hilfsfunktionen (Attribute abhängig von `PUBLIC_URL`); Test prüft `HttpOnly`, `SameSite=Lax` und `Secure`

## 3. Login-Flow

- [ ] 3.1 `GET /api/auth/login` mit state/nonce/PKCE und validiertem `returnTo`; Tests für relative Pfade, `//evil` und absolute URLs
- [ ] 3.2 `GET /api/auth/callback` mit Token-Prüfung und Freigabeliste; Tests gegen einen Fake-OIDC-Provider: Erfolg, falscher state, nicht freigegeben, E-Mail unverifiziert
- [ ] 3.3 `POST /api/auth/logout` und `GET /api/me`; Tests

## 4. Schutz

- [ ] 4.1 Auth-Middleware vor `/api/` (Ausnahmen: `/api/auth/*`, `/healthz`), inklusive erneuter Prüfung der Freigabeliste; Tests: 401 ohne Cookie, 401 nach Entfernen von der Liste, 200 mit gültiger Sitzung
- [ ] 4.2 Origin-Prüfung für PUT/POST/DELETE; Tests: fremde Origin → 403, gleiche Origin → erlaubt
- [ ] 4.3 Sicherheits-Header-Middleware; Test prüft die Header an einer HTML- und einer API-Antwort

## 5. Frontend

- [ ] 5.1 Login-Seite mit „Mit Google anmelden“ und Fehlermeldung „Dieses Konto hat keinen Zugriff“; Test
- [ ] 5.2 401-Behandlung in `HttpPlannerApi` → Weiterleitung zum Login mit `returnTo`; Test
- [ ] 5.3 Kopfzeile mit Profil und „Abmelden“; Test
- [ ] 5.4 Ende-zu-Ende manuell prüfen: mit freigegebenem Konto an- und abmelden, mit fremdem Konto abgewiesen werden, Deep-Link nach Login erreichen

## 6. Abschluss

- [ ] 6.1 README und `.env.example` aktualisieren, Warnhinweis aus `add-go-backend` durch eine Deploy-Anleitung ersetzen
