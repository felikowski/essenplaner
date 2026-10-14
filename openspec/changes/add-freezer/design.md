## Context

Nach `add-planner-flexibility` haben `plan_entries` die Arten `recipe`, `note`, `item` und `leftover` mit CHECK-Constraints. Die Einkaufsliste (`add-shopping-list`) übernimmt nur `recipe` und `item`. Der Verlauf zählt nur `recipe`. Menüs (`add-menus`) spiegeln die Eintragsspalten in `menu_entries`. Die Einstellungs-Registry nimmt neue Schlüssel auf. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Der Bestand stimmt, ohne dass jemand nach dem Essen etwas abhaken muss.
- Einkaufsliste und Verlauf brauchen keine Änderung, weil sie eine neue Eintragsart ohnehin ignorieren.

**Non-Goals:**
- Bestand pro Gefriergerät, Fach oder Behälter
- Zutaten-Vorräte (die Vorratsliste der Einkaufsliste deckt das ab)

## Decisions

**Bestand wird berechnet, nicht gezählt.**
- `freezer_items (id, name, recipe_id NULL, portions, taken, frozen_on, note, created_at)`, wobei `portions` die eingefrorene Menge ist und `taken` die von Hand entnommene.
- Reserviert sind die Portionen der Gefrierfach-Einträge mit `date >= heute`, verbraucht die mit `date < heute`.
- `verfügbar = portions − taken − Σ servings aller Gefrierfach-Einträge`

Damit gilt eine Portion automatisch als gegessen, wenn ihr Tag vorbei ist, und niemand muss nach dem Essen etwas bestätigen. Ein Zähler, der beim Einplanen sinkt, wäre einfacher zu lesen, aber Entfernen, Verschieben und Portionen ändern müssten ihn jeweils korrekt nachführen. Die Berechnung ist bei dieser Datenmenge eine billige Aggregation in einer Abfrage. „Heute“ ist das lokale Datum des Haushalts (Zeitzone `Europe/Berlin`, konfigurierbar wie die übrigen Datumsangaben).

**Vergangene Einträge löschen verbraucht trotzdem.** Wird ein Gefrierfach-Eintrag gelöscht, dessen Datum vorbei ist, erhöht dieselbe Transaktion `taken` um seine Portionen. Ein Aufräumen im Plan soll das Essen nicht „zurück in den Gefrierschrank“ legen. Verschieben in die Zukunft macht die Portionen wieder zu reservierten. Das ist gewollt, falls ein Tag verrutscht ist.

**Neue Eintragsart `freezer`.**
- In `plan_entries` kommen die Spalte `freezer_item_id` (REFERENCES `freezer_items` ON DELETE RESTRICT) und die Art `freezer` in den CHECK.
- `text` speichert den Namen zum Zeitpunkt des Einplanens, damit der Plan lesbar bleibt, falls das Gericht später umbenannt wird.
- `recipe_id` wird übernommen, sodass der Eintrag zum Rezept verlinkt.
- SQLite erfordert für den neuen CHECK einen Tabellenumbau wie in `add-recipe-editor`.
- `menu_entries` bekommt die Spalte nicht. Beim Speichern als Menü wird `freezer` zu `recipe` (mit Rezept und Portionen) oder zu `note` („❄ <Name>“) umgewandelt, wie in der Spec festgelegt. Damit hält der Spaltenvergleichstest aus `add-menus` eine dokumentierte Ausnahme.

**Prüfen beim Einplanen.** `POST /api/entries` mit `kind: freezer` und `PATCH` von `servings` prüfen innerhalb der Transaktion `verfügbar ≥ angefragt` (beim `PATCH` mit Gutschrift der bisherigen Portionen des Eintrags). Das verhindert, dass zwei Personen gleichzeitig dieselbe letzte Portion einplanen.

**„Einfrieren“ am Planeintrag.**
- Das Menü eines Rezepteintrags bekommt „Einfrieren“.
- Der Dialog ist vorbelegt (Rezept, Name, Datum des Eintrags, Hälfte der Portionen aufgerundet) und legt nur ein Gericht an. Der Planeintrag selbst ändert sich nicht.
- Eine Verknüpfung „wurde eingefroren von Eintrag X“ wird nicht gespeichert. Sie brächte keinen Nutzen, der die Komplexität rechtfertigt.

**Hinweis beim Planen.** Die Rezept-Antwort bekommt kein neues Feld. Das Frontend lädt das Gefrierfach beim Öffnen des Dialogs „Hinzufügen“ (kleine Liste) und vergleicht `recipeId`.

## Risks / Trade-offs

- [Tabellenumbau von `plan_entries` mit Fremdschlüsseln aus `shopping_imported_entries` und Reste-Verweisen] → Umbau mit `PRAGMA foreign_keys = OFF`, `foreign_key_check` vor dem Commit und einem Migrationstest mit einem Datenbestand, der alle Verweise enthält. Vorher wird die Datenbank gesichert, wie im Migration Plan beschrieben.
- [Verbrauch nach Datum stimmt nicht, wenn Pläne nicht eingehalten werden] → „Entnehmen“ und das Ändern der Portionenzahl eines Gerichts korrigieren von Hand. Das Alter bleibt trotzdem richtig.
- [Zeitzone des Servers weicht ab] → „Heute“ wird explizit in der Haushalts-Zeitzone berechnet, nicht mit `date('now')` in SQLite.

## Migration Plan

Datenbank sichern, deployen. Beim Start laufen Tabellenumbau und neue Tabelle. Rollback: Sicherung zurückspielen und das vorherige Image deployen, weil die alte Version die Eintragsart `freezer` nicht kennt.
