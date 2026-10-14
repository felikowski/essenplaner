## Context

Nach `add-recipe-editor` haben Zutaten `text`, `quantity`, `unit`, `name` und `note`, und es gibt einen Parser in Go und TypeScript mit einer festen Einheitentabelle. Nach `add-planner-flexibility` gibt es `plan_entries` mit Rezept-, Reste-, Notiz- und Einzelzutat-Einträgen, Portionen pro Eintrag und eine Registry für Haushalts-Einstellungen. Die App läuft bis `add-auth0-login` nur lokal, die Familie nutzt sie später überwiegend am Handy. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Die Herkunft jeder Menge bleibt nachvollziehbar, und die Liste lässt sich jederzeit aus ihren Bestandteilen neu berechnen.
- Zwei Personen können gleichzeitig mit der Liste arbeiten, ohne dass Abhaken verloren geht.
- Einmal getroffene Entscheidungen (Kategorie, Geschäft, Zusammenführung) muss niemand ein zweites Mal treffen.

**Non-Goals:**
- Echtzeit-Push (WebSocket/SSE). Abfragen alle 10 Sekunden genügen beim Einkaufen.
- Offline-Modus mit Synchronisierung
- Automatische Erkennung von Ein- und Mehrzahl. Sie ist im Deutschen unzuverlässig („Ei“/„Eier“, „Tomate“/„Tomaten“, aber „Reis“). Dafür gibt es das gelernte Zusammenführen.
- Spätere Änderungen am Plan (Portionen geändert, Eintrag gelöscht) automatisch in die Liste nachziehen

## Decisions

**Artikel bestehen aus Anteilen.**
- `shopping_items (id, key, name, category_id, store_id NULL, checked, position_hint, created_at)`
- `shopping_item_parts (id, item_id ON DELETE CASCADE, quantity REAL NULL, unit TEXT NULL, source_kind ('plan','manual','staple'), entry_id NULL, recipe_title NULL, date NULL, text)`

Jede übernommene Zutat wird ein Anteil. Die angezeigte Menge wird beim Lesen aus den Anteilen berechnet. So ist die Herkunft („Linsensuppe (Fr 02.10.): 2 Karotten“) ohne Zusatzaufwand verfügbar, und Fehler in der Mengenarithmetik lassen sich korrigieren, ohne Daten zu migrieren. Gespeicherte Summen wären einfacher zu lesen, aber sie verlieren die Herkunft, und Fehler blieben dauerhaft in den Daten. Ändert der Nutzer die Menge eines Artikels von Hand, ersetzt ein einzelner Anteil `manual` alle bisherigen. Die Herkunft geht dann bewusst verloren.

**Schlüssel und Zusammenführungen.** `key` = Name in Kleinbuchstaben, Leerraum zusammengezogen, „ß“ bleibt. Danach wird über `shopping_aliases (from_key PK, to_key)` aufgelöst, höchstens eine Stufe. Beim Anlegen einer Ziel-Zusammenführung werden Ketten flachgezogen. Ein Artikel ist eindeutig pro `(key, checked = 0)`: Neue Anteile hängen sich an den offenen Artikel, abgehakte Artikel bleiben unberührt. Wer schon Milch im Wagen hat und neu übernimmt, bekommt einen neuen offenen Artikel „Milch“.

**Übernahme merkt sich Einträge.** `shopping_imported_entries (entry_id PK, imported_at)` verhindert doppelte Übernahme, auch nachdem Artikel gelöscht wurden. Der Eintrag wird über `ON DELETE CASCADE` an `plan_entries` gebunden. Verschwindet ein Eintrag aus dem Plan und wird neu angelegt, gilt er als neu. Die Übernahme läuft serverseitig in einer Transaktion: Einträge lesen, Faktor bilden, Zutaten mit Menge × Faktor als Anteile anlegen. Einzelzutaten werden mit dem Parser zerlegt.

**Mengenarithmetik in einem eigenen Paket** (`internal/quantity`):
- Dimensionen: Masse (mg, g, kg), Volumen (ml, cl, dl, l), Anzahl (keine Einheit). Jede andere Einheit ist eine eigene Gruppe.
- Summiert wird je Gruppe in der Basiseinheit. Angezeigt wird ab 1000 in kg bzw. l.
- Runden für die Anzeige: g und ml auf ganze Zahlen; kg und l auf eine Nachkommastelle; Anzahl und zählbare Einheiten (Stück, Dose, Pck., Bund, Zehe, Kopf, Glas, Becher, Stange, Würfel) aufrunden auf ganze Zahlen, weil man keine 2,7 Karotten kauft; alle übrigen auf ein halbes. Unicode-Brüche werden für ½ verwendet.
- Die Anzeige liefert das Backend fertig formatiert (`display: "250 g + 2 EL"`) zusammen mit den Rohgruppen. So formatiert das Frontend nicht zum zweiten Mal.

**Kategorien und Vorschläge.**
- `shopping_categories (id, name, position, builtin_slug NULL)`, vorbelegt mit 13 Kategorien: Obst & Gemüse, Brot & Backwaren, Milchprodukte & Eier, Käse, Fleisch & Fisch, Tiefkühl, Nudeln/Reis/Getreide, Konserven & Saucen, Backen, Gewürze & Öle, Süßes & Snacks, Getränke, Drogerie & Haushalt, dazu „Sonstiges“ (nicht löschbar).
- Vorschläge kommen aus einer eingebetteten Datei `suggestions.json` (Schlüssel → `builtin_slug`) mit rund 400 deutschen Zutaten in Ein- und Mehrzahl.
- Reihenfolge der Suche: gemerkte Wahl in `shopping_name_prefs (key PK, category_id NULL, store_id NULL)` → exakter Vorschlag → längster bekannter Wortanfang oder Wortende bei zusammengesetzten Wörtern („Rinderhackfleisch“ → „hackfleisch“) → Sonstiges.
- Wurde die vorgeschlagene Kategorie gelöscht, greift „Sonstiges“.
- Ein Dienst im Netz (zum Beispiel ein LLM) wäre treffsicherer, aber er bringt eine externe Abhängigkeit und Kosten mit sich und schickt Daten nach außen. Die gelernte Wahl gleicht die Lücken schnell aus.

**Geschäfte** in `shopping_stores (id, name, position)`. Den Filter merkt sich jedes Gerät im `localStorage`, weil das eine Ansichtseinstellung ist und kein Haushaltsdatum.

**Synchronisierung mit Version und ETag.** `shopping_meta (version INTEGER)` wird bei jeder schreibenden Anfrage in derselben Transaktion erhöht. `GET /api/shopping/list` liefert `ETag: "v<version>"` und beantwortet `If-None-Match` mit 304. Das Frontend fragt alle 10 Sekunden, solange `document.visibilityState === 'visible'`, und sofort beim Zurückkehren auf die Seite. Abhaken ist idempotent (`PUT …/checked` mit `true`/`false` statt Umschalten), damit zwei gleichzeitige Taps nicht gegeneinander arbeiten. Änderungen zeigt das Frontend sofort an (optimistisch) und gleicht mit der Antwort ab.

**Endpunkte:**
- `GET /api/shopping/list`
- `POST /api/shopping/items` (Text)
- `PATCH /api/shopping/items/{id}` (Name, Menge als Text, Kategorie, Geschäft)
- `PUT /api/shopping/items/{id}/checked`
- `DELETE /api/shopping/items/{id}`
- `POST /api/shopping/items/{id}/merge-into/{targetId}`
- `POST /api/shopping/import` (`from`, `to`; Antwort: Liste und `withoutIngredients`)
- `POST /api/shopping/clear-checked`
- CRUD unter `/api/shopping/categories`, `/api/shopping/stores`, `/api/shopping/aliases` und `/api/shopping/staples`, dazu `POST /api/shopping/staples/add` (IDs)
- Schreibende Antworten liefern die vollständige Liste.

**Vorrat** in `shopping_staples (id, text, key, position)`. Übernahme als Anteil `staple`.

**Frontend:**
- Seite `/einkauf` mit Kategorien als Abschnitten und großen Tippflächen (mindestens 48 px)
- Oben ein Eingabefeld „Artikel hinzufügen“, darunter Knöpfe für Plan, Vorrat, Teilen und Erledigte entfernen
- Ein Artikel antippen hakt ab, ein langes Tippen oder das ⋯-Menü öffnet die Details (Herkunft, Kategorie, Geschäft, Zusammenführen, Zum Vorrat, Löschen).
- Kategorien und Geschäfte werden in `/einstellungen` unter „Einkauf“ verwaltet.
- Wake Lock über `navigator.wakeLock.request('screen')`, das bei `visibilitychange` erneut angefordert wird.

## Risks / Trade-offs

- [Vorschläge für Kategorien liegen daneben] → Ein Tippen korrigiert sie, und das wird gemerkt. Die Vorschlagsliste ist leicht erweiterbar.
- [Abfragen alle 10 s kosten Akku und Datenvolumen] → Nur bei sichtbarer Seite, und 304 ohne Inhalt sind wenige Bytes.
- [Plan ändert sich nach der Übernahme] → Die Herkunft zeigt, woher eine Menge kommt. Ein „Neu übernehmen“ für einzelne Einträge ist ein möglicher späterer Ausbau. Bis dahin bleibt es bei Hand korrigieren.
- [Wake Lock fehlt in älteren Browsern] → Die Funktion wird nur genutzt, wenn sie vorhanden ist. Ohne sie gibt es keine Fehlermeldung.
- [Eine Zutat erscheint doppelt, weil ein Rezept „Zwiebel“ und ein anderes „Zwiebeln“ sagt] → Einmal zusammenführen, danach dauerhaft gelöst.

## Migration Plan

Neue Tabellen mit vorbelegten Kategorien. Bestehende Daten ändern sich nicht. Rollback: vorheriges Image deployen; die neuen Tabellen stören nicht.
