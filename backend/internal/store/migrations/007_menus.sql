-- Benannte, wiederverwendbare Pläne ohne festes Kalenderdatum.
CREATE TABLE menus (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    name_key    TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    days        INTEGER NOT NULL CHECK (days BETWEEN 1 AND 28),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Spiegelt die fachlichen Spalten von plan_entries; day ersetzt date.
CREATE TABLE menu_entries (
    id          TEXT PRIMARY KEY,
    menu_id     TEXT NOT NULL REFERENCES menus (id) ON DELETE CASCADE,
    day         INTEGER NOT NULL CHECK (day BETWEEN 1 AND 28),
    meal        TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
    position    INTEGER NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('recipe', 'note', 'item', 'leftover')),
    recipe_id   TEXT REFERENCES recipes (id),
    servings    INTEGER CHECK (servings BETWEEN 1 AND 99),
    text        TEXT,
    leftover_of TEXT REFERENCES menu_entries (id) ON DELETE SET NULL,
    CHECK ((kind IN ('recipe', 'leftover')) = (recipe_id IS NOT NULL)),
    CHECK ((kind IN ('note', 'item')) = (text IS NOT NULL)),
    CHECK (kind = 'leftover' OR leftover_of IS NULL)
);

CREATE INDEX menu_entries_menu ON menu_entries (menu_id, day, meal, position);
CREATE INDEX menu_entries_recipe ON menu_entries (recipe_id);
CREATE INDEX menu_entries_leftover_of ON menu_entries (leftover_of);
