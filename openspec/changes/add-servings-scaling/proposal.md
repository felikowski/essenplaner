## Why

Beim Import von HelloFresh-Rezepten zeigt sich zweierlei: Wer für mehr oder weniger Personen kocht als das Rezept vorsieht, muss jede Menge im Kopf umrechnen. Und die Zubereitung enthält Schreibweisen wie „200 ml [300 ml | 400 ml] Milch“, die Mengen für mehr Portionen in eckigen Klammern nennen. Ohne Erklärung verwirrt das eher, als dass es hilft. Das Umrechnen war für `add-cooking-view` geplant, wird aber schon jetzt gebraucht und ist klein genug für eine eigene Change. Es wird deshalb vorgezogen.

## What Changes

- Portionenauswahl (1 bis 99) in der Rezeptdetailansicht, sofern das Rezept Portionen hat. Zutaten mit Menge werden umgerechnet und lesbar gerundet („½ TL“, „1,2 kg“). Die Überschrift lautet dann „Zutaten für N Portionen“.
- Die Auswahl steht im URL-Parameter `?portionen=N`, sodass Neuladen und Teilen funktionieren.
- Mengen in eckigen Klammern in der Zubereitung („6 [9 | 12] Knödel“) werden als Varianten für Rezeptportionen, +1 und +2 gelesen. Angezeigt wird nur die passende Variante; gibt es keine, wird die Grundmenge umgerechnet und als umgerechnet gekennzeichnet. Der gespeicherte Text bleibt unverändert.
- Der Wochenplan öffnet Rezepte und Reste mit den Portionen des Eintrags, wenn sie vom Rezept abweichen.

Nicht Teil dieser Change: Kochansicht, Timer, Teilen und Drucken (bleiben in `add-cooking-view`), Umrechnung zwischen Einheitensystemen, Mengen im Fließtext ohne Klammer-Schreibweise.

## Capabilities

### New Capabilities
- `servings-scaling`: Portionen wählen, Zutatenmengen umrechnen, Mengen-Varianten in der Zubereitung auflösen

### Modified Capabilities
- `recipe-catalog`: Die Detailansicht zeigt bei gewählten Portionen umgerechnete statt eingegebener Zutatentexte.
- `meal-plan`: „Geplantes Rezept öffnen“ übergibt die Portionen des Eintrags.

## Impact

- Frontend: `lib/scale.ts` (Umrechnung und Rundung), `lib/stepAmounts.ts` (Klammer-Varianten in Schritten), Portionenauswahl in `RecipeDetailPage`, Link-Ziel in `DayCard`
- Backend: keine Änderung
- `add-cooking-view` nutzt danach Auswahl, URL-Parameter und `lib/scale.ts` mit, statt sie selbst einzuführen
