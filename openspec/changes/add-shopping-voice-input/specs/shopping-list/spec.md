## ADDED Requirements

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
