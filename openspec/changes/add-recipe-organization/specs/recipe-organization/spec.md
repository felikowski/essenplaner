## Purpose

Einen wachsenden Rezeptkatalog so einordnen, dass die Familie schnell das passende Rezept findet: nach Gang, Küche, Tags, Bewertung, Zeit und vorhandenen Zutaten.

## ADDED Requirements

### Requirement: Rezepte einordnen
Das System SHALL für jedes Rezept unabhängig von seiner Quelle die folgenden Angaben speichern und bearbeiten lassen: Gang (einer aus Hauptgericht, Beilage, Suppe, Salat, Vorspeise, Dessert, Frühstück, Snack, Gebäck, Getränk, Sauce & Dip), Küche (Text bis 50 Zeichen), Tags (bis 20, je bis 30 Zeichen, ohne Groß- und Kleinschreibung eindeutig), Bewertung (1 bis 5 oder keine), „Ausprobieren“ (ja/nein), Notizen (bis 2000 Zeichen) und Zubereitungszeit (1 bis 1440 Minuten oder keine). Alle Angaben MUST optional sein. Ein erneuter URL-Import MUST gesetzte Angaben nicht überschreiben. Die Detailansicht MUST die gesetzten Angaben zeigen, die Bewertung als Sterne, die sich direkt antippen lassen.

#### Scenario: Einordnen
- **WHEN** ein Nutzer bei „Hähnchen-Curry“ Gang „Hauptgericht“, Küche „Indisch“, die Tags „schnell“ und „Kinder mögen’s“ und 4 Sterne speichert
- **THEN** zeigt die Detailansicht diese Angaben

#### Scenario: Direkt bewerten
- **WHEN** ein Nutzer in der Detailansicht auf den fünften Stern tippt
- **THEN** hat das Rezept 5 Sterne, ohne dass das Formular geöffnet wird

#### Scenario: Doppelter Tag
- **WHEN** ein Nutzer die Tags „Schnell“ und „schnell“ eingibt
- **THEN** speichert das System den Tag nur einmal

#### Scenario: Notiz
- **WHEN** ein Nutzer bei einem PDF-Rezept die Notiz „mit halber Chilimenge“ speichert
- **THEN** zeigt die Detailansicht die Notiz

### Requirement: Vorbelegung beim Import
Das System SHALL beim URL-Import Gang, Küche, Tags und Zeit aus den Rezeptdaten übernehmen, sofern das Rezept diese Angaben noch nicht hat. `recipeCategory` MUST nur übernommen werden, wenn es sich eindeutig einem Gang zuordnen lässt. `keywords` MUST höchstens zehn Tags ergeben, `totalTime` MUST aus der ISO-8601-Dauer in Minuten umgerechnet werden.

#### Scenario: Import mit Angaben
- **WHEN** eine importierte Seite `recipeCategory: "Hauptspeise"`, `recipeCuisine: "Italienisch"` und `totalTime: "PT45M"` liefert
- **THEN** hat das Rezept Gang „Hauptgericht“, Küche „Italienisch“ und 45 Minuten

#### Scenario: Unbekannte Kategorie
- **WHEN** eine Seite `recipeCategory: "Ostern"` liefert
- **THEN** bleibt der Gang leer

### Requirement: Filtern und Sortieren
Das System SHALL die Rezeptliste und den Auswahldialog des Wochenplans nach Gang, Tags (alle gewählten müssen vorhanden sein), Mindestbewertung, „Ausprobieren“, Quelle und maximaler Zubereitungszeit filtern. Rezepte ohne Zeitangabe MUST bei einem Zeitfilter ausgeblendet werden. Sortieren MUST nach Titel (Standard), Bewertung (beste zuerst), zuletzt geplant (am längsten nicht geplant zuerst, nie geplante ganz vorn) und zuletzt hinzugefügt möglich sein. Aktive Filter MUST sichtbar sein, sich einzeln entfernen lassen und in der URL stehen.

#### Scenario: Schnelle Hauptgerichte
- **WHEN** der Nutzer Gang „Hauptgericht“ und „bis 30 Minuten“ wählt
- **THEN** zeigt die Liste nur Hauptgerichte mit höchstens 30 Minuten Zubereitungszeit

#### Scenario: Lange nicht gekocht
- **WHEN** der Nutzer nach „zuletzt geplant“ sortiert
- **THEN** stehen nie geplante Rezepte vorn, danach die am längsten nicht geplanten

#### Scenario: Link teilen
- **WHEN** der Nutzer eine gefilterte Liste neu lädt oder den Link auf einem anderen Gerät öffnet
- **THEN** sind dieselben Filter aktiv

### Requirement: Ausprobieren-Liste
Das System SHALL Rezepte mit „Ausprobieren“ als eigene Ansicht der Rezeptliste erreichbar machen. Wird ein solches Rezept zum ersten Mal geplant und der Tag ist vergangen, MUST die Detailansicht fragen, ob die Markierung entfernt und eine Bewertung abgegeben werden soll.

#### Scenario: Nach dem Kochen
- **WHEN** ein Rezept mit „Ausprobieren“ gestern geplant war und der Nutzer es heute öffnet
- **THEN** fragt die Detailansicht „Wie war’s?“ mit Sternen und entfernt nach der Bewertung die Markierung

### Requirement: Suche nach Zutaten
Das System SHALL unter „Was habe ich da?“ die Eingabe mehrerer Zutaten erlauben und alle verfügbaren Rezepte liefern, deren Zutatennamen mindestens eine davon enthalten. Der Vergleich MUST Groß- und Kleinschreibung ignorieren, Teilwörter finden („Zucchini“ in „Zucchinischeiben“) und gemerkte Zusammenführungen der Einkaufsliste berücksichtigen. Die Ergebnisse MUST nach der Zahl der getroffenen Zutaten absteigend sortiert sein und pro Rezept zeigen, welche eingegebenen Zutaten es enthält.

#### Scenario: Zwei Zutaten
- **WHEN** der Nutzer „Zucchini“ und „Feta“ eingibt
- **THEN** stehen Rezepte mit beiden Zutaten vor Rezepten mit nur einer, und jedes Ergebnis zeigt „Zucchini ✓ Feta ✓“ bzw. nur die gefundene

#### Scenario: Kein Treffer
- **WHEN** kein Rezept eine der Zutaten enthält
- **THEN** zeigt das System „Kein Rezept mit diesen Zutaten“

### Requirement: Tags verwalten
Das System SHALL in den Einstellungen alle Tags mit der Zahl ihrer Rezepte auflisten und sie umbenennen, löschen und zusammenführen lassen. Umbenennen auf einen vorhandenen Tag MUST beide zusammenführen. Beim Bearbeiten eines Rezepts MUST die Tag-Eingabe vorhandene Tags vorschlagen.

#### Scenario: Zusammenführen
- **WHEN** der Nutzer den Tag „vegetarisch“ in „Vegetarisch“ umbenennt und dieser Tag schon existiert
- **THEN** gibt es nur noch „Vegetarisch“, mit den Rezepten beider Tags

### Requirement: Organisations-API
Das System SHALL die Angaben in jeder Rezept-Antwort mitliefern: `course`, `cuisine`, `tags` (Liste, alphabetisch), `rating`, `toTry`, `notes`, `totalMinutes`, dazu `createdAt` und `lastPlannedOn` (Datum des letzten Rezepteintrags ohne Reste, oder fehlend). Leere Angaben MUST fehlen, `tags` MUST als leere Liste fehlen dürfen und `toTry` nur bei `true` erscheinen. Unter `PATCH /api/recipes/{id}/organization` MUST es die übergebenen Angaben ändern und bei ungültigen Werten mit 422 und dem betroffenen Feld antworten. Unter `/api/tags` MUST es Tags auflisten, umbenennen und löschen.

#### Scenario: Teiländerung
- **WHEN** ein Client `PATCH /api/recipes/{id}/organization` mit `{"rating": 5}` sendet
- **THEN** ändert sich nur die Bewertung, und die Antwort enthält das vollständige Rezept

#### Scenario: Ungültiger Gang
- **WHEN** ein Client `{"course": "Brunch"}` sendet
- **THEN** antwortet das System mit 422 und `"field": "course"`
