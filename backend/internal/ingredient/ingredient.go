// Package ingredient zerlegt Zutatenzeilen wie „200 g Mehl, gesiebt“ in Menge, Einheit, Name und Hinweis.
//
// Dieselbe Logik gibt es im Frontend (frontend/src/lib/ingredient.ts) für die Vorschau beim Tippen.
// Beide werden mit testdata/ingredient-cases.json im Repository-Wurzelverzeichnis geprüft.
package ingredient

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// Ingredient ist eine zerlegte Zutatenzeile. Text ist immer die eingegebene Zeile; die übrigen Felder
// dienen dem Rechnen (Einkaufsliste, Portionen umrechnen).
type Ingredient struct {
	Text     string   `json:"text"`
	Quantity *float64 `json:"quantity,omitempty"`
	// QuantityMin ist bei Spannen („1–2“) die untere Grenze; Quantity ist dann die obere.
	QuantityMin *float64 `json:"-"`
	Unit        string   `json:"unit,omitempty"`
	Name        string   `json:"name"`
	Note        string   `json:"note,omitempty"`
}

// units bildet Schreibweisen (klein, ohne Punkt am Ende) auf die einheitliche Kurzform ab.
var units = map[string]string{}

func init() {
	for canonical, variants := range map[string][]string{
		"g":        {"g", "gr", "gramm"},
		"kg":       {"kg", "kilo", "kilogramm"},
		"mg":       {"mg", "milligramm"},
		"ml":       {"ml", "milliliter"},
		"cl":       {"cl", "zentiliter"},
		"dl":       {"dl", "deziliter"},
		"l":        {"l", "liter"},
		"cm":       {"cm"},
		"TL":       {"tl", "teel", "teelöffel"},
		"EL":       {"el", "essl", "esslöffel", "eßlöffel"},
		"Msp.":     {"msp", "messerspitze", "messerspitzen"},
		"Prise":    {"prise", "prisen", "pr"},
		"Tasse":    {"tasse", "tassen"},
		"Becher":   {"becher"},
		"Glas":     {"glas", "gläser"},
		"Dose":     {"dose", "dosen", "ds"},
		"Pck.":     {"pck", "pkg", "päckchen", "packung", "packungen", "pack"},
		"Bund":     {"bund", "bd"},
		"Stück":    {"stück", "stücke", "stk", "st"},
		"Scheibe":  {"scheibe", "scheiben"},
		"Zehe":     {"zehe", "zehen"},
		"Zweig":    {"zweig", "zweige"},
		"Blatt":    {"blatt", "blätter"},
		"Handvoll": {"handvoll"},
		"Tropfen":  {"tropfen"},
		"Würfel":   {"würfel"},
		"Kopf":     {"kopf", "köpfe"},
		"Stange":   {"stange", "stangen"},
	} {
		for _, variant := range variants {
			units[variant] = canonical
		}
	}
}

var fractions = map[rune]float64{'½': 0.5, '⅓': 1.0 / 3, '⅔': 2.0 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅕': 0.2}

// numberPattern erkennt eine Menge. Reihenfolge zählt: Brüche („1/2“) vor ganzen Zahlen, sonst würde nur „1“ erkannt.
const numberPattern = `(?:\d+/\d+|\d+(?:[.,]\d+)?(?:\s*[½⅓⅔¼¾⅛⅕]|\s+\d+/\d+)?|[½⅓⅔¼¾⅛⅕])`

var (
	bulletPrefix  = regexp.MustCompile(`^[-–•*·]\s+`)
	approxPrefix  = regexp.MustCompile(`(?i)^(?:ca\.?|etwa|circa)\s+`)
	quantityStart = regexp.MustCompile(`^(` + numberPattern + `)(?:\s*(?:-|–|—|bis)\s*(` + numberPattern + `))?`)
)

// Parse zerlegt eine Zutatenzeile.
func Parse(line string) Ingredient {
	text := strings.Join(strings.Fields(line), " ")
	result := Ingredient{Text: text}
	rest := bulletPrefix.ReplaceAllString(text, "")
	afterApprox := approxPrefix.ReplaceAllString(rest, "")

	match := quantityStart.FindStringSubmatchIndex(afterApprox)
	if match == nil {
		result.Name = rest
		return result
	}
	first, ok := parseNumber(afterApprox[match[2]:match[3]])
	if !ok {
		result.Name = rest
		return result
	}
	quantity := first
	if match[4] >= 0 {
		if upper, ok := parseNumber(afterApprox[match[4]:match[5]]); ok {
			lower := first
			result.QuantityMin = &lower
			quantity = upper
		}
	}
	result.Quantity = &quantity

	rest = strings.TrimSpace(afterApprox[match[1]:])
	// Einheit: das nächste Wort, wenn danach noch ein Name folgt.
	if word, remainder := splitFirstWord(rest); word != "" && remainder != "" {
		if unit, ok := units[strings.TrimSuffix(strings.ToLower(word), ".")]; ok {
			result.Unit = unit
			rest = remainder
		}
	}

	name, note, _ := strings.Cut(rest, ",")
	result.Name = strings.TrimSpace(name)
	result.Note = strings.TrimSpace(note)
	if result.Name == "" {
		// Nur eine Menge ohne Namen, etwa „2“: dann ist die ganze Zeile der Name.
		result.Name = text
		result.Quantity, result.QuantityMin, result.Unit, result.Note = nil, nil, "", ""
	}
	return result
}

func splitFirstWord(s string) (string, string) {
	end := strings.IndexFunc(s, func(r rune) bool { return unicode.IsSpace(r) })
	if end < 0 {
		return s, ""
	}
	return s[:end], strings.TrimSpace(s[end:])
}

// parseNumber liest „2“, „1,5“, „1.5“, „1/2“, „½“, „1½“, „1 ½“ und „1 1/2“.
func parseNumber(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	var total float64
	var any bool
	for _, part := range strings.Fields(s) {
		value, ok := parsePart(part)
		if !ok {
			return 0, false
		}
		total += value
		any = true
	}
	return total, any
}

func parsePart(part string) (float64, bool) {
	runes := []rune(part)
	if fraction, ok := fractions[runes[len(runes)-1]]; ok {
		if len(runes) == 1 {
			return fraction, true
		}
		whole, err := strconv.Atoi(string(runes[:len(runes)-1]))
		return float64(whole) + fraction, err == nil
	}
	if numerator, denominator, ok := strings.Cut(part, "/"); ok {
		n, err1 := strconv.Atoi(numerator)
		d, err2 := strconv.Atoi(denominator)
		if err1 != nil || err2 != nil || d == 0 {
			return 0, false
		}
		return float64(n) / float64(d), true
	}
	value, err := strconv.ParseFloat(strings.Replace(part, ",", ".", 1), 64)
	return value, err == nil
}

// ParseAll zerlegt mehrere Zeilen und verwirft leere.
func ParseAll(lines []string) []Ingredient {
	var result []Ingredient
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		result = append(result, Parse(line))
	}
	return result
}
