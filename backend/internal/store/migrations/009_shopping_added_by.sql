-- Wer einen Anteil auf die Einkaufsliste gebracht hat. Der Name ist eine Momentaufnahme aus der Sitzung;
-- ältere Anteile bleiben ohne Person.
ALTER TABLE shopping_item_parts ADD COLUMN added_by_subject TEXT;
ALTER TABLE shopping_item_parts ADD COLUMN added_by_name TEXT;
