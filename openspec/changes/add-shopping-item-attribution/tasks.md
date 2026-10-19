## 1. Datenmodell

- [ ] 1.1 Migration `009_shopping_added_by.sql` mit `added_by_subject` und `added_by_name` (nullable) an `shopping_item_parts` anlegen. Prüfen: Der Migrationstest läuft auf einer leeren und einer Datenbank mit vorhandenen Anteilen durch, alte Anteile haben `NULL`.
- [ ] 1.2 Prüfen, dass ein Binary ohne Migration 009 mit einer migrierten Datei startet (Rollback), und das Ergebnis in design.md festhalten.

## 2. Store

- [ ] 2.1 Typ `store.Actor{Subject, Name}` einführen, `part` um den Akteur ergänzen und `insertPart` die Spalten schreiben lassen. Prüfen: Store-Test liest die Spalten nach dem Einfügen zurück.
- [ ] 2.2 `AddShoppingItem`, `AddShoppingItems`, `ImportFromPlan`, `AddStaplesToList` und `UpdateShoppingItem` (Menge) um den Parameter `by Actor` erweitern und weiterreichen. Prüfen: Tests je Weg (Eingabe, Batch, Plan, Vorrat, Menge von Hand) setzen den Namen. Zusammenführen und Umbenennen behalten ihn.
- [ ] 2.3 `ShoppingList` liest `added_by_name` in `ShoppingSource.AddedBy` und berechnet `ShoppingItem.SourceDisplay` je `source_kind` mit `quantity.Sum`/`Format`. Prüfen: Test mit „Butter“ (250 g Plan, 2 EL + 1 EL manuell) ergibt `{"plan":"250 g","manual":"3 EL"}`, alter Anteil ohne `addedBy`.

## 3. HTTP-API

- [ ] 3.1 Handler in `httpapi/shopping.go` (und der Batch-Weg der Spracheingabe) bauen den `Actor` aus `auth.SessionFrom` und reichen ihn weiter. Ohne Sitzung bleibt er leer. Prüfen: Handler-Test mit Sitzung „linh“ liefert `addedBy: "linh"`.
- [ ] 3.2 Sicherstellen, dass `subject` nirgends in der JSON-Antwort auftaucht. Prüfen: Test sucht in der Antwort nach dem Subject-String und findet ihn nicht.

## 4. Frontend-Daten

- [ ] 4.1 `types.ts`: `ShoppingSource.addedBy?` und `ShoppingItem.sourceDisplay` ergänzen, `HttpPlannerApi` unverändert durchreichen. Prüfen: `npm run build` ohne Typfehler.
- [ ] 4.2 Mock-API (`mockShopping.ts`) setzt `addedBy` mit einem festen Mock-Nutzer und berechnet `sourceDisplay` mit `sumAmounts`/`formatAmounts`. Prüfen: `MockPlannerApi.test.ts` deckt einen gemischten Artikel ab.
- [ ] 4.3 `lib/shopping.ts`: `addedByNames(item)` (eindeutig, Reihenfolge des Hinzufügens, großer Anfangsbuchstabe) und `groupBySource(list, items)` gemäß design.md. Prüfen: Unit-Tests für leere Gruppen, gemischten Artikel, Sortierung und Anteile ohne Namen.

## 5. Oberfläche

- [ ] 5.1 Artikelzeile zeigt die Namen als gedämpfte Zeile unter dem Namen, nichts bei unbekanntem Nutzer. Prüfen: `ShoppingPage.test.tsx` findet „Felix, Linh“ an „Milch“.
- [ ] 5.2 `ShoppingItemDialog` hängt „· Name“ an jeden Anteil mit bekanntem Nutzer. Prüfen: Test auf „Linsensuppe (Fr 02.10.): 2 Karotten · Felix“.
- [ ] 5.3 Umschalter „Nach Gängen | Nach Herkunft“ mit Merken in `localStorage` (`shopping.view`), Standard „Nach Gängen“. Prüfen: Test schaltet um, rendert neu und behält die Wahl.
- [ ] 5.4 Herkunftsansicht mit den Gruppen „Aus Rezepten“, „Selbst eingetragen“ und „Vorrat“ rendern. Gemischte Artikel erscheinen mehrfach mit Teilmenge, Abhaken wirkt auf alle Zeilen, und der Geschäftsfilter greift. Prüfen: Tests zu den Szenarien „Gemischter Artikel“ und „Gemischten Artikel abhaken“.
- [ ] 5.5 Teilen und Drucken bleiben nach Gängen und ohne Namen. Prüfen: Der bestehende `shareText`-Test bleibt grün, ein neuer Test stellt sicher, dass keine Namen im Text stehen.

## 6. Abschluss

- [ ] 6.1 `make test` und `npm run build` laufen grün.
- [ ] 6.2 Im Browser-Pane bei 375×812 mit Mock-Daten beide Ansichten durchklicken (Umschalter passt in die Zeile, Namen umbrechen nicht unschön) und einen Screenshot ablegen.
- [ ] 6.3 README-Abschnitt zur Einkaufsliste um Namen und Herkunftsansicht ergänzen.
