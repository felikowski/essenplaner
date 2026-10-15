## Context

Diese Change wird direkt nach `add-vps-deployment` umgesetzt. Das Go-Binary mit SQLite liefert API und Frontend unter derselben Origin aus und läuft bereits unter `https://essenplaner.srv1115517.hstgr.cloud`. Bis die Anmeldung dort erfolgreich geprüft ist, schützt Traefik alle Pfade außer `/healthz` mit HTTP Basic Auth. Als dauerhafter Identitätsanbieter dient Auth0.

## Goals / Non-Goals

**Goals:**
- Sicher genug für den öffentlichen Betrieb, ohne eigene Passwortverwaltung
- Anmeldemethoden lassen sich in Auth0 ändern, ohne den Code anzufassen
- Wer Zugriff hat, steht in der Konfiguration der App, nicht versteckt in Auth0

**Non-Goals:**
- Rollen oder Rechte pro Nutzer (alle Freigegebenen dürfen alles)
- Nutzerverwaltung in der UI
- Zugriffstokens für eine Auth0-API (die App braucht nur die Identität des Nutzers)

## Decisions

**Serverseitiger OIDC Authorization Code Flow mit PKCE** über `golang.org/x/oauth2` und `coreos/go-oidc`. Die Endpunkte kommen per Discovery von `https://<AUTH0_DOMAIN>/` (der Issuer endet bei Auth0 mit `/`). Die Anwendung ist in Auth0 als „Regular Web Application“ mit Client-Secret angelegt, Scopes `openid profile email`. Das Backend tauscht den Code und prüft das ID-Token (Signatur per JWKS, `aud`, `iss`, `exp`, `nonce`). Das Frontend sieht nie ein Token.
- Alternative: das Auth0 React SDK (SPA mit Access Token im Browser) plus JWT-Prüfung im Go-Backend. Verworfen: Tokens lägen im Browser und jede API-Anfrage bräuchte einen Bearer-Header. Der Server-Flow mit Cookie-Sitzung passt besser zu einer Anwendung mit gleicher Origin.

Routen: `GET /api/auth/login?returnTo=…` setzt ein kurzlebiges, signiertes Cookie mit `state`, `nonce`, PKCE-Verifier und `returnTo` und leitet dann zu Auth0 weiter. Danach folgen `GET /api/auth/callback`, `POST /api/auth/logout` und `GET /api/me`. Als `returnTo` sind nur relative Pfade erlaubt, die mit `/` beginnen und nicht mit `//`. Liefert Auth0 `error`/`error_description` am Callback, leitet das Backend auf `/login?fehler=…` mit einem festen, übersetzten Fehlercode weiter und nie mit dem rohen Text.

**Freigabeliste in der App** (`ALLOWED_EMAILS`, kommagetrennt, beim Start normalisiert). Sie wird bei jeder Anfrage in der Middleware geprüft, dazu beim Login `email_verified == true`. Zusätzlich empfiehlt die Setup-Anleitung, in Auth0 die Selbstregistrierung abzuschalten und optional eine Post-Login-Action als zweite Schicht einzurichten. Die App verlässt sich darauf aber nicht, damit eine Fehlkonfiguration in Auth0 keinen Zugang öffnet.

**Serverseitige Sitzungen in SQLite** statt eines zustandslosen JWT-Cookies: `sessions(id_hash PK, subject, email, name, picture, created_at, last_seen_at)`. Das Cookie enthält eine zufällige 256-Bit-ID, gespeichert wird nur ihr SHA-256-Hash. Vorteile: echtes Abmelden, Sitzungen lassen sich widerrufen, und das ID-Token muss nicht aufbewahrt werden. `last_seen_at` wird höchstens einmal pro Stunde aktualisiert.

**Abmelden bei Auth0:** `POST /api/auth/logout` löscht die Sitzung und das Cookie. Danach leitet es auf den RP-Initiated-Logout-Endpunkt `https://<AUTH0_DOMAIN>/oidc/logout?client_id=…&post_logout_redirect_uri=<PUBLIC_URL>/login` weiter. Ohne diesen Schritt würde die weiterhin bestehende Auth0-Sitzung den Nutzer beim nächsten Klick auf „Anmelden“ sofort wieder einloggen. Die URL muss in Auth0 unter „Allowed Logout URLs“ eingetragen sein.

**CSRF-Schutz:** `SameSite=Lax` sowie bei POST/PUT/PATCH/DELETE eine Prüfung, dass `Origin` (ersatzweise `Sec-Fetch-Site: same-origin`) zur konfigurierten `PUBLIC_URL` passt. Weil API und UI dieselbe Origin haben, ist kein Token-Mechanismus nötig.

**Sicherheits-Header** für alle Antworten: `Content-Security-Policy` (default-src 'self'; img-src 'self' https: data:). `default-src 'self'` deckt über die Fallback-Kette auch `worker-src` für `/sw.js` ab. Bilder importierter Rezepte kommen von fremden https-Servern., `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, wenn die App über https läuft. Die Weiterleitungen zu Auth0 sind Navigationen und werden von der CSP nicht eingeschränkt.

**Lokale Entwicklung:** In derselben Auth0-Anwendung (oder in einer eigenen Dev-Anwendung) werden `http://localhost:5173/api/auth/callback` und `http://localhost:5173/login` als erlaubte URLs eingetragen. `PUBLIC_URL=http://localhost:5173`; Vite leitet `/api/auth/*` ebenfalls weiter. Das `Secure`-Flag entfällt nur, wenn `PUBLIC_URL` mit `http://localhost` beginnt.

**Neue Konfiguration:** `AUTH0_DOMAIN` (auch eine Custom Domain ist möglich), `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `PUBLIC_URL`, `ALLOWED_EMAILS`. Fehlt einer dieser Werte, startet der Dienst nicht und nennt die fehlende Variable.

**Ablösung des temporären Schutzes in zwei Schritten.** Die Auth0-Werte werden zuerst in `/etc/essenplaner/production.env` hinterlegt. Dann wird der Feature-Branch manuell über den vorhandenen Deployment-Workflow ausgeliefert, während HTTP Basic Auth noch aktiv ist, und der komplette Anmeldeablauf wird auf der Produktionsadresse geprüft. Erst danach werden die Basic-Auth-Middleware und `ESSENPLANER_BASIC_AUTH_USERS` aus Compose und Serverkonfiguration entfernt und derselbe Stand erneut ausgeliefert. Ein Rollback auf einen Stand vor Auth0 darf nur erfolgen, wenn vorher der temporäre Proxy-Schutz wieder aktiviert wurde.

## Risks / Trade-offs

- [Die App läuft hinter einem Reverse Proxy mit TLS-Terminierung] → Wir verlassen uns für Callback-URL und Origin-Prüfung ausschließlich auf `PUBLIC_URL` und nicht auf Host- oder X-Forwarded-Header.
- [Auth0 ist eine externe Abhängigkeit, bei einem Ausfall ist keine Anmeldung möglich] → Bestehende Sitzungen laufen weiter, weil sie lokal geprüft werden. Nur neue Anmeldungen sind betroffen.
- [Grenzen des Auth0-Free-Plans] → Für eine Familie weit ausreichend. Kostenpflichtige Features wie Custom Domain oder Actions-Integrationen werden nicht vorausgesetzt.
- [Tests brauchen Auth0] → Der Token-Austausch und die Prüfung liegen hinter einem Interface. Tests nutzen einen Fake-OIDC-Provider mit `httptest` (Discovery, JWKS, Token-Endpunkt).
- [Die erste Auth0-Version ist fehlerhaft] → Der temporäre HTTP-Basic-Auth-Schutz bleibt während des ersten Produktions-Tests aktiv und wird erst nach erfolgreicher Anmeldung entfernt.

## Migration Plan

Neue Migration für `sessions`. Vor dem ersten manuellen Deploy müssen die neuen Umgebungsvariablen auf dem VPS gesetzt und die Produktions-URLs in Auth0 eingetragen sein, sonst startet der Dienst bewusst nicht. Nach erfolgreicher Prüfung wird der temporäre Proxy-Schutz entfernt. Rollback auf eine bereits durch Auth0 geschützte Version ist ohne weitere Schritte möglich; vor einem Rollback auf eine ältere, ungeschützte Version muss HTTP Basic Auth wieder aktiviert werden. Die zusätzliche Tabelle stört ältere Binaries nicht.
