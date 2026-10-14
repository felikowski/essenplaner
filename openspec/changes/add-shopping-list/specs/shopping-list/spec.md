## Purpose

Aus dem Wochenplan automatisch eine gemeinsame, zusammengefasste und nach Gängen im Laden sortierte Einkaufsliste erzeugen, die die Familie beim Einkaufen abhakt.

## ADDED Requirements

### Requirement: Gemeinsame Einkaufsliste
Das System SHALL genau eine Einkaufsliste für den Haushalt führen, die alle Nutzer sehen und ändern. Die Seite „Einkauf“ MUST über die Hauptnavigation erreichbar sein. Solange die Seite sichtbar ist, MUST sie Änderungen anderer Nutzer spätestens nach 15 Sekunden anzeigen.

#### Scenario: Gemeinsam einkaufen
- **WHEN** ein Nutzer im Laden „Milch“ abhakt, während ein anderer die Liste zu Hause geöffnet hat
- **THEN** sieht der zweite Nutzer „Milch“ spätestens nach 15 Sekunden als erledigt

#### Scenario: Leere Liste
- **WHEN** die Liste keine Artikel enthält
- **THEN** zeigt die Seite einen Hinweis und bietet „Aus dem Plan übernehmen“ und „Vorrat prüfen“ an

### Requirement: Aus dem Plan übernehmen
Das System SHALL für einen gewählten Zeitraum die Zutaten aller Rezepteinträge und alle Einzelzutaten aus dem Plan auf die Liste übernehmen. Voreingestellt MUST der Zeitraum von heute bis einschließlich heute in sechs Tagen sein. Mengen eines Rezepteintrags MUST mit dem Faktor Eintragsportionen geteilt durch Rezeptportionen umgerechnet werden. Fehlt eine der beiden Angaben, MUST der Faktor 1 sein. Reste-Einträge und Notizen MUST übersprungen werden. Ein Eintrag, der bereits übernommen wurde, MUST nicht erneut übernommen werden. Rezepte ohne Zutaten MUST nach der Übernahme namentlich genannt werden.

#### Scenario: Woche übernehmen
- **WHEN** der Plan für die nächsten sieben Tage „Linsensuppe“ (8 Portionen, Rezept für 6) und die Einzelzutat „1 Baguette“ enthält und der Nutzer „Aus dem Plan übernehmen“ wählt
- **THEN** enthält die Liste die Zutaten der Linsensuppe mit dem Faktor 8/6, zum Beispiel „333 g Tellerlinsen“, und „1 Baguette“

#### Scenario: Zweimal übernehmen
- **WHEN** der Nutzer denselben Zeitraum ein zweites Mal übernimmt, nachdem ein weiteres Rezept geplant wurde
- **THEN** kommen nur die Zutaten des neuen Rezepts hinzu

#### Scenario: Rezept ohne Zutaten
- **WHEN** im Zeitraum ein PDF-Rezept ohne nachgetragene Zutaten geplant ist
- **THEN** meldet das System „Ohne Zutaten: Spaghetti Bolognese“ und bietet einen Link zum Nachtragen an

#### Scenario: Reste
- **WHEN** im Zeitraum ein Reste-Eintrag liegt
- **THEN** kommen für ihn keine Zutaten auf die Liste

### Requirement: Gleiche Zutaten zusammenfassen
Das System SHALL Zutaten mit demselben Namen zu einem Artikel zusammenfassen. Der Vergleich MUST Groß- und Kleinschreibung und überflüssige Leerzeichen ignorieren und gelernte Zusammenführungen berücksichtigen. Mengen derselben Einheit MUST addiert werden. g, kg und mg MUST ineinander umgerechnet werden, ebenso ml, cl, dl und l. Angezeigt wird die größere Einheit ab 1000 der kleineren. Mengen ohne Einheit MUST zusammengezählt werden. Mengen unterschiedlicher, nicht umrechenbarer Einheiten MUST nebeneinander am selben Artikel stehen. Zutaten ohne Menge MUST als Artikel ohne Menge erscheinen, solange keine Menge hinzukommt. Zu jedem Artikel MUST das System anzeigen, aus welchen Rezepten oder Einträgen er stammt.

#### Scenario: Gleiche Einheit
- **WHEN** ein Rezept „500 g Mehl“ und ein anderes „200 g Mehl“ enthält
- **THEN** zeigt die Liste einen Artikel „Mehl“ mit „700 g“

#### Scenario: Umrechnen
- **WHEN** „800 g Kartoffeln“ und „1 kg Kartoffeln“ übernommen werden
- **THEN** zeigt die Liste „Kartoffeln“ mit „1,8 kg“

#### Scenario: Verschiedene Einheiten
- **WHEN** „250 g Butter“ und „2 EL Butter“ übernommen werden
- **THEN** zeigt die Liste „Butter“ mit „250 g + 2 EL“

#### Scenario: Herkunft
- **WHEN** der Nutzer einen Artikel aufklappt
- **THEN** sieht er die Rezepte mit Datum und jeweiliger Menge, zum Beispiel „Linsensuppe (Fr 02.10.): 2 Karotten“

### Requirement: Artikel bearbeiten
Das System SHALL es ermöglichen, Artikel per Texteingabe hinzuzufügen, die wie eine Zutatenzeile zerlegt wird, sowie Menge und Namen eines Artikels zu ändern und Artikel zu löschen. Ein hinzugefügter Artikel mit demselben Namen wie ein vorhandener, nicht abgehakter Artikel MUST mit diesem zusammengefasst werden.

#### Scenario: Eigener Artikel
- **WHEN** der Nutzer „2 Packungen Kaffee“ eingibt
- **THEN** erscheint der Artikel „Kaffee“ mit „2 Pck.“ in der passenden Kategorie

#### Scenario: Löschen
- **WHEN** der Nutzer einen Artikel löscht
- **THEN** verschwindet er für alle Nutzer von der Liste

### Requirement: Kategorien
Das System SHALL jeden Artikel genau einer Kategorie zuordnen und die Liste nach Kategorien gruppiert in einer festgelegten Reihenfolge anzeigen. Es MUST eine voreingestellte Kategorienliste geben, die der Haushalt umbenennen, ergänzen, löschen und umsortieren kann. Ändert ein Nutzer die Kategorie eines Artikels, MUST sich das System die Wahl für diesen Namen merken und künftige Artikel mit diesem Namen dort einsortieren. Für Namen ohne gemerkte Wahl MUST das System eine eingebaute Liste von Vorschlägen nutzen und sonst „Sonstiges“ wählen. Wird eine Kategorie gelöscht, MUST ihre Artikel nach „Sonstiges“ wandern. „Sonstiges“ selbst MUST sich nicht löschen lassen.

#### Scenario: Vorschlag
- **WHEN** „Zucchini“ auf die Liste kommt und es keine gemerkte Wahl gibt
- **THEN** steht der Artikel unter „Obst & Gemüse“

#### Scenario: Gemerkte Wahl
- **WHEN** der Nutzer „Feta“ von „Kühlregal“ nach „Käsetheke“ verschiebt und später erneut Feta übernommen wird
- **THEN** steht der neue Artikel unter „Käsetheke“

#### Scenario: Reihenfolge
- **WHEN** der Nutzer „Getränke“ in den Einstellungen nach oben verschiebt
- **THEN** zeigt die Liste die Kategorie „Getränke“ zuerst

### Requirement: Geschäfte
Das System SHALL es ermöglichen, Geschäfte anzulegen, umzubenennen und zu löschen und einen Artikel einem Geschäft zuzuordnen. Die Liste MUST sich nach einem Geschäft filtern lassen. Artikel ohne Geschäft MUST dabei unter jedem Filter sichtbar bleiben. Die Zuordnung MUST für den Namen gemerkt werden wie bei Kategorien. Gibt es keine Geschäfte, MUST der Filter ausgeblendet sein.

#### Scenario: Filter
- **WHEN** „Äpfel“ dem Geschäft „Wochenmarkt“ zugeordnet ist und der Nutzer den Filter „Supermarkt“ wählt
- **THEN** ist „Äpfel“ ausgeblendet, Artikel ohne Geschäft bleiben sichtbar

### Requirement: Einkaufen
Das System SHALL Artikel abhaken und wieder zurücksetzen lassen. Abgehakte Artikel MUST innerhalb ihrer Kategorie ans Ende rutschen und durchgestrichen erscheinen. „Erledigte entfernen“ MUST alle abgehakten Artikel löschen. Solange die Seite angezeigt wird, MUST der Bildschirm eingeschaltet bleiben, sofern der Browser das unterstützt.

#### Scenario: Abhaken
- **WHEN** der Nutzer „Milch“ antippt
- **THEN** wird „Milch“ durchgestrichen am Ende der Kategorie angezeigt

#### Scenario: Aufräumen
- **WHEN** der Nutzer „Erledigte entfernen“ wählt
- **THEN** verschwinden alle abgehakten Artikel, die übrigen bleiben

### Requirement: Artikel zusammenführen
Das System SHALL es ermöglichen, einen Artikel in einen anderen zusammenzuführen. Mengen MUST dabei nach den Regeln des Zusammenfassens addiert werden. Das System MUST sich die Zusammenführung merken, sodass künftige Zutaten mit dem zusammengeführten Namen direkt beim Zielnamen landen. Gemerkte Zusammenführungen MUST sich in den Einstellungen einsehen und entfernen lassen.

#### Scenario: Ein- und Mehrzahl
- **WHEN** der Nutzer „Zwiebel“ (1) in „Zwiebeln“ (3) zusammenführt
- **THEN** zeigt die Liste nur „Zwiebeln“ mit „4“, und künftig übernommene „Zwiebel“ landen bei „Zwiebeln“

### Requirement: Vorratsliste
Das System SHALL eine Vorratsliste führen: Artikel, die der Haushalt immer im Haus haben will, mit optionaler Menge. „Vorrat prüfen“ MUST alle Vorratsartikel zum Ankreuzen anzeigen, und die angekreuzten MUST mit einem Tippen auf die Einkaufsliste kommen. Artikel MUST sich auf der Einkaufsliste per „Zum Vorrat“ in die Vorratsliste übernehmen lassen.

#### Scenario: Vorrat prüfen
- **WHEN** die Vorratsliste „Kaffee“, „Spülmittel“ und „Reis“ enthält und der Nutzer „Kaffee“ und „Reis“ ankreuzt und übernimmt
- **THEN** stehen „Kaffee“ und „Reis“ auf der Einkaufsliste

### Requirement: Teilen und Drucken
Das System SHALL die nicht abgehakten Artikel als Text nach Kategorien gruppiert über das Teilen-Menü des Geräts teilen. Ohne Teilen-Menü MUST der Text in die Zwischenablage kopiert werden, mit einer Bestätigung. Für die Liste MUST es eine Druckansicht ohne Bedienelemente geben.

#### Scenario: Teilen
- **WHEN** der Nutzer „Teilen“ wählt
- **THEN** öffnet sich das Teilen-Menü mit einem Text wie „Obst & Gemüse\n- Zwiebeln: 4\n…“

### Requirement: Einkaufs-API
Das System SHALL die Einkaufsliste unter `/api/shopping/…` bereitstellen: Liste lesen, Artikel anlegen, ändern, abhaken, löschen und zusammenführen, aus dem Plan übernehmen, erledigte entfernen sowie Kategorien, Geschäfte, gemerkte Zusammenführungen und Vorrat verwalten. Die Liste MUST mit einem `ETag` ausgeliefert werden, und eine Anfrage mit passendem `If-None-Match` MUST mit 304 beantwortet werden. Alle Endpunkte MUST den Regeln für geschützte API und einheitliche Fehlerantworten folgen.

#### Scenario: Unverändert
- **WHEN** ein Client die Liste mit dem zuletzt erhaltenen `ETag` abfragt und sich nichts geändert hat
- **THEN** antwortet das System mit 304 ohne Inhalt
