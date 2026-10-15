## 1. Logik

- [x] 1.1 `lib/scale.ts`: Mengen nach Einheit runden und formatieren (g/ml, kg/l, Löffelmaße als Brüche, Rest auf Halbe), Spannen, Zutatentext neu bauen; Tabellentests für alle Szenarien aus „Zutatenmengen umrechnen“ und jede Rundungsregel
- [x] 1.2 `lib/stepAmounts.ts`: Schritte in Text und Mengen-Elemente zerlegen, Variante wählen oder Grundmenge umrechnen; Tabellentests mit den echten HelloFresh-Schritten, Texten ohne Klammer und Klammern ohne Grundmenge

## 2. Oberfläche

- [x] 2.1 Portionenauswahl in der Detailansicht mit URL-Parameter (`replace`, ungültige Werte ignorieren), Überschrift „Zutaten für N Portionen“, Zurücksetzen; umgerechnete Zutaten und Schritte; Komponententests
- [x] 2.2 Links aus dem Wochenplan mit `?portionen=` für abweichende Rezepteinträge und Reste (Originaleintrag in derselben Woche); Komponententests
- [x] 2.3 Am Handy (375 px) im Browser-Pane das importierte HelloFresh-Rezept „Kaspressknödel“ mit 2, 3 und 6 Portionen prüfen; Screenshot

## 3. Abschluss

- [x] 3.1 `make test` grün; `add-cooking-view` verweist auf diese Change statt Portionen selbst einzuführen
