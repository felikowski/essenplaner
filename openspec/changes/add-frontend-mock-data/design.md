## Context

Es gibt noch keinen Code. Der Prototyp `family-dinner-planner` zeigt eine einzige Woche ohne Datum, hat keine Tests und ruft ein fest eingetragenes Backend unter `localhost:8080` auf. Die Anforderungen stehen in `specs/meal-plan` und `specs/recipe-catalog`.

## Goals / Non-Goals

**Goals:**
- Die Datenzugriffsschicht so schneiden, dass `add-go-backend` nur ihre Implementierung tauscht, nicht die Komponenten
- Das Datenmodell ist schon auf PDF- und Web-Rezepte ausgelegt, damit spätere Changes nichts umbauen müssen
- Testbar von Anfang an

**Non-Goals:**
- Speicherung über ein Neuladen hinaus (kommt mit `add-go-backend`)
- Login (kommt mit `add-google-login`), Rezepte anlegen oder importieren
- Offline-Fähigkeit / PWA

## Decisions

**Vite + React + TypeScript, wie im Prototyp.** Das ist bekannt und schlank, ein Framework wie Next.js brauchen wir nicht, weil Go später die gebauten Dateien ausliefert.

**Routing mit `react-router`.** Es gibt drei Ansichten: Woche (`/woche/2026-W40`), Rezeptliste (`/rezepte`) und Rezeptdetail (`/rezepte/:id`). Die Woche in der URL macht Links teilbar und den Zurück-Button nutzbar. Die Alternative, den Zustand nur in React zu halten, verwerfen wir, weil Deep-Links dann nicht funktionieren.

**Datenmodell** (`src/types.ts`), bereits nah an der späteren API:
```ts
type RecipeSource =
  | { kind: 'pdf'; pdfUrl: string }
  | { kind: 'web'; url: string };
interface Recipe {
  id: string; title: string; source: RecipeSource;
  imageUrl?: string; servings?: string;
  ingredients?: string[]; instructions?: string[];
}
type IsoDate = string; // "2026-09-28"
interface WeekPlan { week: string /* "2026-W40" */; days: Record<IsoDate, string | null> }
```
Der Plan ist über Datumswerte adressiert statt über Wochentagsnamen. Dadurch sind Wochen eindeutig und das Backend kann dasselbe Schema nutzen.

**Datenzugriff über ein Interface `PlannerApi`** mit `listRecipes`, `getRecipe`, `getWeek` und `setDay`. Implementiert wird es von `MockPlannerApi`: Diese lädt `public/mock/recipes.json` und `public/mock/weeks.json` per `fetch` und hält Änderungen im Speicher. Komponenten erhalten die Implementierung über einen React-Context. `fetch` statt `import` von JSON sorgt dafür, dass Ladezustände und Fehler schon jetzt realistisch sind.

**Datumslogik als kleines eigenes Modul** (`src/lib/isoWeek.ts`) mit Funktionen wie „heutige Woche“, „vorige/nächste Woche“ und „Tage einer Woche“. Es wird ausführlich getestet, weil Jahreswechsel und KW 53 die typischen Fehlerquellen sind. Eine Bibliothek wie date-fns ginge auch, lohnt sich für diese wenigen Funktionen aber nicht.

**Styling mit einfachem CSS und Custom Properties**, mobil zuerst: eine Spalte am Handy, ein Raster ab Tablet. Hell und dunkel über `prefers-color-scheme`. Eine UI-Bibliothek kommt erst dazu, wenn sie gebraucht wird.

**Aus dem Prototyp übernommen:** der Aufbau von `RecipePicker` (Modal mit Liste, „Kein Gericht“, „Abbrechen“), ergänzt um ein Suchfeld; `WEEKDAY_LABELS`; der `request<T>`-Wrapper, wobei die Basis-URL relativ wird.

## Risks / Trade-offs

- [Die Dummy-Daten weichen von den späteren echten Daten ab] → Die JSON-Dateien folgen exakt den TypeScript-Typen, und `add-go-backend` übernimmt dasselbe Schema.
- [Zeitzonen: „heute“ wird im Browser berechnet] → Berechnet wird ausschließlich mit lokalem Kalenderdatum, nie mit UTC-Zeitstempeln. Tests laufen mit einer festen Uhr.
