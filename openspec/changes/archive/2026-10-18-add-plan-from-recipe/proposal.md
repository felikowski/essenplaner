## Why

Wer im Katalog stöbert (z. B. durch die frisch importierten HelloFresh-Rezepte), findet ein Gericht und muss heute erst zur Woche wechseln, den Tag suchen, „Hinzufügen“ tippen und das Rezept dort noch einmal aus der Liste heraussuchen. Ein direkter Weg „dieses Rezept an diesem Tag“ spart diese Umwege, gerade am Smartphone.

## What Changes

- Neuer Dialog „Einplanen“, der ein Rezept direkt einem Tag und einer Mahlzeit im Wochenplan zuordnet.
- Tagesauswahl: sieben Tages-Chips einer Kalenderwoche mit Blättern (‹ ›), Start in der aktuellen Woche mit heute vorausgewählt; zusätzlich ein freies Datumsfeld für jedes andere Datum.
- Mahlzeit: vorbelegt mit Abendessen, falls diese Mahlzeit in den Haushaltseinstellungen sichtbar ist, sonst mit der ersten sichtbaren Mahlzeit; änderbar.
- Portionen: vorbelegt mit den in der Detailansicht gewählten Portionen, sonst mit denen des Rezepts; änderbar. Rezepte ohne Portionsangabe werden ohne Portionenzahl eingeplant.
- Einstiegspunkte: Button „Einplanen“ in der Rezept-Detailansicht und ein Kalender-Symbol auf jeder Rezeptkarte der Rezeptliste.
- Nach dem Einplanen bleibt der Nutzer auf der Seite und sieht einen Hinweis wie „Für Mi 21.10. · Abendessen eingeplant“ mit Link zur betreffenden Woche.
- Nicht mehr verfügbare (entfernte) Rezepte bieten „Einplanen“ nicht an.
- Kein Backend-Change: Es wird das bestehende `POST /api/entries` (Art `recipe`, optional `servings`) verwendet.

## Capabilities

### New Capabilities

_keine_

### Modified Capabilities

- `meal-plan`: neue Anforderung „Rezept aus dem Katalog einplanen“ (Dialog von Rezeptliste und Detailansicht aus).

## Impact

- Frontend: neue Komponente für den Dialog, Erweiterung von `RecipeDetailPage` und `RecipeListPage`, Styles für das Kalender-Symbol auf der Rezeptkarte; Vitest-Tests.
- API: keine Änderung, nur Nutzung von `PlannerApi.createEntry` (HTTP und Mock).
- Backend, Datenbank, Deployment: unverändert.
