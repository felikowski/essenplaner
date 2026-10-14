-- Ein Tag hat jetzt Mahlzeiten mit beliebig vielen Einträgen: Rezepte, Notizen, Einzelzutaten und Reste.
CREATE TABLE plan_entries (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    meal        TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
    position    INTEGER NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('recipe', 'note', 'item', 'leftover')),
    recipe_id   TEXT REFERENCES recipes (id),
    servings    INTEGER CHECK (servings BETWEEN 1 AND 99),
    text        TEXT,
    -- Reste verweisen auf den Rezepteintrag, von dem sie stammen.
    leftover_of TEXT REFERENCES plan_entries (id) ON DELETE SET NULL,
    CHECK ((kind IN ('recipe', 'leftover')) = (recipe_id IS NOT NULL)),
    CHECK ((kind IN ('note', 'item')) = (text IS NOT NULL)),
    CHECK (kind = 'leftover' OR leftover_of IS NULL)
);

CREATE INDEX plan_entries_date ON plan_entries (date, meal, position);
CREATE INDEX plan_entries_recipe ON plan_entries (recipe_id);
CREATE INDEX plan_entries_leftover_of ON plan_entries (leftover_of);

-- Bisherige Zuordnungen werden zum Abendessen, mit den Portionen des Rezepts.
INSERT INTO plan_entries (id, date, meal, position, kind, recipe_id, servings)
SELECT 'e-' || lower(hex(randomblob(6))), d.date, 'dinner', 1, 'recipe', d.recipe_id, r.servings
FROM plan_days d
JOIN recipes r ON r.id = d.recipe_id;

DROP TABLE plan_days;

-- Einstellungen, die für den ganzen Haushalt gelten (Schlüssel → JSON-Wert).
CREATE TABLE household_settings (
    key        TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);
