-- Einordnung eines Rezepts. Leere optionale Angaben bleiben NULL; to_try ist ein boolescher Wert.
ALTER TABLE recipes ADD COLUMN course TEXT CHECK (course IN (
    'Hauptgericht', 'Beilage', 'Suppe', 'Salat', 'Vorspeise', 'Dessert',
    'Frühstück', 'Snack', 'Gebäck', 'Getränk', 'Sauce & Dip'
));
ALTER TABLE recipes ADD COLUMN cuisine TEXT CHECK (length(cuisine) <= 50);
ALTER TABLE recipes ADD COLUMN rating INTEGER CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE recipes ADD COLUMN to_try INTEGER NOT NULL DEFAULT 0 CHECK (to_try IN (0, 1));
ALTER TABLE recipes ADD COLUMN notes TEXT CHECK (length(notes) <= 2000);
ALTER TABLE recipes ADD COLUMN total_minutes INTEGER CHECK (total_minutes BETWEEN 1 AND 1440);

CREATE TABLE recipe_tags (
    recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    tag       TEXT NOT NULL CHECK (length(tag) BETWEEN 1 AND 30),
    tag_key   TEXT NOT NULL,
    PRIMARY KEY (recipe_id, tag_key)
);

CREATE INDEX recipe_tags_key ON recipe_tags (tag_key);
