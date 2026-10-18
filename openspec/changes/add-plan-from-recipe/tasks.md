## 1. Dialog

- [x] 1.1 `lib/`: Helfer `plannedNotice(date, meal)` („Für Mi 21.10. · Abendessen eingeplant“) und `defaultMeal(visibleMeals)` (Abendessen, sonst erste sichtbare in `MEALS`-Reihenfolge); Unit-Tests für beide
- [x] 1.2 `components/PlanRecipeDialog.tsx`: Wochen-Blättern mit KW-Anzeige, sieben Tages-Chips (heute vorausgewählt), Datumsfeld (springt zur Woche des Datums), Mahlzeit nur aus sichtbaren Mahlzeiten (Feld entfällt bei genau einer), `ServingsPicker` nur bei Rezepten mit Portionen, Speichern über `api.createEntry` mit deaktiviertem Button während des Speicherns, Fehler bleibt im Dialog; Komponententests für Vorbelegung, Blättern, Datumsfeld, ausgeblendetes Abendessen, Portionen, ohne Portionen, Abbrechen und Fehlerfall

## 2. Einstiegspunkte

- [x] 2.1 Detailansicht: Button „Einplanen“ nach „Kochen“ nur für verfügbare Rezepte, Vorbelegung mit `?portionen=`, Hinweis mit Link zur Woche nach Erfolg; Tests in `RecipeDetailPage.test.tsx` (Einplanen mit 8 Portionen landet im Mock-Plan, kein Button bei entferntem Rezept)
- [x] 2.2 Rezeptliste: Kalender-Symbol als eigener Button neben dem Karten-Link (`aria-label` „<Titel> einplanen“), Dialog und Hinweis oberhalb der Liste, Suche/Filter bleiben in der URL erhalten; Styles für `.recipe-card__plan`; Tests in `RecipeListPage.test.tsx`

## 3. Abschluss

- [x] 3.1 Am Handy (375 px) im Browser-Pane aus Liste und Detailansicht einplanen, Wochen blättern, Ergebnis in der Wochenansicht prüfen; Screenshot
- [x] 3.2 `make test` grün
