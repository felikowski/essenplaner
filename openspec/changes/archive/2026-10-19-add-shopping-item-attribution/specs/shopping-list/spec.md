## ADDED Requirements

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
