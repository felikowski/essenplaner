## Context

Nach `add-go-backend` gibt es ein Go-Binary mit SQLite, das API und Frontend unter derselben Origin ausliefert. Einen Zugriffsschutz gibt es noch nicht. Die Nutzer sind eine Familie mit Google-Konten.

## Goals / Non-Goals

**Goals:**
- Sicher genug für den öffentlichen Betrieb, ohne eigene Passwortverwaltung
- Einfach zu konfigurieren: Freigabeliste per Umgebungsvariable

**Non-Goals:**
- Rollen oder Rechte pro Nutzer (alle Freigegebenen dürfen alles)
- Nutzerverwaltung in der UI
- Andere Anmeldeanbieter

## Decisions

**Serverseitiger OIDC Authorization Code Flow mit PKCE** über `golang.org/x/oauth2` und `coreos/go-oidc`. Das Backend tauscht den Code und prüft das ID-Token (Signatur, `aud`, `iss`, `exp`, `nonce`). Das Frontend sieht nie ein Google-Token. Die Alternative, Google Identity Services im Browser zu nutzen und das ID-Token ans Backend zu schicken, ist ebenfalls möglich. Der Server-Flow passt aber besser zum späteren Drive-Consent, der ohnehin serverseitig laufen muss.

Routen: `GET /api/auth/login?returnTo=…` setzt ein kurzlebiges, signiertes Cookie mit `state`, `nonce`, PKCE-Verifier und `returnTo` und leitet dann zu Google weiter. Danach folgen `GET /api/auth/callback`, `POST /api/auth/logout` und `GET /api/me`. Als `returnTo` sind nur relative Pfade erlaubt, die mit `/` beginnen und nicht mit `//`.

**Serverseitige Sitzungen in SQLite** statt eines zustandslosen JWT-Cookies: `sessions(id_hash PK, email, name, picture, created_at, last_seen_at)`. Das Cookie enthält eine zufällige 256-Bit-ID, gespeichert wird nur ihr SHA-256-Hash. Vorteile: echtes Abmelden, Sitzungen lassen sich widerrufen, und es gibt keinen Schlüssel für die Token-Signatur, der rotiert werden müsste. `last_seen_at` wird höchstens einmal pro Stunde aktualisiert.

**Freigabeliste bei jeder Anfrage prüfen:** Die Middleware lädt die Sitzung und prüft die E-Mail-Adresse gegen die Liste (`ALLOWED_EMAILS`, kommagetrennt, beim Start normalisiert). Ein entferntes Konto verliert so beim nächsten Neustart des Dienstes den Zugriff, ohne dass eine Nutzerverwaltung nötig ist.

**CSRF-Schutz:** `SameSite=Lax` sowie bei PUT/POST/DELETE eine Prüfung, dass `Origin` (ersatzweise `Sec-Fetch-Site: same-origin`) zur konfigurierten `PUBLIC_URL` passt. Weil API und UI dieselbe Origin haben, ist kein Token-Mechanismus nötig.

**Sicherheits-Header** für alle Antworten: `Content-Security-Policy` (default-src 'self'; img-src 'self' https: data:), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, wenn die App über https läuft.

**Lokale Entwicklung:** Google erlaubt `http://localhost` als Redirect-URI. `PUBLIC_URL=http://localhost:5173` im Dev-Modus; Vite leitet `/api/auth/*` ebenfalls weiter. Das `Secure`-Flag entfällt nur, wenn `PUBLIC_URL` mit `http://localhost` beginnt.

**Neue Konfiguration:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`, `ALLOWED_EMAILS`. Fehlt einer dieser Werte, startet der Dienst nicht und nennt die fehlende Variable.

## Risks / Trade-offs

- [Die App läuft hinter einem Reverse Proxy mit TLS-Terminierung] → Wir verlassen uns für Redirect-URI und Origin-Prüfung ausschließlich auf `PUBLIC_URL` und nicht auf Host- oder X-Forwarded-Header.
- [Der OAuth-Zustimmungsbildschirm steht im Modus „Testing“ (maximal 100 Testnutzer, Refresh-Tokens laufen nach 7 Tagen ab)] → Für das Login ist das unerheblich, weil wir keine Refresh-Tokens des Nutzers speichern. Für Drive siehe `add-google-drive-recipes`.
- [Tests brauchen Google] → Der Token-Austausch und die Prüfung liegen hinter einem Interface. Tests nutzen einen Fake-OIDC-Provider mit `httptest`.

## Migration Plan

Neue Migration für `sessions`. Vor dem Deploy müssen die neuen Umgebungsvariablen gesetzt sein, sonst startet der Dienst bewusst nicht. Rollback: das vorherige Binary deployen; die zusätzliche Tabelle stört nicht.
