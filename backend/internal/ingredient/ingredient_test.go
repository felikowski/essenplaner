package ingredient

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

type testCase struct {
	Line        string   `json:"line"`
	Quantity    *float64 `json:"quantity"`
	QuantityMin *float64 `json:"quantityMin"`
	Unit        string   `json:"unit"`
	Name        string   `json:"name"`
	Note        string   `json:"note"`
}

// Die Fälle teilt sich dieser Test mit dem Frontend (frontend/src/lib/ingredient.test.ts).
func loadCases(t *testing.T) []testCase {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "testdata", "ingredient-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []testCase
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) < 40 {
		t.Fatalf("nur %d testfälle", len(cases))
	}
	return cases
}

func sameNumber(a, b *float64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return math.Abs(*a-*b) < 1e-9
}

func TestParseSharedCases(t *testing.T) {
	for _, tc := range loadCases(t) {
		got := Parse(tc.Line)
		if !sameNumber(got.Quantity, tc.Quantity) || !sameNumber(got.QuantityMin, tc.QuantityMin) ||
			got.Unit != tc.Unit || got.Name != tc.Name || got.Note != tc.Note {
			t.Errorf("Parse(%q) = menge %v (min %v), einheit %q, name %q, hinweis %q\nerwartet       menge %v (min %v), einheit %q, name %q, hinweis %q",
				tc.Line, deref(got.Quantity), deref(got.QuantityMin), got.Unit, got.Name, got.Note,
				deref(tc.Quantity), deref(tc.QuantityMin), tc.Unit, tc.Name, tc.Note)
		}
	}
}

func deref(f *float64) any {
	if f == nil {
		return nil
	}
	return *f
}

func TestParseKeepsText(t *testing.T) {
	got := Parse("  1-2   Knoblauchzehen ")
	if got.Text != "1-2 Knoblauchzehen" {
		t.Errorf("text = %q", got.Text)
	}
}

func TestParseAllDropsEmptyLines(t *testing.T) {
	got := ParseAll([]string{"200 g Mehl", "", "   ", "2 Eier"})
	if len(got) != 2 || got[1].Name != "Eier" {
		t.Errorf("ParseAll = %+v", got)
	}
}

func TestIngredientJSON(t *testing.T) {
	data, _ := json.Marshal(Parse("200 g Mehl"))
	if string(data) != `{"text":"200 g Mehl","quantity":200,"unit":"g","name":"Mehl"}` {
		t.Errorf("json = %s", data)
	}
	data, _ = json.Marshal(Parse("Salz und Pfeffer"))
	if string(data) != `{"text":"Salz und Pfeffer","name":"Salz und Pfeffer"}` {
		t.Errorf("json = %s", data)
	}
}
