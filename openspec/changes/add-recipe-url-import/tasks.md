## 1. Abgesichertes Abrufen

- [ ] 1.1 `internal/safefetch` mit Dialer-Control, Redirect-Prüfung, Timeout, Größenlimit und Content-Type-Prüfung; Tabellentests für gesperrte Adressen (127.0.0.1, ::1, 10/8, 169.254.169.254, 100.64/10, `[::ffff:127.0.0.1]`, 0.0.0.0) und für Weiterleitung nach intern
- [ ] 1.2 Tests mit einem lokalen Testserver für Timeout, mehr als 5 MB, mehr als 5 Weiterleitungen und falschen Content-Type (der Testserver wird dafür explizit per Test-Hook erlaubt)

## 2. Rezeptdaten auslesen

- [ ] 2.1 HTML-Fixtures unter `testdata/` sammeln (mindestens Chefkoch, ein WordPress-Rezept-Plugin, Kitchen Stories, eine Seite ohne Rezept, eine mit kaputtem JSON-LD); Dateien liegen vor
- [ ] 2.2 JSON-LD-Parser mit Normalisierung aller Felder; Tests pro Fixture prüfen Titel, Bild, Portionen, Zutaten und Schritte, dazu Einzelfälle für `@graph`, `@type` als Liste und `HowToSection`
- [ ] 2.3 Ermittlung der kanonischen URL und Normalisierung; Tabellentests (utm, Fragment, Host-Großschreibung, fremde Canonical-Domain)

## 3. API

- [ ] 3.1 Migration `canonical_url` mit eindeutigem Teilindex; Migrationstest
- [ ] 3.2 `POST /api/recipes/import`: 201 neu, 200 Duplikat (inklusive Reaktivierung), 400 ungültig/intern, 422 ohne Rezeptdaten, 502 bei Abruffehler; httptest-Tests mit Fake-Fetcher
- [ ] 3.3 `DELETE /api/recipes/{id}`: `available = 0` für Web-Importe, 409 für andere Quellen, 404 unbekannt; Tests

## 4. Frontend

- [ ] 4.1 `importRecipe` und `deleteRecipe` in `PlannerApi` (Http- und Mock-Implementierung); Tests
- [ ] 4.2 Dialog „Rezept hinzufügen“ mit URL-Feld, Ladezustand, Fehlermeldung ohne Verlust der Eingabe und Navigation zum Detail; Tests für Erfolg, Duplikat und Fehler
- [ ] 4.3 „Entfernen“ im Detail von Web-Rezepten mit Bestätigung; Bilder mit `referrerpolicy="no-referrer"` und Ausblenden bei Ladefehler; Tests
- [ ] 4.4 Ende-zu-Ende manuell prüfen: je ein echtes Rezept von drei verschiedenen Seiten importieren, einplanen, entfernen und erneut importieren

## 5. Abschluss

- [ ] 5.1 README um den Rezept-Import ergänzen (unterstützte Seiten, Verhalten ohne Rezeptdaten)
