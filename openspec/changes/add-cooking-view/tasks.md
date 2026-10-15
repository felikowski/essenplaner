## 1. Logik

<!-- Untere Grenze bei Spannen (add-recipe-editor) und lib/scale.ts (add-servings-scaling) sind bereits erledigt. -->
- [x] 1.1 Zeit-Erkennung in Schritten (Zerlegung in Text und Zeit-Elemente); Tabellentests für alle genannten Schreibweisen, Spannen und Texte ohne Zeit
- [x] 1.2 `lib/substitutions.ts` mit mindestens 30 Zutaten und Suche über Namen und Varianten; Test für „Buttermilch“ und einen Fall ohne Treffer

## 2. Timer

- [x] 2.1 Timer-Context mit `localStorage`, Endzeitpunkt, Pause, +1 Minute, Abbrechen und `storage`-Event; Tests mit Fake-Timern (Neuladen, zwei Tabs)
- [x] 2.2 Timer-Leiste im Layout (kürzester zuerst, einklappbar) und Dialog „Timer stellen“; Tests
- [x] 2.3 Alarm: Web-Audio-Ton, Vibration, Vollbild-Dialog „Fertig“, „Abgelaufen vor n Minuten“ nach Rückkehr; Tests mit gemockten APIs
- [ ] 2.4 Minimaler Service Worker `sw.js` für Benachrichtigungen, Registrierung und einmalige Berechtigungsanfrage; Auslieferung durch das Go-Binary mit `no-cache` (Backend-Test); im Browser-Pane prüfen, dass bei verstecktem Tab eine Benachrichtigung erscheint. Umsetzung, Frontend-Mocktest und Backend-Test sind erledigt; die Benachrichtigung im versteckten Tab ließ sich im Browser-Pane ohne Notification-/Service-Worker-Steuerung nicht prüfen.

## 3. Oberfläche

- [x] 3.1 Vorhandenen Wake-Lock-Hook `lib/useWakeLock.ts` um den Unterstützungsstatus für die Kochansicht ergänzen; die Tests der Einkaufsliste bleiben grün
- [x] 3.2 Kochansicht `/rezepte/:id/kochen`: Überblick mit Portionenauswahl aus `add-servings-scaling` (Parameter `?portionen=` wird von „Kochen“ weitergegeben), Abhaken, Wake Lock mit Hinweis ohne Unterstützung, „Kochen“ fehlt ohne Inhalte; Tests
- [x] 3.3 Schritt-für-Schritt-Modus mit Wischen, Knöpfen, Pfeiltasten und Zutaten-Overlay; Tests
- [x] 3.4 Zeit-Elemente in Schritten starten Timer mit Rezeptname und Schrittnummer; Test
- [x] 3.5 Ersatz-Hinweise in Detail- und Kochansicht; Test
- [ ] 3.6 Teilen (Web Share, sonst Zwischenablage) mit umgerechneten Mengen und Druck-Stylesheet für Rezepte; Tests für den erzeugten Text, Druckvorschau im Browser-Pane per Screenshot. Umsetzung und Tests sind erledigt; `window.print()` öffnete im Browser-Pane keine erfassbare Druckvorschau.
- [x] 3.7 Am Handy (375 px): ein Rezept aus dem Plan mit abweichenden Portionen öffnen, im Schritt-Modus kochen, zwei Timer starten, zur Einkaufsliste wechseln, Ablauf abwarten; Screenshots

## 4. Abschluss

- [x] 4.1 `make test` grün; README um Kochansicht und das Verhalten von Timern im Hintergrund ergänzen
