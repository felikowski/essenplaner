## 1. Setup

- [ ] 1.1 Vite-Projekt (React + TypeScript) unter `frontend/` anlegen, `npm run dev` startet und zeigt eine Platzhalterseite
- [ ] 1.2 Vitest, Testing Library, oxlint und react-router einrichten; `npm test` und `npm run lint` laufen grün mit einem Beispieltest
- [ ] 1.3 Grundlayout mit CSS-Variablen (hell/dunkel), Kopfzeile und Navigation (Woche / Rezepte) bauen; bei 375 px Breite gibt es kein horizontales Scrollen

## 2. Datenmodell und Dummy-Daten

- [ ] 2.1 Typen in `src/types.ts` gemäß design.md anlegen; `tsc -b` läuft ohne Fehler
- [ ] 2.2 `public/mock/recipes.json` mit etwa 8 Rezepten (PDF- und Web-Rezepte gemischt, manche ohne Bild/Zutaten) sowie `public/mock/weeks.json` mit Plänen für die aktuelle und die nächste Woche anlegen; ein Test prüft, dass die Dateien zu den Typen passen
- [ ] 2.3 `PlannerApi`-Interface und `MockPlannerApi` samt React-Context umsetzen; Unit-Tests decken Laden, `setDay` und das Entfernen einer Zuordnung ab

## 3. Kalenderwochen

- [ ] 3.1 `src/lib/isoWeek.ts` umsetzen (aktuelle Woche, vorige/nächste, Tage einer Woche, Formatierung „KW 40 · 2026“); Tests decken KW 53/2026 → KW 1/2027 und den 30.09.2026 → KW 40 ab

## 4. Wochenplan

- [ ] 4.1 Route `/woche/:week` mit Weiterleitung von `/` auf die aktuelle Woche; ein Test prüft, dass mit fester Uhr KW 40/2026 angezeigt wird
- [ ] 4.2 Tageskarten mit Wochentag, Datum und Rezepttitel bzw. „Noch nichts geplant“; Tippen auf den Titel öffnet das Rezeptdetail (Test)
- [ ] 4.3 Wochennavigation (vorige/nächste/Heute); ein Test prüft Blättern und Rücksprung
- [ ] 4.4 `RecipePicker` aus dem Prototyp übernehmen und um eine Suche erweitern; Tests für Auswählen, Ersetzen, „Kein Gericht“ und Abbrechen
- [ ] 4.5 Lade- und Fehlerzustände; ein Test mit fehlschlagendem `setDay` zeigt die Fehlermeldung und den unveränderten Tag

## 5. Rezeptkatalog

- [ ] 5.1 Route `/rezepte` mit alphabetischer Liste, Quellenart, Vorschaubild und Leerzustand; Test
- [ ] 5.2 Suche ohne Beachtung von Groß- und Kleinschreibung mit Hinweis „Keine Rezepte gefunden“; Test
- [ ] 5.3 Route `/rezepte/:id` mit Detailansicht, ausgeblendeten fehlenden Feldern, Quell-Link und „Rezept nicht gefunden“; Tests für Web-, PDF- und unbekanntes Rezept

## 6. Abschluss

- [ ] 6.1 README mit Startanleitung für das Frontend; `npm run build`, `npm test` und `npm run lint` laufen grün, der Ablauf im Browser ist am Handy-Viewport durchgeklickt
