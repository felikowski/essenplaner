## Why

Seit es den Login und die Spracheingabe gibt, schreiben mehrere Personen auf dieselbe Einkaufsliste. Im Laden ist dann oft unklar, wer „Feta“ eingetragen hat und was damit gemeint war, und ob ein Artikel aus dem Wochenplan stammt oder ein spontaner Wunsch ist. Die Liste kennt die Herkunft eines Anteils schon (Plan, eigene Eingabe, Vorrat), zeigt sie aber nur im Detaildialog und weiß nicht, wer ihn eingetragen hat.

## What Changes

- Jeder Anteil eines Artikels merkt sich, wer ihn auf die Liste gebracht hat: beim Eingabefeld, bei der Spracheingabe, bei „Aus dem Plan übernehmen“ (wer übernommen hat), bei „Vorrat prüfen“ und beim Ändern der Menge von Hand.
- Am Artikel steht klein, wer ihn eingetragen hat (bei mehreren Personen kommagetrennt). Im Herkunftsdialog steht die Person hinter jedem Anteil.
- Neuer Umschalter auf der Seite „Einkauf“: „Nach Gängen“ (wie bisher, Standard) oder „Nach Herkunft“ mit den Gruppen „Aus Rezepten“, „Selbst eingetragen“ (Eingabefeld und Spracheingabe) und „Vorrat“. Die Wahl wird pro Gerät gemerkt.
- Ein Artikel, dessen Anteile aus mehreren Quellen stammen, erscheint in der Herkunftsansicht in jeder betroffenen Gruppe mit der Menge dieser Quelle. Abhaken gilt für den ganzen Artikel.
- Die Einkaufs-API liefert zu jedem Anteil zusätzlich den Namen der Person (`addedBy`). Das Feld ist neu und optional, daher bleibt die API abwärtskompatibel.
- Anteile, die vor dieser Änderung entstanden sind, haben keine Person und zeigen keinen Namen.
- Teilen und Drucken bleiben nach Gängen gruppiert und ohne Namen.

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `shopping-list`: Herkunft eines Artikels um die Person ergänzen, neue Ansicht „Nach Herkunft“. Die Einkaufs-API liefert dazu die Person je Anteil.

## Impact

- Backend: neue Migration `009` (zwei Spalten in `shopping_item_parts`), `store/shopping.go` (Anteile schreiben und lesen, wer hinzufügt), `httpapi/shopping.go` (Person aus der Sitzung an den Store weitergeben), Menge je Herkunft in der Liste.
- Frontend: `types.ts`, `ShoppingPage.tsx`, `ShoppingItemDialog.tsx`, `lib/shopping.ts` (Gruppierung nach Herkunft), Mock-API (`mockShopping.ts`), CSS.
- Datenschutz: Gespeichert wird nur der Anzeigename aus der Sitzung, den die App ohnehin anzeigt. An den Sprachdienst geht davon nichts.
- Keine neuen Abhängigkeiten. Nach dem Deploy greift die Migration automatisch. Ein Rollback auf den Stand davor ist möglich, weil die alte Version die zusätzlichen Spalten ignoriert.
