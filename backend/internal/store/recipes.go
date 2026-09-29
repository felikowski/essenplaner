package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
)

const recipeColumns = `id, title, source_kind, source_ref, image_url, servings, ingredients_json, instructions_json`

func (db *DB) ListRecipes(ctx context.Context) ([]Recipe, error) {
	rows, err := db.sql.QueryContext(ctx, "SELECT "+recipeColumns+" FROM recipes")
	if err != nil {
		return nil, fmt.Errorf("rezepte lesen: %w", err)
	}
	defer rows.Close()

	recipes := []Recipe{}
	for rows.Next() {
		recipe, err := scanRecipe(rows)
		if err != nil {
			return nil, err
		}
		recipes = append(recipes, recipe)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rezepte lesen: %w", err)
	}

	// Sortiert wird in Go, weil SQLite Umlaute nicht wie im Deutschen einordnet.
	slices.SortFunc(recipes, func(a, b Recipe) int {
		return strings.Compare(titleSortKey(a.Title), titleSortKey(b.Title))
	})
	return recipes, nil
}

func (db *DB) GetRecipe(ctx context.Context, id string) (Recipe, error) {
	row := db.sql.QueryRowContext(ctx, "SELECT "+recipeColumns+" FROM recipes WHERE id = ?", id)
	recipe, err := scanRecipe(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Recipe{}, ErrNotFound
	}
	return recipe, err
}

// CountRecipes zählt alle Rezepte.
func (db *DB) CountRecipes(ctx context.Context) (int, error) {
	var count int
	if err := db.sql.QueryRowContext(ctx, "SELECT COUNT(*) FROM recipes").Scan(&count); err != nil {
		return 0, fmt.Errorf("rezepte zählen: %w", err)
	}
	return count, nil
}

// InsertRecipes legt Rezepte mit der angegebenen Herkunft (z. B. "seed") in einer Transaktion an.
func (db *DB) InsertRecipes(ctx context.Context, origin string, recipes []Recipe) error {
	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, r := range recipes {
		ingredients, err := jsonOrNull(r.Ingredients)
		if err != nil {
			return err
		}
		instructions, err := jsonOrNull(r.Instructions)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO recipes (id, title, source_kind, source_ref, image_url, servings, ingredients_json, instructions_json, origin)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, r.Title, r.Source.Kind, r.Source.Ref(), nullIfEmpty(r.ImageURL), nullIfEmpty(r.Servings),
			ingredients, instructions, origin,
		); err != nil {
			return fmt.Errorf("rezept %s anlegen: %w", r.ID, err)
		}
	}
	return tx.Commit()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRecipe(s scanner) (Recipe, error) {
	var (
		r                         Recipe
		kind, ref                 string
		imageURL, servings        sql.NullString
		ingredients, instructions sql.NullString
	)
	if err := s.Scan(&r.ID, &r.Title, &kind, &ref, &imageURL, &servings, &ingredients, &instructions); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Recipe{}, err
		}
		return Recipe{}, fmt.Errorf("rezept lesen: %w", err)
	}
	r.Source = sourceFrom(kind, ref)
	r.ImageURL = imageURL.String
	r.Servings = servings.String
	if err := unmarshalList(ingredients, &r.Ingredients); err != nil {
		return Recipe{}, fmt.Errorf("zutaten von %s: %w", r.ID, err)
	}
	if err := unmarshalList(instructions, &r.Instructions); err != nil {
		return Recipe{}, fmt.Errorf("zubereitung von %s: %w", r.ID, err)
	}
	return r, nil
}

func unmarshalList(value sql.NullString, target *[]string) error {
	if !value.Valid {
		return nil
	}
	return json.Unmarshal([]byte(value.String), target)
}

func jsonOrNull(list []string) (any, error) {
	if len(list) == 0 {
		return nil, nil
	}
	data, err := json.Marshal(list)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func nullIfEmpty(value string) any {
	if value == "" {
		return nil
	}
	return value
}

var umlauts = strings.NewReplacer("ä", "a", "ö", "o", "ü", "u", "ß", "ss")

// titleSortKey ordnet Umlaute wie ihre Grundbuchstaben ein ("Ä" wie "A") und ignoriert Groß-/Kleinschreibung.
func titleSortKey(title string) string {
	return umlauts.Replace(strings.ToLower(title))
}
