## 1. Logik

- [ ] 1.1 Frontend-Parser liefert bei Spannen zusätzlich die untere Grenze; die gemeinsamen Testfälle aus `testdata/ingredient-cases.json` bleiben grün, und neue Fälle prüfen die untere Grenze
- [ ] 1.2 `lib/scale.ts` mit allen Rundungsregeln und Spannen; Tabellentests für alle Szenarien aus „Portionen umrechnen“ und jede Rundungsregel
- [ ] 1.3 Zeit-Erkennung in Schritten (Zerlegung in Text und Zeit-Elemente); Tabellentests für alle genannten Schreibweisen, Spannen und Texte ohne Zeit
- [ ] 1.4 `lib/substitutions.ts` mit mindestens 30 Zutaten und Suche über Namen und Varianten; Test für „Buttermilch“ und einen Fall ohne Treffer

## 2. Timer

- [ ] 2.1 Timer-Context mit `localStorage`, Endzeitpunkt, Pause, +1 Minute, Abbrechen und `storage`-Event; Tests mit Fake-Timern (Neuladen, zwei Tabs)
- [ ] 2.2 Timer-Leiste im Layout (kürzester zuerst, einklappbar) und Dialog „Timer stellen“; Tests
- [ ] 2.3 Alarm: Web-Audio-Ton, Vibration, Vollbild-Dialog „Fertig“, „Abgelaufen vor n Minuten“ nach Rückkehr; Tests mit gemockten APIs
- [ ] 2.4 Minimaler Service Worker `sw.js` für Benachrichtigungen, Registrierung und einmalige Berechtigungsanfrage; Auslieferung durch das Go-Binary mit `no-cache` (Backend-Test); im Browser-Pane prüfen, dass bei verstecktem Tab eine Benachrichtigung erscheint

## 3. Oberfläche

- [ ] 3.1 Wake-Lock-Hook nach `lib/useWakeLock.ts` verschieben; die Tests der Einkaufsliste bleiben grün
- [ ] 3.2 Portionenauswahl mit URL-Parameter in der Detailansicht; Link aus dem Planeintrag mit dessen Portionen; Tests
- [ ] 3.3 Kochansicht `/rezepte/:id/kochen`: Überblick, Abhaken, Wake Lock mit Hinweis ohne Unterstützung, „Kochen“ fehlt ohne Inhalte; Tests
- [ ] 3.4 Schritt-für-Schritt-Modus mit Wischen, Knöpfen, Pfeiltasten und Zutaten-Overlay; Tests
- [ ] 3.5 Zeit-Elemente in Schritten starten Timer mit Rezeptname und Schrittnummer; Test
- [ ] 3.6 Ersatz-Hinweise in Detail- und Kochansicht; Test
- [ ] 3.7 Teilen (Web Share, sonst Zwischenablage) mit umgerechneten Mengen und Druck-Stylesheet für Rezepte; Tests für den erzeugten Text, Druckvorschau im Browser-Pane per Screenshot
- [ ] 3.8 Am Handy (375 px): ein Rezept aus dem Plan mit abweichenden Portionen öffnen, im Schritt-Modus kochen, zwei Timer starten, zur Einkaufsliste wechseln, Ablauf abwarten; Screenshots

## 4. Abschluss

- [ ] 4.1 `make test` grün; README um Kochansicht und das Verhalten von Timern im Hintergrund ergänzen
