## Why

Manche Familien achten auf Kalorien, Eiweiß oder Salz, etwa beim Abnehmen, beim Sport oder aus gesundheitlichen Gründen. Plan to Eat berechnet Nährwerte pro Rezept und zeigt Tagessummen im Planer. Für deutsche Zutaten gibt es seit Dezember 2025 eine kostenfreie, umfassende Quelle: den Bundeslebensmittelschlüssel (BLS) 4.0 des Max Rubner-Instituts. Diese Change ist optional und steht deshalb am Ende der Reihenfolge.

## What Changes

- Nährwerte pro Portion für jedes Rezept mit Zutaten: Energie (kcal), Eiweiß, Fett, davon gesättigte Fettsäuren, Kohlenhydrate, davon Zucker, Ballaststoffe und Salz
- Grundlage ist eine eingebettete Auswahl des BLS 4.0.
- Zutaten werden automatisch einem Lebensmittel zugeordnet. Die Zuordnung lässt sich korrigieren und gilt dann für alle Rezepte mit diesem Zutatennamen.
- Mengen werden in Gramm umgerechnet: Gewicht direkt, Volumen über die Dichte, Löffel und Stück über typische Gewichte, die sich pro Zutat anpassen lassen.
- Die Abdeckung wird ehrlich angezeigt („berechnet aus 7 von 9 Zutaten“), dazu die fehlenden Zutaten.
- Optional zeigt der Wochenplan Tagessummen pro Person (Einstellung, standardmäßig aus).
- Hinweis, dass es sich um Schätzwerte handelt

Nicht Teil dieser Change: Ziele und Tracking pro Person, Mikronährstoffe, Allergene, Nährwerte für Gerichte aus Drive-PDFs ohne nachgetragene Zutaten.

## Capabilities

### New Capabilities
- `nutrition`: Lebensmitteldaten, Zuordnung von Zutaten, Umrechnung in Gramm, Nährwerte pro Portion, Tagessummen im Plan

### Modified Capabilities
<!-- keine -->

## Impact

- Backend: eingebettete, komprimierte Lebensmitteltabelle (Generator-Skript unter `tools/bls/`), Tabellen `nutrition_mappings` und `nutrition_piece_weights`, Endpunkte für Nährwerte eines Rezepts, einer Woche, für die Lebensmittelsuche und für Zuordnungen, Einstellung `showNutrition`
- Frontend: Nährwertbereich in der Rezeptdetailansicht, Dialog für Zuordnungen, Tagessummen im Plan, Einstellung
- Binärgröße wächst um ungefähr 0,5 bis 1 MB.
- Lizenz: Die Nutzungsbedingungen des BLS 4.0 müssen vor der Umsetzung geprüft werden (Task 1.1), insbesondere ob die Daten im Repository und im Binary weitergegeben werden dürfen und welche Quellenangabe nötig ist.
- Setzt `add-recipe-editor`, `add-planner-flexibility`, `add-shopping-list` (Zusammenführungen als Namens-Aliasse) und `add-freezer` (Gefrierfach-Einträge in Tagessummen) voraus
