package webimport

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func parseFixture(t *testing.T, name, pageURL string) (*Page, error) {
	t.Helper()
	body, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	base, _ := url.Parse(pageURL)
	return Parse(body, base)
}

func TestParseFixtures(t *testing.T) {
	tests := []struct {
		file, url string
		want      Recipe
		canonical string
	}{
		{
			file: "chefkoch-style.html", url: "https://www.chefkoch.de/rezepte/1234567/Kuerbissuppe.html?utm_source=x",
			want: Recipe{
				Title:       "Kürbissuppe mit Ingwer",
				ImageURL:    "https://img.chefkoch-cdn.de/rezepte/1234567/bilder/1/crop-960x720/kuerbissuppe.jpg",
				Yield:       "4 Portion(en)",
				Ingredients: []string{"1 kg Hokkaido-Kürbis", "1 Zwiebel(n)", "2 cm Ingwer", "800 ml Gemüsebrühe", "200 ml Kokosmilch", "Salz und Pfeffer"},
				Instructions: []string{
					"Kürbis waschen, entkernen und würfeln.",
					"Zwiebel und Ingwer schälen und hacken.",
					"Alles in Öl andünsten, mit Brühe ablöschen und 20 Minuten köcheln.",
					"Kokosmilch zugeben, pürieren und abschmecken.",
				},
				URL: "https://www.chefkoch.de/rezepte/1234567/Kuerbissuppe.html",
			},
			canonical: "https://www.chefkoch.de/rezepte/1234567/Kuerbissuppe.html",
		},
		{
			file: "wordpress-graph.html", url: "https://kochblog.example.de/zucchini-puffer/",
			want: Recipe{
				Title:        "Zucchini-Puffer mit Feta & Kräutern",
				ImageURL:     "https://kochblog.example.de/wp-content/uploads/puffer.jpg",
				Yield:        "4",
				Ingredients:  []string{"2 Zucchini", "100 g Feta", "1 Ei", "3 EL Mehl"},
				Instructions: []string{"Zucchini raspeln und ausdrücken.", "Mit Feta, Ei und Mehl mischen.", "In der Pfanne goldbraun braten."},
			},
			canonical: "https://kochblog.example.de/zucchini-puffer/",
		},
		{
			file: "sections.html", url: "https://www.example.com/apfelkuchen",
			want: Recipe{
				Title:       "Apfelkuchen vom Blech",
				ImageURL:    "https://images.example.com/apfelkuchen.jpg",
				Yield:       "20",
				Ingredients: []string{"300 g Mehl", "200 g Butter", "1 kg Äpfel"},
				Instructions: []string{
					"Mehl und Butter verkneten.", "Teig 30 Min. kühlen.",
					"Äpfel schälen und in Spalten schneiden.", "Bei 180 °C 40 Minuten backen.",
				},
			},
		},
		{
			file: "broken-jsonld.html", url: "https://example.org/linsen",
			want: Recipe{
				Title:        "Linsensuppe",
				Ingredients:  []string{"250 g Linsen"},
				Instructions: []string{"Linsen kochen.", "Würzen."},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.file, func(t *testing.T) {
			page, err := parseFixture(t, tt.file, tt.url)
			if err != nil {
				t.Fatal(err)
			}
			got := page.Recipe
			if got.Title != tt.want.Title || got.ImageURL != tt.want.ImageURL || got.Yield != tt.want.Yield || got.URL != tt.want.URL {
				t.Errorf("kopfdaten = %+v\nerwartet   %+v", got, tt.want)
			}
			if !slices.Equal(got.Ingredients, tt.want.Ingredients) {
				t.Errorf("zutaten = %q\nerwartet  %q", got.Ingredients, tt.want.Ingredients)
			}
			if !slices.Equal(got.Instructions, tt.want.Instructions) {
				t.Errorf("schritte = %q\nerwartet   %q", got.Instructions, tt.want.Instructions)
			}
			if page.Canonical != tt.canonical {
				t.Errorf("canonical = %q, erwartet %q", page.Canonical, tt.canonical)
			}
		})
	}
}

func TestParseWithoutRecipe(t *testing.T) {
	if _, err := parseFixture(t, "no-recipe.html", "https://example.com/"); !errors.Is(err, ErrNoRecipe) {
		t.Errorf("err = %v, erwartet ErrNoRecipe", err)
	}
	if _, err := Parse([]byte("kein html {"), nil); !errors.Is(err, ErrNoRecipe) {
		t.Errorf("err = %v, erwartet ErrNoRecipe", err)
	}
}

func TestParseSingleCases(t *testing.T) {
	base, _ := url.Parse("https://example.com/rezepte/x")
	tests := []struct {
		name, jsonld string
		check        func(t *testing.T, r Recipe)
	}{
		{"typ als liste und schema-url", `{"@type":["Thing","https://schema.org/Recipe"],"name":"A","recipeIngredient":["x"]}`, func(t *testing.T, r Recipe) {
			if r.Title != "A" {
				t.Errorf("titel = %q", r.Title)
			}
		}},
		{"relatives bild wird aufgelöst, http-bild verworfen", `{"@type":"Recipe","name":"B","recipeIngredient":["x"],"image":["http://insecure.example.com/b.jpg","/img/b.jpg"]}`, func(t *testing.T, r Recipe) {
			if r.ImageURL != "https://example.com/img/b.jpg" {
				t.Errorf("bild = %q", r.ImageURL)
			}
		}},
		{"anweisungen mit br", `{"@type":"Recipe","name":"C","recipeInstructions":"Eins<br>Zwei<br/>Drei"}`, func(t *testing.T, r Recipe) {
			if !slices.Equal(r.Instructions, []string{"Eins", "Zwei", "Drei"}) {
				t.Errorf("schritte = %q", r.Instructions)
			}
		}},
		{"doppelt kodierte entities", `{"@type":"Recipe","name":"Salz &amp;amp; Pfeffer","recipeIngredient":["x"]}`, func(t *testing.T, r Recipe) {
			if r.Title != "Salz &amp; Pfeffer" && r.Title != "Salz & Pfeffer" {
				t.Errorf("titel = %q", r.Title)
			}
		}},
		{"rezept als mainEntity", `{"@type":"WebPage","mainEntity":{"@type":"Recipe","name":"D","recipeIngredient":["x"]}}`, func(t *testing.T, r Recipe) {
			if r.Title != "D" {
				t.Errorf("titel = %q", r.Title)
			}
		}},
		{"yield als zahl", `{"@type":"Recipe","name":"E","recipeYield":6,"recipeIngredient":["x"]}`, func(t *testing.T, r Recipe) {
			if r.Yield != "6" {
				t.Errorf("yield = %q", r.Yield)
			}
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			page, err := Parse([]byte(`<script type="application/ld+json">`+tt.jsonld+`</script>`), base)
			if err != nil {
				t.Fatal(err)
			}
			tt.check(t, page.Recipe)
		})
	}

	if _, err := Parse([]byte(`<script type="application/ld+json">{"@type":"Recipe","name":"  ","recipeIngredient":["x"]}</script>`), base); !errors.Is(err, ErrNoRecipe) {
		t.Errorf("rezept ohne titel: err = %v", err)
	}
}

func TestParseOrganization(t *testing.T) {
	base, _ := url.Parse("https://example.com/rezept")
	tests := []struct {
		name, fields string
		course       string
		cuisine      string
		tags         []string
		minutes      int
	}{
		{"angaben", `"recipeCategory":"Hauptspeise","recipeCuisine":"Italienisch","keywords":"schnell, vegetarisch","totalTime":"PT45M"`, "Hauptgericht", "Italienisch", []string{"schnell", "vegetarisch"}, 45},
		{"unbekannte kategorie", `"recipeCategory":"Ostern","keywords":["Frühling","Brunch"],"totalTime":"PT1H15M"`, "", "", []string{"Frühling", "Brunch"}, 75},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := []byte(`<script type="application/ld+json">{"@type":"Recipe","name":"Test","recipeIngredient":["x"],` + tt.fields + `}</script>`)
			page, err := Parse(body, base)
			if err != nil {
				t.Fatal(err)
			}
			got := page.Recipe
			if got.Course != tt.course || got.Cuisine != tt.cuisine || !slices.Equal(got.Tags, tt.tags) || got.TotalMinutes == nil || *got.TotalMinutes != tt.minutes {
				t.Errorf("einordnung = %+v", got)
			}
		})
	}
}

func TestKeywordsLimitsAndDurationErrors(t *testing.T) {
	base, _ := url.Parse("https://example.com/rezept")
	body := []byte(`<script type="application/ld+json">{"@type":"Recipe","name":"Test","recipeIngredient":["x"],
		"keywords":["a","gültig","GÜLTIG","eins","zwei","drei","vier","fünf","sechs","sieben","acht","neun","zehn","elf"],
		"totalTime":"morgen"}</script>`)
	page, err := Parse(body, base)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Recipe.Tags) != 10 || page.Recipe.Tags[0] != "gültig" || page.Recipe.TotalMinutes != nil {
		t.Errorf("rezept = %+v", page.Recipe)
	}
}

func TestCanonicalURL(t *testing.T) {
	final, _ := url.Parse("https://WWW.Chefkoch.de/rezepte/1/x.html?utm_source=insta&b=2&a=1#kommentare")
	tests := []struct {
		name string
		page Page
		want string
	}{
		{"canonical-link", Page{Canonical: "https://www.chefkoch.de/rezepte/1/x.html"}, "https://www.chefkoch.de/rezepte/1/x.html"},
		{"fremde canonical-domain wird ignoriert", Page{Canonical: "https://evil.example.com/x"}, "https://www.chefkoch.de/rezepte/1/x.html?a=1&b=2"},
		{"url aus rezeptdaten", Page{Recipe: Recipe{URL: "https://m.chefkoch.de/rezepte/1/x.html"}}, "https://m.chefkoch.de/rezepte/1/x.html"},
		{"finale adresse normalisiert", Page{}, "https://www.chefkoch.de/rezepte/1/x.html?a=1&b=2"},
	}
	for _, tt := range tests {
		if got := CanonicalURL(&tt.page, final); got != tt.want {
			t.Errorf("%s: %q, erwartet %q", tt.name, got, tt.want)
		}
	}
}

func TestNormalize(t *testing.T) {
	tests := map[string]string{
		"https://Example.COM:443/a?utm_medium=x&fbclid=1": "https://example.com/a",
		"http://example.com:80":                           "http://example.com/",
		"https://example.com/a?z=1&a=2#top":               "https://example.com/a?a=2&z=1",
		"https://example.com:8443/a":                      "https://example.com:8443/a",
	}
	for in, want := range tests {
		u, _ := url.Parse(in)
		if got := Normalize(u); got != want {
			t.Errorf("Normalize(%s) = %q, erwartet %q", in, got, want)
		}
	}
}

func TestParseResolvesImageReferences(t *testing.T) {
	base, _ := url.Parse("https://www.chefkoch.de/rezepte/1/x.html")
	body := `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
		{"@type":"Recipe","name":"Nudelsalat","image":{"@id":"https://www.chefkoch.de/rezepte/1/x.html#primaryimage"},"recipeIngredient":["250 g Nudeln"]},
		{"@type":"ImageObject","@id":"https://www.chefkoch.de/rezepte/1/x.html#primaryimage","url":"https://img.chefkoch-cdn.de/nudelsalat.jpg"}
	]}</script>`
	page, err := Parse([]byte(body), base)
	if err != nil {
		t.Fatal(err)
	}
	if page.Recipe.ImageURL != "https://img.chefkoch-cdn.de/nudelsalat.jpg" {
		t.Errorf("bild = %q", page.Recipe.ImageURL)
	}
}

// Übersichtsseiten zeichnen sich selbst als Recipe ohne Zutaten aus und listen viele Rezepte in einer ItemList.
func TestParseIgnoresOverviewPages(t *testing.T) {
	body := `<script type="application/ld+json">{"@type":"Recipe","name":"Rezepte von Kochseite","image":"https://example.com/a.jpg"}</script>
	<script type="application/ld+json">{"@type":"CollectionPage","mainEntity":{"@type":"ItemList","itemListElement":[
		{"@type":"ListItem","item":{"@type":"Recipe","name":"Pfannkuchen","recipeIngredient":["Mehl"]}}]}}</script>`
	if _, err := Parse([]byte(body), nil); !errors.Is(err, ErrNoRecipe) {
		t.Errorf("err = %v, erwartet ErrNoRecipe", err)
	}
}
