## 1. Datenquelle

- [ ] 1.1 Nutzungsbedingungen des BLS 4.0 beim Max Rubner-Institut prüfen und in `tools/bls/LICENSE-NOTES.md` festhalten (Weitergabe im Repository und Binary erlaubt? Quellenangabe?); bei Verbot den Fallback `NUTRITION_DATA_PATH` wählen und design.md entsprechend ergänzen
- [ ] 1.2 Generator `tools/bls/` (liest den offiziellen Download, schreibt `foods.json.gz` mit Code, Name, Dichte und acht Nährwerten je 100 g); ein Test mit einem kleinen Auszug prüft die Ausgabe; die erzeugte Datei ist unter 1 MB
- [ ] 1.3 Laden der Lebensmitteltabelle (eingebettet oder aus Pfad) mit Lazy-Init; Test

## 2. Berechnung

- [ ] 2.1 Normalisierung, Synonymtabelle und Token-Bewertung für die automatische Zuordnung; Tabellentest mit mindestens 60 typischen Zutaten (darunter Zwiebel, Ei, Sahne, Hähnchenbrust, Zucchini, Salz und Pfeffer) mit erwarteten Lebensmitteln bzw. „kein Treffer“
- [ ] 2.2 Umrechnung in Gramm (Gewicht, Volumen mit Dichte, Löffel, Prise, typische Stückgewichte, eigene Gewichte); Tabellentests für alle Szenarien aus „Mengen in Gramm umrechnen“
- [ ] 2.3 Rezeptberechnung mit Abdeckung, Gründen und bewusst ausgelassenen Zutaten; Tests für alle Szenarien aus „Nährwerte pro Portion“ und „Abdeckung anzeigen“
- [ ] 2.4 Tagessummen einer Woche (Rezept-, Reste- und Gefrierfach-Einträge mit Rezept, je eine Portion, Kennzeichnung „unvollständig“); Tests

## 3. Backend

- [ ] 3.1 Migration: `nutrition_mappings` und `nutrition_piece_weights`; Einstellung `showNutrition`; Migrationstest
- [ ] 3.2 Endpunkte aus „Nährwert-API“ inklusive Alias-Auflösung über `shopping_aliases`; httptest-Tests

## 4. Frontend

- [ ] 4.1 Typen und `PlannerApi`-Methoden (Http und Mock); Tests
- [ ] 4.2 Nährwertbereich in der Detailansicht mit Tabelle, Abdeckung, „Wie berechnet?“, Hinweis und Quellenangabe; Tests
- [ ] 4.3 Dialog „Ändern“ mit Lebensmittelsuche, Gewicht pro Einheit und „nicht berechnen“; Tests
- [ ] 4.4 Tagessummen im Plan und Schalter in `/einstellungen`; Tests
- [ ] 4.5 Im Browser-Pane: fünf echte Rezepte durchgehen, Zuordnungen korrigieren, Werte mit einer unabhängigen Nährwertangabe grob vergleichen (Abweichung unter 20 % bei vollständiger Abdeckung); Ergebnis im PR festhalten

## 5. Abschluss

- [ ] 5.1 `make test` grün; README mit Datenquelle, Quellenangabe und Hinweis auf Schätzwerte
