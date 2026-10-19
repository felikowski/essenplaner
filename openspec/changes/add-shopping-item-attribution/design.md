## Context

Ein Artikel der Einkaufsliste (`shopping_items`) besteht aus Anteilen (`shopping_item_parts`). Jeder Anteil hat schon eine Herkunft in `source_kind` (`plan`, `manual`, `staple`) und bei `plan` Rezept und Datum. Die API liefert die Anteile als `sources` am Artikel, das Frontend zeigt sie nur im `ShoppingItemDialog`. Die Seite gruppiert über `groupByCategory` aus `lib/shopping.ts`.

Den angemeldeten Nutzer liefert `auth.SessionFrom(ctx)` mit `Subject` und `Name`. Der Name ist schon so aufbereitet, dass er für Menschen lesbar ist (`preferred_username`, Nickname, Name oder E-Mail), bei uns „felix“ und „linh“. Die Store-Methoden kennen den Nutzer bisher nicht.

Spracheingabe und Batch landen in `AddShoppingItems` und schreiben `manual`. Zwischen Eingabefeld und Spracheingabe wird nicht unterschieden. Das passt, weil beide in die Gruppe „Selbst eingetragen“ gehören.

## Goals / Non-Goals

**Goals:**
- Person je Anteil speichern und anzeigen, ohne die Logik des Zusammenfassens zu ändern.
- Herkunftsansicht rein im Frontend aus den vorhandenen Anteilen berechnen.

**Non-Goals:**
- Kein Filter „nur meine Artikel“, keine Zuständigkeiten („wer kauft was“).
- Kein Verlauf, wer abgehakt oder gelöscht hat.
- Keine eigene Quelle „Sprache“ neben „Selbst eingetragen“.
- Namen werden nicht nachträglich aktualisiert, wenn sich ein Konto umbenennt.

## Decisions

### Person als Spalten am Anteil, Name als Momentaufnahme
Migration `009_shopping_added_by.sql` ergänzt `shopping_item_parts` um `added_by_subject TEXT` und `added_by_name TEXT` (beide nullable). Gespeichert wird der Name zum Zeitpunkt des Eintragens.
- *Alternative:* nur `subject` speichern und den Namen beim Lesen aus `sessions` holen. Verworfen: Sitzungen laufen ab und werden gelöscht, dann fehlte der Name. Eine eigene Nutzertabelle gibt es nicht und lohnt sich für zwei Konten nicht.
- `subject` wird nur gespeichert, damit Konten später sauber unterscheidbar bleiben. Ausgeliefert wird er nicht.

### Nutzer über einen Parameter an den Store übergeben
Die schreibenden Store-Methoden (`AddShoppingItem`, `AddShoppingItems`, `UpdateShoppingItem` mit Menge, `ImportFromPlan`, `AddStaplesToList`) bekommen einen Parameter `by store.Actor{Subject, Name}`. Die Handler bauen ihn aus `auth.SessionFrom`. `part` bekommt ein Feld `actor`, und `insertPart` schreibt es mit. Ohne Sitzung (lokale Entwicklung ohne Auth0, Tests) ist der `Actor` leer, und die Spalten bleiben `NULL`.
- *Alternative:* den Nutzer aus dem `context` im Store lesen. Verworfen, weil der Store dann von `auth` abhinge und die Abhängigkeit unsichtbar wäre.

### `addedBy` am Anteil, Menge je Quelle vom Backend
`ShoppingSource` bekommt `AddedBy string \`json:"addedBy,omitempty"\``. `ShoppingItem` bekommt `SourceDisplay map[string]string \`json:"sourceDisplay"\``, also die formatierte Menge je `source_kind` (z. B. `{"plan": "250 g", "manual": "2 EL"}`). Leer ist sie bei Anteilen ohne Menge. Berechnet wird sie im Backend mit demselben `quantity.Sum`/`Format` wie `Display`, sodass Einheiten genauso umgerechnet und zusammengefasst werden wie in der Gangansicht.
- *Alternative:* im Frontend aus `sources[].amount` summieren. Verworfen: `amount` ist nur Text, und die Umrechnungslogik gäbe es dann ein zweites Mal (heute steckt sie in Go und in der Mock-API).
Die Namensliste am Artikel berechnet das Frontend aus `sources`. Das `ETag` der Liste hängt an `shopping_meta.version` und ändert sich ohnehin bei jedem Schreiben. Dafür ist nichts zu tun.

### Herkunftsansicht: Artikel je Gruppe aufteilen
`lib/shopping.ts` bekommt `groupBySource(list, visible)`. Die Funktion liefert Gruppen `plan` → „Aus Rezepten“, `manual` → „Selbst eingetragen“ und `staple` → „Vorrat“ mit Einträgen `{ item, display, names }`. `display` stammt aus `item.sourceDisplay[kind]`, `names` aus den `sources` dieser Art. Sortiert wird nach Kategorie-Position, dann offen vor erledigt, dann Name. Die Zeile bleibt dieselbe Komponente wie in der Gangansicht, bekommt Menge und Namen als Props und ruft dieselben Aktionen mit `item.id` auf.
- *Alternative:* gemischte Artikel nur einmal zeigen, unter einer Gruppe „Gemischt“ oder unter der Quelle des ersten Anteils. Verworfen: Dann sucht man „Butter“ unter „Selbst eingetragen“ vergeblich, und die Menge stimmt nicht mit der Quelle überein.

### Umschalter
Ein Segment-Umschalter „Nach Gängen | Nach Herkunft“ neben dem Geschäftsfilter. Die Wahl liegt in `localStorage` (Schlüssel `shopping.view`), genauso wie der Geschäftsfilter. Bei ungültigem Wert gilt „Nach Gängen“.

### Namen klein und ruhig
Die Namen stehen als gedämpfte Zeile unter dem Artikelnamen (z. B. „Felix, Linh“), mit großem Anfangsbuchstaben, nicht als farbige Chips. So bleibt die Kopfzeile bei 375 px unverändert, und die Liste wird nur wenig höher. Der Name wird mit dem ersten Buchstaben groß angezeigt, gespeichert bleibt er wie in der Sitzung.

## Risks / Trade-offs

- [Gemischte Artikel stehen doppelt, und man könnte meinen, man müsse zweimal kaufen.] → Jede Zeile zeigt nur die Teilmenge ihrer Gruppe, und beide Zeilen haken sich gemeinsam ab. Ein kleiner Hinweis „auch unter …“ ist bei Bedarf leicht nachrüstbar.
- [Bei einer Menge von Hand gehen Herkunft und Person der alten Anteile verloren (wie bisher).] → Gewollt und in der Spec festgehalten. Der Artikel wandert dann nach „Selbst eingetragen“.
- [Rollback auf eine Version ohne Migration 009.] → Die alte Version liest nur benannte Spalten und ignoriert die neuen. Bei der Umsetzung prüfen, dass der Migrationslauf einen unbekannten Eintrag `009` in `schema_migrations` toleriert.
- [Namen ändern sich in Auth0.] → Alte Anteile behalten den alten Namen. Bei zwei festen Konten ist das vernachlässigbar.

## Migration Plan

1. Migration `009` läuft beim Start automatisch (nur `ALTER TABLE … ADD COLUMN`, kein Umschreiben von Daten).
2. Deploy wie üblich über den Merge auf `main`. Bestehende Artikel zeigen keinen Namen, neue sofort.
3. Rollback über den bestehenden `workflow_dispatch`. Die Spalten bleiben ungenutzt in der Datei.
