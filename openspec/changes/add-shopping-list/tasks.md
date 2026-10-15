## 1. Mengen und Vorschläge

- [x] 1.1 Paket `internal/quantity`: Gruppen, Summieren, Umrechnen, Runden und deutsche Formatierung; Tabellentests mit allen Beispielen aus der Spec (700 g, 1,8 kg, „250 g + 2 EL“, 333 g, Aufrunden bei zählbaren Einheiten)
- [x] 1.2 `suggestions.json` mit rund 400 Zutaten (Ein- und Mehrzahl) und Suche inklusive zusammengesetzter Wörter; Tests für exakte Treffer, „Rinderhackfleisch“, unbekannte Namen

## 2. Datenmodell

- [x] 2.1 Migration mit allen Einkaufs-Tabellen, vorbelegten Kategorien und `shopping_meta`; Migrationstest
- [x] 2.2 Store: Liste lesen mit berechneten Mengen, Herkunft und Sortierung (Kategorie-Reihenfolge, offen vor erledigt); Tests
- [x] 2.3 Store: Artikel anlegen (Parser, Schlüssel, Alias, Zusammenfassen mit offenem Artikel, Kategorie und Geschäft aus Gemerktem oder Vorschlag), ändern (inklusive Merken der Wahl), abhaken, löschen, erledigte entfernen; jede Schreiboperation erhöht die Version; Tests
- [x] 2.4 Store: Zusammenführen mit Alias und Abflachen von Ketten; Tests
- [x] 2.5 Store: Übernahme aus dem Plan (Faktor, Reste und Notizen überspringen, bereits übernommene Einträge, Einzelzutaten, `withoutIngredients`); Tests für alle Szenarien aus „Aus dem Plan übernehmen“
- [x] 2.6 Store: Kategorien (löschen verschiebt nach Sonstiges, Sonstiges nicht löschbar, Reihenfolge), Geschäfte, Aliasse, Vorrat; Tests

## 3. API

- [x] 3.1 Alle Endpunkte aus design.md mit Validierung und einheitlichen Fehlern; httptest-Tests pro Endpunkt
- [x] 3.2 ETag und 304 für die Liste; Test

## 4. Frontend

- [x] 4.1 Typen und `PlannerApi`-Methoden für die Einkaufsliste (Http und Mock); Tests
- [x] 4.2 Hook für Abfragen alle 10 s bei sichtbarer Seite mit ETag; Test mit Fake-Timern und `visibilitychange`
- [x] 4.3 Seite `/einkauf`: Kategorien, Abhaken (optimistisch), Hinzufügen, leere Liste, Erledigte entfernen, Navigationseintrag; Tests
- [x] 4.4 Artikeldetails (über ⋯, ohne langes Tippen): Herkunft, Kategorie, Geschäft, Zusammenführen, Zum Vorrat, Löschen; Tests
- [x] 4.5 Dialog „Aus dem Plan übernehmen“ mit Zeitraum (Standard heute + 6 Tage) und Hinweis auf Rezepte ohne Zutaten mit Link zum Bearbeiten; Tests
- [x] 4.6 Geschäftsfilter (im `localStorage` gemerkt, ausgeblendet ohne Geschäfte); Test
- [x] 4.7 Seite `/einkauf/vorrat` und „Vorrat prüfen“; Tests
- [x] 4.8 Einstellungen „Einkauf“: Kategorien (umbenennen, anlegen, löschen, sortieren), Geschäfte, gemerkte Zusammenführungen; Tests
- [x] 4.9 Teilen (Web Share, sonst Zwischenablage) und Druck-Stylesheet; Tests für den erzeugten Text
- [x] 4.10 Wake Lock mit erneuter Anforderung bei `visibilitychange`; Test mit gemocktem `navigator.wakeLock`

## 5. Ende-zu-Ende

- [x] 5.1 Im Browser-Pane (375 px): eine Woche mit drei Rezepten und einer Einzelzutat planen, übernehmen, zwei Artikel zusammenführen, eine Kategorie ändern, erneut übernehmen (keine Doppelten), abhaken, aufräumen; Screenshot (Einträge über die API angelegt, der Rest über die Oberfläche; dabei fiel die zu breite Kopfzeile auf und wurde behoben)
- [x] 5.2 Zwei Browser-Tabs gleichzeitig: Abhaken im einen erscheint im anderen innerhalb von 15 s (Änderung aus dem zweiten Tab über die API, sichtbarer Tab hat sie per Abfrage übernommen; ein Hintergrund-Tab fragt absichtlich nicht nach)
- [x] 5.3 `make test` grün; README um die Einkaufsliste ergänzen


Nicht im Browser geprüft: Teilen über das Teilen-Menü eines echten Handys, die Druckansicht auf Papier und der Wake Lock auf einem Gerät (alle drei nur per Test).
