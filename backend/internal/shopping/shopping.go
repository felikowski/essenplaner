// Package shopping enthält die Regeln der Einkaufsliste, die keine Datenbank brauchen:
// Schlüssel für den Vergleich von Namen, die eingebauten Kategorien und Vorschläge für Zutaten.
package shopping

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
)

// Category ist eine eingebaute Kategorie mit festem Kürzel.
type Category struct {
	Slug string
	Name string
}

// SlugOther ist die Kategorie „Sonstiges“, die sich nicht löschen lässt.
const SlugOther = "sonstiges"

// Categories ist die voreingestellte Reihenfolge der Gänge im Laden.
var Categories = []Category{
	{"obst-gemuese", "Obst & Gemüse"},
	{"brot", "Brot & Backwaren"},
	{"milch", "Milchprodukte & Eier"},
	{"kaese", "Käse"},
	{"fleisch", "Fleisch & Fisch"},
	{"tiefkuehl", "Tiefkühl"},
	{"getreide", "Nudeln, Reis & Getreide"},
	{"konserven", "Konserven & Saucen"},
	{"backen", "Backen"},
	{"gewuerze", "Gewürze & Öle"},
	{"suesses", "Süßes & Snacks"},
	{"getraenke", "Getränke"},
	{"drogerie", "Drogerie & Haushalt"},
	{SlugOther, "Sonstiges"},
}

//go:embed suggestions.json
var suggestionsJSON []byte

// suggestions bildet Schlüssel auf das Kürzel einer eingebauten Kategorie ab.
var suggestions = map[string]string{}

// minPartLength: kürzere bekannte Namen („ei“, „eis“) gelten nicht als Wortteil, sonst landete „Brei“ bei den Eiern.
const minPartLength = 4

func init() {
	var grouped map[string][]string
	if err := json.Unmarshal(suggestionsJSON, &grouped); err != nil {
		panic(fmt.Sprintf("suggestions.json: %v", err))
	}
	for slug, names := range grouped {
		for _, name := range names {
			suggestions[Key(name)] = slug
		}
	}
}

// Key ist der Vergleichsschlüssel eines Namens: klein geschrieben, Leerraum zusammengezogen.
func Key(name string) string {
	return strings.ToLower(strings.Join(strings.Fields(name), " "))
}

// Suggest liefert das Kürzel der vorgeschlagenen Kategorie oder SlugOther. Gesucht wird erst exakt,
// dann nach dem längsten bekannten Wortende oder, ohne ein solches, Wortanfang, für den ganzen Namen und jedes Wort darin
// („Rinderhackfleisch“ → „hackfleisch“, „rote Paprika“ → „paprika“).
func Suggest(key string) string {
	if slug, ok := suggestions[key]; ok {
		return slug
	}
	// Ein Wortende geht vor, weil es im Deutschen das Grundwort ist („Kartoffelmehl“ ist Mehl);
	// danach entscheidet die Länge. So ist das Ergebnis auch eindeutig.
	candidates := append([]string{key}, strings.Fields(key)...)
	best, bestScore := SlugOther, 0
	consider := func(slug string, length int, suffix bool) {
		score := length
		if suffix {
			score += 1000
		}
		if score > bestScore {
			best, bestScore = slug, score
		}
	}
	for _, candidate := range candidates {
		if slug, ok := suggestions[candidate]; ok {
			consider(slug, utf8.RuneCountInString(candidate), true)
			continue
		}
		for known, slug := range suggestions {
			length := utf8.RuneCountInString(known)
			if length < minPartLength || strings.Contains(known, " ") {
				continue
			}
			if strings.HasSuffix(candidate, known) {
				consider(slug, length, true)
			} else if strings.HasPrefix(candidate, known) {
				consider(slug, length, false)
			}
		}
	}
	return best
}
