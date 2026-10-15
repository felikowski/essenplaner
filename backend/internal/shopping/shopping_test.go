package shopping

import (
	"encoding/json"
	"testing"
)

func TestKey(t *testing.T) {
	if got := Key("  Rote   Zwiebeln "); got != "rote zwiebeln" {
		t.Errorf("Key = %q", got)
	}
	if got := Key("Weißkohl"); got != "weißkohl" {
		t.Errorf("ß muss bleiben: %q", got)
	}
}

func TestSuggest(t *testing.T) {
	cases := map[string]string{
		"zucchini":          "obst-gemuese",
		"zwiebeln":          "obst-gemuese",
		"feta":              "kaese",
		"tellerlinsen":      "getreide",
		"rinderhackfleisch": "fleisch",
		"rote paprika":      "obst-gemuese",
		"wildreis":          "getreide",
		"kartoffelmehl":     "backen",       // Grundwort „mehl“ vor dem längeren Wortanfang „kartoffel“
		"paprikawürzung":    "obst-gemuese", // nur ein Wortanfang
		"salz und pfeffer":  "gewuerze",
		"brei":              SlugOther, // „ei“ ist zu kurz für einen Wortteil
		"einhornstaub":      SlugOther,
		"":                  SlugOther,
	}
	for key, want := range cases {
		if got := Suggest(key); got != want {
			t.Errorf("Suggest(%q) = %q, erwartet %q", key, got, want)
		}
	}
}

func TestSuggestionsAreConsistent(t *testing.T) {
	var grouped map[string][]string
	if err := json.Unmarshal(suggestionsJSON, &grouped); err != nil {
		t.Fatal(err)
	}
	slugs := map[string]bool{}
	for _, c := range Categories {
		slugs[c.Slug] = true
	}
	seen := map[string]string{}
	total := 0
	for slug, names := range grouped {
		if !slugs[slug] {
			t.Errorf("unbekannte Kategorie %q", slug)
		}
		for _, name := range names {
			total++
			if Key(name) != name {
				t.Errorf("%q ist kein Schlüssel", name)
			}
			if other, ok := seen[name]; ok {
				t.Errorf("%q steht in %q und %q", name, other, slug)
			}
			seen[name] = slug
		}
	}
	if total < 400 {
		t.Errorf("nur %d Vorschläge", total)
	}
}
