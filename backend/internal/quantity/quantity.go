// Package quantity fasst Mengen für die Einkaufsliste zusammen: gleiche Einheiten werden addiert,
// g/kg/mg und ml/cl/dl/l ineinander umgerechnet und das Ergebnis zum Einkaufen gerundet und formatiert.
//
// Die Regeln stehen in openspec/specs/shopping-list (Requirement „Gleiche Zutaten zusammenfassen“).
// Fürs Kochen rundet lib/scale.ts im Frontend eigenständig auf handliche Werte.
package quantity

import (
	"math"
	"strconv"
	"strings"
)

// Part ist eine einzelne Menge, etwa „250 g“. Quantity nil bedeutet „ohne Menge“.
type Part struct {
	Quantity *float64
	Unit     string
}

// Group ist die Summe aller Mengen einer Gruppe in der Einheit, in der sie angezeigt wird.
type Group struct {
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit,omitempty"`
}

type dimension struct {
	base   string
	factor float64
}

// convertible bildet umrechenbare Einheiten auf ihre Basiseinheit ab.
var convertible = map[string]dimension{
	"mg": {"g", 0.001},
	"g":  {"g", 1},
	"kg": {"g", 1000},
	"ml": {"ml", 1},
	"cl": {"ml", 10},
	"dl": {"ml", 100},
	"l":  {"ml", 1000},
}

// countable sind Einheiten, die man nur ganz kauft; sie werden wie Mengen ohne Einheit aufgerundet.
var countable = map[string]bool{
	"Stück": true, "Dose": true, "Pck.": true, "Bund": true, "Zehe": true, "Kopf": true,
	"Glas": true, "Becher": true, "Stange": true, "Würfel": true,
}

// Sum fasst Mengen zusammen. Die Gruppen stehen in der Reihenfolge ihres ersten Auftretens.
// Teile ohne Menge zählen nicht mit; gibt es nur solche, ist das Ergebnis leer.
func Sum(parts []Part) []Group {
	type total struct {
		unit  string // Basiseinheit bzw. die Einheit selbst
		value float64
	}
	var totals []total
	index := map[string]int{}
	for _, part := range parts {
		if part.Quantity == nil {
			continue
		}
		unit, value := part.Unit, *part.Quantity
		if d, ok := convertible[unit]; ok {
			unit, value = d.base, value*d.factor
		}
		i, ok := index[unit]
		if !ok {
			i = len(totals)
			index[unit] = i
			totals = append(totals, total{unit: unit})
		}
		totals[i].value += value
	}
	groups := make([]Group, 0, len(totals))
	for _, t := range totals {
		groups = append(groups, display(t.unit, t.value))
	}
	return groups
}

// display rechnet eine Summe in die Anzeigeeinheit um und rundet sie zum Einkaufen.
func display(unit string, value float64) Group {
	switch unit {
	case "g", "ml":
		if rounded := math.Round(value); rounded >= 1000 {
			large := map[string]string{"g": "kg", "ml": "l"}[unit]
			return Group{Quantity: math.Round(value/100) / 10, Unit: large}
		} else if rounded >= 1 || unit == "ml" {
			return Group{Quantity: math.Max(1, rounded), Unit: unit}
		}
		return Group{Quantity: math.Max(1, math.Round(value*1000)), Unit: "mg"}
	case "":
		return Group{Quantity: ceil(value)}
	}
	if countable[unit] {
		return Group{Quantity: ceil(value), Unit: unit}
	}
	return Group{Quantity: math.Max(0.5, math.Round(value*2)/2), Unit: unit}
}

// ceil rundet auf, ohne an Rechenungenauigkeiten wie 2,0000000001 hängen zu bleiben.
func ceil(value float64) float64 {
	return math.Max(1, math.Ceil(value-1e-9))
}

// Format liefert die Gruppen als Text, etwa „250 g + 2 EL“.
func Format(groups []Group) string {
	texts := make([]string, 0, len(groups))
	for _, g := range groups {
		texts = append(texts, FormatGroup(g))
	}
	return strings.Join(texts, " + ")
}

// FormatGroup liefert eine Gruppe als Text, etwa „1,8 kg“, „1½ EL“ oder „4“.
func FormatGroup(g Group) string {
	number := FormatNumber(g.Quantity)
	if g.Unit == "" {
		return number
	}
	return number + " " + g.Unit
}

// FormatNumber schreibt eine Zahl auf Deutsch: höchstens eine Nachkommastelle, Hälften als „½“.
func FormatNumber(value float64) string {
	whole := math.Floor(value + 1e-9)
	rest := value - whole
	if math.Abs(rest-0.5) < 1e-9 {
		if whole == 0 {
			return "½"
		}
		return strconv.FormatFloat(whole, 'f', -1, 64) + "½"
	}
	rounded := math.Round(value*10) / 10
	return strings.Replace(strconv.FormatFloat(rounded, 'f', -1, 64), ".", ",", 1)
}

// Scale multipliziert eine Menge; nil bleibt nil.
func Scale(quantity *float64, factor float64) *float64 {
	if quantity == nil {
		return nil
	}
	v := *quantity * factor
	return &v
}
