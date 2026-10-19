## 1. Erkennung

- [ ] 1.1 `lib/stepIngredients.ts` mit Normalisierung, Suchwörtern je Zutat und zweistufigem Abgleich laut design.md; Tabellentests in `lib/stepIngredients.test.ts` mit allen fünf Schritten von „Hähnchen-Curry“ aus dem Seed, Plural („Tomate“/„3 Tomaten“), Umlaut-Plural („Äpfel“/„Apfel“), „Salz und Pfeffer“, Vorrang des exakten Treffers („Milch“ vs. „Kokosmilch“) und negativen Fällen („kochen“ vs. „Kochschinken“, „Abschmecken und servieren.“, „das Gemüse“) sind grün
- [ ] 1.2 Mindestens fünf echte Schritte aus HelloFresh-Rezepten (Mock-Daten oder `backend/internal/seed/recipes.json`) als zusätzliche Tabellenfälle aufnehmen, einschließlich Mengen-Varianten in Klammern, die nach `resolveStepAmounts` keine Treffer erzeugen; Tests grün

## 2. Kochansicht

- [ ] 2.1 Überblick: Schritt per Tippen, Enter oder Leertaste auswählen und abwählen, höchstens ein ausgewählter Schritt, Hervorhebung in der Zutatenliste, Zutaten mit umgerechneter Menge unter dem Schritt, „Keine Zutaten erkannt“; Zeit-Buttons ändern die Auswahl nicht. Tests in `pages/CookingPage.test.tsx` für die Szenarien „Schritt antippen“, „Anderen Schritt wählen“, „Auswahl aufheben“, „Portionen umgestellt“, „Timer im ausgewählten Schritt“ und „Kein Treffer“ sind grün
- [ ] 2.2 Schritt-Modus: Zutaten des aktuellen Schritts unter der Karte, Wechsel beim Weiterblättern, Hervorhebung im Overlay „Zutaten“; Tests für „Zutaten des aktuellen Schritts“ und „Overlay“ sind grün
- [ ] 2.3 Zutaten unter dem Schritt abhaken, gemeinsam mit der Zutatenliste und dem Overlay; Test „Unter dem Schritt abhaken“ ist grün
- [ ] 2.4 Styles in `index.css`: Hervorhebung, kompakte Zutatenliste unter dem Schritt mit Tippflächen ab 56 px, kein Übergang bei `prefers-reduced-motion`, nichts davon im Druck; geprüft per Screenshot im Browser-Pane bei 375 px und am Desktop sowie in der Druckvorschau
- [ ] 2.5 README-Abschnitt zur Kochansicht um das Hervorheben der Zutaten und seine Grenzen (Sammelbegriffe werden nicht erkannt) ergänzen; der Abschnitt beschreibt das Verhalten aus 2.1 bis 2.3

## 3. Abschluss

- [ ] 3.1 Am Handy (375 px) „Hähnchen-Curry“ aus dem Plan mit 8 Portionen öffnen, im Überblick Schritt 2 antippen, im Schritt-Modus bis Schritt 4 blättern und dort eine Zutat abhaken; Screenshots unter `docs/add-step-ingredients-mobile.jpg`
- [ ] 3.2 `make test` ist grün

## Workflow follow-up

- Change nach Review archivieren und prüfen, dass die neuen Anforderungen in `openspec/specs/cooking-view/spec.md` stehen.
