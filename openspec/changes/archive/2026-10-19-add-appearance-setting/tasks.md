## 1. Farbschema

- [x] 1.1 `index.css`: dunkle Variablen zusätzlich unter `:root[data-theme='dark']`, Media-Query auf `:root:not([data-theme='light'])` beschränken, `color-scheme` je Attribut setzen. Prüfen: Druckansicht setzt weiterhin `color-scheme: light`.
- [x] 1.2 `lib/theme.ts` mit `readTheme`, `applyTheme`, `saveTheme`. Prüfen: Unit-Tests für Speichern, Entfernen und ungültige Werte.
- [x] 1.3 `public/theme.js` im `<head>` von `index.html` laden. Prüfen: Läuft unter der CSP ohne Fehler in der Konsole.

## 2. Einstellungsseite

- [x] 2.1 Bereich „Darstellung“ mit drei Radio-Optionen am Ende der Seite, Hinweis, dass die Wahl nur für dieses Gerät gilt. Prüfen: Seitentest wählt „Dunkel“, prüft `data-theme` und `localStorage`, ruft `updateSettings` nicht auf.

## 3. Abschluss

- [x] 3.1 `make test` und `npm run build` laufen grün.
- [x] 3.2 Im Browser-Pane bei dunklem System „Hell“ wählen, neu laden und prüfen, dass nichts aufblitzt und die Wahl bleibt.
  - Umsetzung: gegen das lokale Backend (Platzhalter-Auth0, Sitzung per sqlite3) bei 375×812. Geprüft: dunkles System + „Hell“ → helle Farben und `color-scheme: light`, bleibt nach dem Neuladen; helles System + „Dunkel“ → dunkle Farben sofort; keine CSP-Fehler für `theme.js`. Druckansicht nur per Spezifität (`:where()`) abgesichert, nicht im Browser gedruckt.
