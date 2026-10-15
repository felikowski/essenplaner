## Context

Nach `add-recipe-editor` haben Zutaten `text`, `quantity`, `unit`, `name` und `note`. Der Frontend-Parser `lib/ingredient.ts` liefert bei Spannen zusätzlich `quantityMin`; das Backend speichert nur die obere Grenze. Nach `add-planner-flexibility` haben Rezepteinträge im Plan Portionen, Reste-Einträge dagegen nicht. Importierte HelloFresh-Rezepte haben 2 Portionen und Schritte wie „0,5 TL [0,75 TL | 1 TL] Salz*“. Motivation und Umfang: siehe proposal.md.

## Goals / Non-Goals

**Goals:**
- Umrechnen ohne neue API und ohne Änderung an gespeicherten Rezepten
- Gerundete Mengen, die man in der Küche abmessen kann
- Die Klammer-Schreibweise verschwindet aus der Anzeige, auch ohne Auswahl

**Non-Goals:**
- Ganze Zutatentexte umformulieren (Plural, „eine Prise“ → „zwei Prisen“)
- Mengen im Fließtext der Zubereitung ohne Klammer-Schreibweise umrechnen („100 ml Öl“ bleibt stehen)
- Kochansicht, Teilen und Drucken (`add-cooking-view`)

## Decisions

**Umrechnung im Frontend.** `lib/scale.ts` nimmt Menge, untere Grenze, Einheit und Faktor und liefert den Mengentext, etwa „1,2 kg“. Für Zutaten baut `scaleIngredient` bei Faktor ≠ 1 den Text aus den Teilen neu: `<Menge> <Einheit> <Name>, <Hinweis>`, ein führendes „ca.“ bleibt erhalten. Bei Faktor 1 bleibt der eingegebene Text stehen. Die untere Grenze von Spannen liest die Anzeige mit dem Frontend-Parser aus dem Text, solange dessen obere Grenze zur gespeicherten Menge passt. Eine eigene Formatierung neben dem Backend ist vertretbar: Die Einkaufsliste rundet später zum Einkaufen auf, hier wird zum Kochen auf handliche Werte gerundet.

**Rundung nach Einheit.**
- g, kg, ml, l werden in g bzw. ml gerechnet. Unter 100 auf ganze Zahlen (mindestens 1), ab 100 auf Fünfer, ab 1000 in kg bzw. l mit einer Nachkommastelle.
- TL, EL, Tasse und Prise auf Viertel (mindestens ¼), angezeigt als „¼“, „½“, „¾“, „1¼“.
- Alles andere, auch ohne Einheit, auf Halbe (mindestens ½).
- Bei Spannen entscheidet die obere Grenze über g oder kg; beide Grenzen werden gleich gerundet. Fallen sie zusammen, erscheint nur ein Wert.

**Portionen im URL-Parameter.** `/rezepte/:id?portionen=8`. Die Auswahl schreibt den Parameter mit `replace`; entspricht sie den Rezeptportionen, verschwindet er. Ungültige Werte (keine Zahl, außerhalb 1 bis 99) werden ignoriert. Kein globaler Zustand nötig, Neuladen und Teilen funktionieren, und die Kochansicht kann denselben Parameter übernehmen.

**Bedienung.** Eine Zeile „Portionen“ mit „−“, Zahl und „+“ (Tippflächen ab 44 px) über den Zutaten, daneben bei Abweichung „Rezept: 2“ zum Zurücksetzen. Die Überschrift lautet „Zutaten für N Portionen“. Ohne Rezeptportionen gibt es keine Auswahl, und Schritte zeigen die Grundvariante.

**Klammer-Varianten in Schritten.** `lib/stepAmounts.ts` zerlegt einen Schritt in Textstücke und Mengen-Elemente; gerendert wird ohne `dangerouslySetInnerHTML`.
- Erkannt wird eine Grundmenge (Zahl wie im Zutaten-Parser, optional ein Einheitenwort) direkt vor einer eckigen Klammer mit mindestens einem „|“: „200 ml [300 ml | 400 ml]“, „6 [9 | 12]“.
- Die Varianten gelten für Rezeptportionen + 1, + 2 usw. Das entspricht HelloFresh (2 Portionen, Varianten für 3 und 4).
- Gibt es zur gewählten Portionenzahl eine Variante, steht nur sie da. Sonst wird die Grundmenge mit den Regeln aus `lib/scale.ts` umgerechnet und kursiv mit Tooltip „umgerechnet aus 200 ml für 2 Portionen“ gezeigt. Ohne Auswahl steht nur die Grundmenge.
- Steht vor der Klammer keine erkennbare Menge, bleibt der Text unverändert. Texte ohne Klammer („4 – 5 Min.“) werden nicht angefasst.

**Links aus dem Plan.** Rezepteinträge verlinken mit `?portionen=<Eintragsportionen>`, wenn diese vom Rezept abweichen. Reste-Einträge haben keine eigenen Portionen; sie übernehmen die des Originaleintrags, sofern er in der angezeigten Woche liegt, sonst verlinken sie ohne Parameter.

## Risks / Trade-offs

- [Rezepte mit anderer Klammer-Logik, etwa 4 Portionen mit Varianten für 6 und 8] → Dann passt die Zuordnung „+1, +2“ nicht. Bisher stammt die Schreibweise nur von HelloFresh mit 2 Portionen. Falls nötig, lässt sich die Zuordnung später aus den Mengenverhältnissen ableiten.
- [Gerundete Mengen weichen vom Original ab] → Bei Faktor 1 bleibt der Originaltext. Die Überschrift nennt die gewählten Portionen, und umgerechnete Mengen in Schritten sind gekennzeichnet.
- [Neu gebauter Zutatentext klingt holpriger („1½ Stück Zwiebel“)] → Bewusst in Kauf genommen; Umformulieren ist ein Non-Goal.

## Migration Plan

Nur Frontend-Änderungen. Rollback: vorherigen Stand deployen.
