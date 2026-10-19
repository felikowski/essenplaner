## Context

Die Kochansicht (`pages/CookingPage.tsx`) zeigt im Überblick Zutatenliste und Schritte nebeneinander (ab Tablet-Breite) bzw. untereinander (Handy). Im Schritt-Modus liegt die Zutatenliste in einem Overlay. Zutaten sind als `Ingredient` mit geparstem `name` gespeichert (`lib/ingredient.ts`, „2 Knoblauchzehen“ → `name: "Knoblauchzehen"`), Schritte als Freitext (`instructions: string[]`). Eine Zuordnung zwischen beiden gibt es im Datenmodell nicht. Schritte werden bereits im Frontend zerlegt: `lib/stepAmounts.ts` löst Mengen-Varianten auf, `lib/stepTimes.ts` erkennt Zeitangaben. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Am Handy sieht man beim Lesen eines Schritts sofort, welche Zutaten in welcher Menge gebraucht werden, ohne zu scrollen.
- Die Erkennung liegt bei den Rezepten im Bestand (Seed, HelloFresh-Importe, eigene Rezepte) meistens richtig. Ein fehlender Treffer ist besser als ein falscher.
- Alles läuft im Frontend, ohne neue Endpunkte, Felder oder Migrationen.

**Non-Goals:**
- Gepflegte Zuordnung im Rezept-Editor. Sie wäre exakt, kostet aber Pflegeaufwand bei jedem Rezept und eine Migration. Kann ein späterer Ausbau sein, falls die Heuristik im Alltag zu oft danebenliegt.
- Erkennung per KI. Wäre bei Sammelbegriffen besser, braucht aber einen API-Schlüssel und Netz in der Küche.
- Hervorheben der Zutatenwörter im Schritttext. Das müsste mit der Zerlegung durch `stepAmounts` und `stepTimes` zusammenspielen und bringt wenig, weil die Zutaten mit Menge direkt unter dem Schritt stehen.

## Decisions

**Reine Funktion `lib/stepIngredients.ts`.** `findStepIngredients(step: string, ingredients: Ingredient[]): number[]` liefert die Indizes der zugeordneten Zutaten in der Reihenfolge der Zutatenliste. Die Kochansicht berechnet die Zuordnung für alle Schritte einmal pro Rezept mit `useMemo`. Gearbeitet wird auf dem Schritttext nach `resolveStepAmounts`, damit Mengen-Varianten in Klammern keine Treffer erzeugen.

**Normalisierung.** Kleinbuchstaben, Umlaute gefaltet (ä→a, ö→o, ü→u, ß→ss), Zerlegung in Wörter an allem, was kein Buchstabe ist; Bindestriche trennen ebenfalls („Hähnchen-Curry“). Plural und Fugen werden mit einer kleinen Endungsliste abgeschnitten (`-en`, `-n`, `-e`, `-s`, `-er`), solange mindestens drei Buchstaben übrig bleiben. „Tomaten“ und „Tomate“ werden so beide zu „tomat“, „Zwiebeln“ zu „zwiebel“, „Äpfel“ und „Apfel“ zu „apfel“.

**Suchwörter einer Zutat.** Aus `name` (ohne Hinweis nach dem Komma). Zerlegt wird an Leerzeichen, Bindestrichen, „/“, „und“ und „oder“, sodass „Salz und Pfeffer“ zwei Suchwörter liefert. Eine feste Liste beschreibender Wörter fällt weg (rot, grün, gelb, frisch, getrocknet, gemahlen, fein, grob, klein, groß, gehackt, TK, Bio, …). Wörter mit weniger als zwei Buchstaben fallen weg.

**Treffer, in zwei Stufen:**
1. Gleiches normalisiertes Wort in Schritt und Suchwörtern („Zwiebel“, „Öl“, „Ei“).
2. Nur für Schrittwörter ohne Treffer in Stufe 1: Das Schrittwort ist Anfang oder Ende eines Suchworts oder umgekehrt, und das kürzere Wort hat mindestens vier Buchstaben. Verglichen werden die normalisierten Wörter jeweils mit und ohne abgeschnittene Endung, damit kurze Stämme wie „rei“ aus „Reis“ nicht zu Fehltreffern führen („Hähnchen“ → „Hähnchenbrust“, „Reis“ → „Basmatireis“, „Brühe“ → „Gemüsebrühe“). Eine Sperrliste häufiger Küchenwörter verhindert Fehltreffer über zusammengesetzte Namen (kochen, backen, braten, schneiden, Würfel, Streifen, Scheiben, Topf, Pfanne, Ofen, Hälfte, Rest, …). Ohne sie würde zum Beispiel „kochen“ auf „Kochschinken“ passen.

Stufe 1 hat Vorrang, damit „Milch“ im Schritt bei den Zutaten „Milch“ und „Kokosmilch“ nur „Milch“ trifft. Die Listen (beschreibende Wörter, Sperrliste) sind kurz und werden über Tabellentests mit echten Schritten aus Seed- und HelloFresh-Rezepten festgezurrt, einschließlich negativer Fälle. Das Backend bleibt unberührt, weil die Zuordnung nichts speichert.

**Zustand.** `selectedStep: number | null` als lokaler State in `CookingView`, wie die bestehenden Abhak-Sets. Im Schritt-Modus gilt `stepIndex` als ausgewählter Schritt; `selectedStep` wird dort nicht benutzt. Beim Moduswechsel bleibt `selectedStep` erhalten. Die Abhak-Markierung der Zutaten bleibt das vorhandene `checkedIngredients`, sodass Liste, Overlay und Zutaten unter dem Schritt automatisch übereinstimmen.

**Bedienung im Überblick.**
- Ein Klick auf den Schritttext schaltet die Auswahl um. Klicks auf die Zeit-Buttons aus `stepTimes` im selben Text werden dabei ignoriert (`closest('button')`), sodass ein Timer-Start die Auswahl nicht ändert.
- Für Tastatur und Screenreader steht unter jedem Schritt ein dezenter Knopf „Zutaten“ (`aria-expanded`, `aria-controls`, Name „Zutaten für Schritt n“), der dasselbe tut. Ein Schritttext mit `role="button"` hätte die Zeit-Buttons verschachtelt, was ungültig ist. Der sichtbare Knopf macht die Funktion außerdem auffindbar.
- Unter dem ausgewählten Schritt erscheint eine Liste von Abhak-Knöpfen (`role="checkbox"`, Name = Zutat mit Menge), mit `scaleIngredient` umgerechnet. Statt einer `aria-live`-Ansage reicht das Disclosure-Muster des Knopfs.
- In der Zutatenliste bekommen die Treffer die Klasse `is-highlighted`: Hintergrund `--color-accent-soft` und ein Balken links in der Akzentfarbe. Abgehakte Zutaten bleiben durchgestrichen, auch wenn sie hervorgehoben sind.
- Kein automatisches Scrollen zur Zutatenliste. Am Handy wäre das ein Springen weg vom gerade gelesenen Schritt; die Liste unter dem Schritt deckt diesen Fall ab.

**Bedienung im Schritt-Modus.** Unter `step-mode__card` steht dieselbe kompakte Liste für `stepIndex`. Das Overlay „Zutaten“ bekommt die Treffer als Prop und hebt sie hervor. Die Tippflächen halten die 56 px aus `add-cooking-view` ein. Die Wischgeste reagiert weiterhin nur auf horizontale Bewegungen ab 60 px, sodass Tippen auf eine Zutat nicht als Wischen zählt.

**Bewegung und Druck.** Das Hervorheben erscheint mit einem kurzen Übergang der Hintergrundfarbe; bei `prefers-reduced-motion: reduce` ohne Übergang. Im Druck-Stylesheet gibt es weder Hervorhebung noch die Liste unter dem Schritt.

## Risks / Trade-offs

- [Fehltreffer über zusammengesetzte Wörter] → Stufe 2 nur für Wörter ohne exakten Treffer, Mindestlänge 4, Sperrliste und negative Tabellentests. Neue Fehltreffer aus dem Alltag werden als Testfall plus Listeneintrag behoben.
- [Fehlende Treffer bei Sammelbegriffen und Pronomen („das Gemüse“, „sie“)] → Bewusst kein Treffer. „Keine Zutaten erkannt“ bzw. eine unvollständige Liste ist ehrlicher als geratene Zutaten.
- [Gleichnamige Teile in mehreren Zeilen, etwa „Butter“ für Teig und Streusel] → Beide Zeilen werden hervorgehoben. Das ist korrekt, solange der Schritt nicht sagt, welche gemeint ist.
- [Bedienkonflikt zwischen Tippen zum Auswählen und Wischen im Überblick] → Im Überblick gibt es keine Wischgeste; im Schritt-Modus wird nichts ausgewählt, die Anzeige folgt dem aktuellen Schritt.

## Migration Plan

Nur Frontend-Änderungen, keine Daten- oder API-Änderung. Rollback: vorheriges Image deployen.
