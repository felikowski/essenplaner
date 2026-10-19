## 1. Erkennung

- [x] 1.1 `lib/stepIngredients.ts` mit Normalisierung, Suchwörtern je Zutat und zweistufigem Abgleich laut design.md; Tabellentests in `lib/stepIngredients.test.ts` mit allen fünf Schritten von „Hähnchen-Curry“ aus dem Seed, Plural („Tomate“/„3 Tomaten“), Umlaut-Plural („Äpfel“/„Apfel“), „Salz und Pfeffer“, Vorrang des exakten Treffers („Milch“ vs. „Kokosmilch“) und negativen Fällen („kochen“ vs. „Kochschinken“, „Abschmecken und servieren.“, „das Gemüse“) sind grün
- [x] 1.2 Mindestens fünf echte Schritte aus HelloFresh-Rezepten (Mock-Daten oder `backend/internal/seed/recipes.json`) als zusätzliche Tabellenfälle aufnehmen, einschließlich Mengen-Varianten in Klammern, die nach `resolveStepAmounts` keine Treffer erzeugen; Tests grün. Mock- und Seed-Daten enthalten keine HelloFresh-Rezepte; die Fälle stammen aus den echten HelloFresh-Schritten in `lib/stepAmounts.test.ts`.

## 2. Kochansicht

- [x] 2.1 Überblick: Schritt per Tippen, Enter oder Leertaste auswählen und abwählen, höchstens ein ausgewählter Schritt, Hervorhebung in der Zutatenliste, Zutaten mit umgerechneter Menge unter dem Schritt, „Keine Zutaten erkannt“; Zeit-Buttons ändern die Auswahl nicht. Tests in `pages/CookingPage.test.tsx` für die Szenarien „Schritt antippen“, „Anderen Schritt wählen“, „Auswahl aufheben“, „Portionen umgestellt“, „Timer im ausgewählten Schritt“ und „Kein Treffer“ sind grün
- [x] 2.2 Schritt-Modus: Zutaten des aktuellen Schritts unter der Karte, Wechsel beim Weiterblättern, Hervorhebung im Overlay „Zutaten“; Tests für „Zutaten des aktuellen Schritts“ und „Overlay“ sind grün
- [x] 2.3 Zutaten unter dem Schritt abhaken, gemeinsam mit der Zutatenliste und dem Overlay; Test „Unter dem Schritt abhaken“ ist grün
- [x] 2.4 Styles in `index.css`: Hervorhebung, kompakte Zutatenliste unter dem Schritt mit Tippflächen ab 56 px, kein Übergang bei `prefers-reduced-motion`, nichts davon im Druck; geprüft per Screenshot im Browser-Pane bei 375 px und am Desktop sowie in der Druckvorschau
- [x] 2.5 README-Abschnitt zur Kochansicht um das Hervorheben der Zutaten und seine Grenzen (Sammelbegriffe werden nicht erkannt) ergänzen; der Abschnitt beschreibt das Verhalten aus 2.1 bis 2.3

## 3. Abschluss

- [x] 3.1 Am Handy (375 px) „Hähnchen-Curry“ aus dem Plan mit 8 Portionen öffnen, im Überblick Schritt 2 antippen, im Schritt-Modus bis Schritt 4 blättern und dort eine Zutat abhaken; Screenshots unter `docs/add-step-ingredients-mobile.jpg`. Ohne Auth0-Zugang lokal mit Playwright gegen den Vite-Dev-Server und nachgebildete API-Antworten aufgenommen, die Kochansicht direkt mit `?portionen=8` geöffnet; die Übernahme der Portionen aus dem Plan deckt der bestehende Test „übernimmt abweichende Portionen aus einem Planeintrag“ ab.
- [x] 3.2 `make test` ist grün. Lokal waren Frontend-Tests (370), Lint, Build und alle Go-Pakete außer `safefetch` grün; `TestFetchRejectsRedirectToInternalAddress` scheiterte nur in der Cloud-Umgebung ohne IPv6. In der CI (GitHub Actions) ist der komplette Lauf grün.

## Workflow follow-up

- Change nach Review archivieren und prüfen, dass die neuen Anforderungen in `openspec/specs/cooking-view/spec.md` stehen.
