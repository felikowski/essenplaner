# shopping-list Specification

## Purpose
Aus dem Wochenplan automatisch eine gemeinsame, zusammengefasste und nach Gängen im Laden sortierte Einkaufsliste erzeugen, die die Familie beim Einkaufen abhakt.

## Requirements

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
Das System SHALL die Einkaufsliste unter `/api/shopping/…` bereitstellen: Liste lesen, Artikel anlegen, ändern, abhaken, löschen und zusammenführen, aus dem Plan übernehmen, erledigte entfernen sowie Kategorien, Geschäfte, gemerkte Zusammenführungen und Vorrat verwalten. Die Liste MUST mit einem `ETag` ausgeliefert werden, und eine Anfrage mit passendem `If-None-Match` MUST mit 304 beantwortet werden. Alle Endpunkte MUST den einheitlichen Fehlerantworten folgen.

#### Scenario: Unverändert
- **WHEN** ein Client die Liste mit dem zuletzt erhaltenen `ETag` abfragt und sich nichts geändert hat
- **THEN** antwortet das System mit 304 ohne Inhalt

### Requirement: Einkauf ansagen
Das System SHALL auf der Seite „Einkauf“ einen Knopf „Einkauf ansagen“ anbieten, mit dem der Nutzer eine Sprachaufnahme von höchstens 60 Sekunden macht oder einen Freitext eingibt. Aus der Aufnahme bzw. dem Text MUST das System eine Liste einzelner Artikelzeilen in der Form des Eingabefelds erzeugen, mit Menge vorne, ohne Füllwörter und ohne Artikel, die nicht genannt wurden. Ist der Sprachdienst nicht konfiguriert, MUST der Knopf fehlen.

#### Scenario: Mehrere Artikel ansagen
- **WHEN** der Nutzer „zwei Gurken, Feta, noch Bier und Spülmittel“ ansagt
- **THEN** schlägt das System die Zeilen „2 Gurken“, „Feta“, „Bier“ und „Spülmittel“ vor

#### Scenario: Freitext
- **WHEN** der Nutzer statt einer Aufnahme „500g Hack\nTomaten (Dose)\nParmesan“ einfügt
- **THEN** schlägt das System drei Zeilen vor, darunter „500 g Hack“

#### Scenario: Aufnahme zu lang
- **WHEN** die Aufnahme 60 Sekunden erreicht
- **THEN** endet sie automatisch und wird ausgewertet

#### Scenario: Nicht konfiguriert
- **WHEN** auf dem Server kein Schlüssel für den Sprachdienst hinterlegt ist
- **THEN** zeigt die Seite „Einkauf“ keinen Knopf „Einkauf ansagen“, und alle anderen Funktionen arbeiten wie bisher

#### Scenario: Nichts erkannt
- **WHEN** die Aufnahme keinen erkennbaren Artikel enthält
- **THEN** zeigt das System „Ich habe nichts zum Einkaufen herausgehört.“ und bietet eine neue Aufnahme an

### Requirement: Vorschau vor dem Hinzufügen
Das System SHALL die vorgeschlagenen Zeilen vor dem Speichern in einer Vorschau zeigen. Jede Zeile MUST sich ändern und entfernen lassen, und weitere Zeilen MUST sich ergänzen lassen. Zu jeder Zeile MUST die Vorschau die Kategorie zeigen, in die der Artikel nach den Regeln der Kategorien käme, und einen Hinweis, wenn er mit einem vorhandenen, nicht abgehakten Artikel zusammengefasst würde. Ohne Bestätigung MUST nichts auf die Liste kommen.

#### Scenario: Kategorie und Zusammenfassen
- **WHEN** „Feta“ eine gemerkte Wahl „Käsetheke“ hat und „Bier“ bereits nicht abgehakt auf der Liste steht
- **THEN** zeigt die Vorschau bei „Feta“ die Kategorie „Käsetheke“ und bei „Bier“ den Hinweis „kommt zu Bier dazu“

#### Scenario: Abbrechen
- **WHEN** der Nutzer die Vorschau schließt, ohne „Hinzufügen“ zu wählen
- **THEN** bleibt die Einkaufsliste für alle Nutzer unverändert

#### Scenario: Zeile korrigieren
- **WHEN** der Nutzer in der Vorschau „Raum“ zu „Rum“ ändert und hinzufügt
- **THEN** steht „Rum“ auf der Liste und nicht „Raum“

### Requirement: Mehrere Artikel hinzufügen
Das System SHALL mehrere Artikelzeilen in einem Schritt hinzufügen. Jede Zeile MUST genauso behandelt werden wie eine Eingabe im Eingabefeld: als Zutatenzeile zerlegt, nach den Regeln der Kategorien einsortiert und mit gleichnamigen, nicht abgehakten Artikeln zusammengefasst. Ist eine Zeile ungültig, MUST keine der Zeilen hinzugefügt werden. Pro Schritt MUST das System höchstens 50 Zeilen annehmen.

#### Scenario: Gesammelt hinzufügen
- **WHEN** der Nutzer in der Vorschau vier Zeilen bestätigt
- **THEN** stehen alle vier Artikel auf der Liste, und andere Nutzer sehen sie spätestens nach 15 Sekunden

#### Scenario: Ungültige Zeile
- **WHEN** eine der Zeilen leer ist oder länger als für einen Artikel erlaubt
- **THEN** meldet das System den Fehler, und keine der Zeilen kommt auf die Liste

### Requirement: Datensparsamkeit beim Sprachdienst
Das System SHALL an den externen Sprachdienst nur die Aufnahme bzw. den eingegebenen Text sowie die Namen der Artikel auf der Liste und der Vorratsliste als Schreibhilfe übermitteln. Rezepte, Plan, Nutzerdaten und Anmeldeinformationen MUST NOT übermittelt werden. Aufnahmen und Transkripte MUST NOT gespeichert oder protokolliert werden. Der Sprachdienst MUST nur angemeldeten Nutzern zur Verfügung stehen.

#### Scenario: Ohne Anmeldung
- **WHEN** ein Client ohne gültige Sitzung eine Aufnahme an den Server schickt
- **THEN** antwortet das System mit 401, und es geht keine Anfrage an den Sprachdienst

#### Scenario: Protokoll
- **WHEN** eine Ansage ausgewertet wurde
- **THEN** enthält das Server-Protokoll höchstens Dauer, Status und Zahl der Zeilen, aber weder Audio noch Transkript

### Requirement: Grenzen der Spracheingabe
Das System SHALL Aufnahmen über 5 MB mit 413 abweisen und Freitexte über 2000 Zeichen mit 422. Pro Nutzer MUST es höchstens 30 Auswertungen je Stunde zulassen und darüber hinaus mit 429 antworten. Antwortet der Sprachdienst nicht innerhalb von 20 Sekunden oder mit einem Fehler, MUST das System mit 502 und einer verständlichen deutschen Meldung antworten. Alle Fehler MUST den einheitlichen Fehlerantworten folgen.

#### Scenario: Zu viele Ansagen
- **WHEN** ein Nutzer innerhalb einer Stunde die 31. Ansage auswerten lässt
- **THEN** antwortet das System mit 429 und „Zu viele Ansagen, bitte kurz warten.“

#### Scenario: Sprachdienst gestört
- **WHEN** der Sprachdienst nicht erreichbar ist
- **THEN** zeigt der Dialog „Die Spracherkennung ist gerade nicht erreichbar.“, und das Eingabefeld der Einkaufsliste funktioniert weiter

### Requirement: Wer etwas eingetragen hat
Das System SHALL zu jedem Anteil eines Artikels festhalten, welcher angemeldete Nutzer ihn auf die Liste gebracht hat, und dafür den Anzeigenamen aus der Sitzung zum Zeitpunkt des Eintragens speichern. Das MUST für das Eingabefeld, die Spracheingabe, „Aus dem Plan übernehmen“ (der Nutzer, der übernimmt), „Vorrat prüfen“ und das Ändern der Menge von Hand gelten. Ersetzt eine Menge von Hand die Anteile eines Artikels, MUST der neue Anteil dem Nutzer gehören, der die Menge geändert hat. Beim Zusammenführen und Umbenennen MUST jeder Anteil seinen Nutzer behalten. Am Artikel MUST die Liste die Namen aller Nutzer seiner Anteile ohne Doppelungen und kommagetrennt anzeigen, in der Reihenfolge, in der die Anteile hinzukamen. In der Herkunft eines Artikels MUST hinter jedem Anteil der Name stehen. Anteile ohne bekannten Nutzer, etwa aus der Zeit vor dieser Änderung, MUST ohne Namen erscheinen. Teilen und Drucken MUST keine Namen enthalten.

#### Scenario: Eigener Artikel
- **WHEN** Linh „Feta“ über das Eingabefeld hinzufügt
- **THEN** sehen alle Nutzer am Artikel „Feta“ den Hinweis „Linh“

#### Scenario: Aus dem Plan übernommen
- **WHEN** Felix „Aus dem Plan übernehmen“ wählt und dabei die Zutaten der Linsensuppe auf die Liste kommen
- **THEN** zeigt die Herkunft von „Karotten“ „Linsensuppe (Fr 02.10.): 2 Karotten · Felix“

#### Scenario: Mehrere Personen
- **WHEN** Felix „Milch“ per Spracheingabe hinzufügt und Linh danach „1 l Milch“ eingibt
- **THEN** zeigt der Artikel „Milch“ den Hinweis „Felix, Linh“

#### Scenario: Menge von Hand geändert
- **WHEN** Linh die Menge eines aus dem Plan übernommenen Artikels von Felix auf „500 g“ ändert
- **THEN** zeigt der Artikel nur noch „Linh“

#### Scenario: Alter Artikel
- **WHEN** ein Artikel vor dieser Änderung auf die Liste kam
- **THEN** zeigt er keinen Namen, und alle anderen Angaben bleiben unverändert

### Requirement: Ansicht nach Herkunft
Das System SHALL auf der Seite „Einkauf“ einen Umschalter zwischen „Nach Gängen“ und „Nach Herkunft“ anbieten. „Nach Gängen“ MUST die bisherige Ansicht sein und voreingestellt sein. Die Wahl MUST auf dem Gerät gemerkt werden. „Nach Herkunft“ MUST die Artikel in die Gruppen „Aus Rezepten“ (aus dem Plan übernommen), „Selbst eingetragen“ (Eingabefeld, Spracheingabe und Menge von Hand) und „Vorrat“ in dieser Reihenfolge einteilen. Leere Gruppen MUST ausgeblendet sein. Innerhalb einer Gruppe MUST die Liste nach der Reihenfolge der Kategorien sortieren, offene vor abgehakten Artikeln. Hat ein Artikel Anteile aus mehreren Gruppen, MUST er in jeder dieser Gruppen erscheinen, jeweils mit der Menge der Anteile dieser Gruppe und den Namen der Nutzer dieser Anteile. Abhaken, Bearbeiten und Löschen MUST immer für den ganzen Artikel gelten. Der Geschäftsfilter MUST in beiden Ansichten gleich wirken.

#### Scenario: Umschalten
- **WHEN** die Liste „Karotten“ aus der Linsensuppe und den selbst eingetragenen „Kaffee“ enthält und der Nutzer „Nach Herkunft“ wählt
- **THEN** steht „Karotten“ unter „Aus Rezepten“ und „Kaffee“ unter „Selbst eingetragen“

#### Scenario: Gemischter Artikel
- **WHEN** „Butter“ mit „250 g“ aus einem Rezept und „2 EL“ von Hand auf der Liste steht und die Ansicht „Nach Herkunft“ gewählt ist
- **THEN** steht „Butter“ unter „Aus Rezepten“ mit „250 g“ und unter „Selbst eingetragen“ mit „2 EL“

#### Scenario: Gemischten Artikel abhaken
- **WHEN** der Nutzer „Butter“ in der Gruppe „Selbst eingetragen“ abhakt
- **THEN** ist „Butter“ in beiden Gruppen und in der Ansicht „Nach Gängen“ abgehakt

#### Scenario: Wahl gemerkt
- **WHEN** der Nutzer „Nach Herkunft“ wählt und die Seite später auf demselben Gerät wieder öffnet
- **THEN** zeigt die Seite die Ansicht „Nach Herkunft“

### Requirement: Person in der Einkaufs-API
Die Einkaufs-API SHALL zu jedem Anteil eines Artikels den Anzeigenamen des Nutzers liefern, der ihn eingetragen hat, und das Feld weglassen, wenn kein Nutzer bekannt ist. Zu jedem Artikel MUST sie außerdem die nach den Regeln des Zusammenfassens berechnete Menge je Herkunft (Plan, eigene Eingabe, Vorrat) liefern. Die Kennung des Nutzers beim Anmeldedienst MUST NOT ausgeliefert werden.

#### Scenario: Anteil mit Person
- **WHEN** ein Client die Liste abruft und Linh „Feta“ eingetragen hat
- **THEN** enthält der Anteil von „Feta“ den Namen „Linh“, aber keine Kennung des Anmeldedienstes

#### Scenario: Menge je Herkunft
- **WHEN** „Butter“ aus „250 g“ von einem Rezept sowie „2 EL“ und „1 EL“ von Hand besteht
- **THEN** liefert die API für „Butter“ die Menge „250 g“ für den Plan und „3 EL“ für die eigene Eingabe
