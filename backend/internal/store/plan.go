package store

import (
	"context"
	"fmt"
)

func (db *DB) PlannedDays(ctx context.Context, from, to string) (map[string]string, error) {
	rows, err := db.sql.QueryContext(ctx,
		"SELECT date, recipe_id FROM plan_days WHERE date BETWEEN ? AND ?", from, to)
	if err != nil {
		return nil, fmt.Errorf("plan lesen: %w", err)
	}
	defer rows.Close()

	days := map[string]string{}
	for rows.Next() {
		var date, recipeID string
		if err := rows.Scan(&date, &recipeID); err != nil {
			return nil, fmt.Errorf("plan lesen: %w", err)
		}
		days[date] = recipeID
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("plan lesen: %w", err)
	}
	return days, nil
}

func (db *DB) SetDay(ctx context.Context, date string, recipeID *string) error {
	if recipeID == nil {
		if _, err := db.sql.ExecContext(ctx, "DELETE FROM plan_days WHERE date = ?", date); err != nil {
			return fmt.Errorf("tag %s leeren: %w", date, err)
		}
		return nil
	}

	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var exists bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM recipes WHERE id = ?)", *recipeID).Scan(&exists); err != nil {
		return fmt.Errorf("rezept prüfen: %w", err)
	}
	if !exists {
		return ErrUnknownRecipe
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO plan_days (date, recipe_id) VALUES (?, ?)
		 ON CONFLICT (date) DO UPDATE SET recipe_id = excluded.recipe_id`,
		date, *recipeID,
	); err != nil {
		return fmt.Errorf("tag %s setzen: %w", date, err)
	}
	return tx.Commit()
}
