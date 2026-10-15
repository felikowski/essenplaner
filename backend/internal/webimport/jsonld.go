// Package webimport liest Rezepte aus den strukturierten Daten (schema.org Recipe als JSON-LD) einer Webseite.
package webimport

import (
	"bytes"
	"encoding/json"
	"errors"
	"html"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	xhtml "golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// ErrNoRecipe: die Seite enthält keine verwertbaren Rezeptdaten.
var ErrNoRecipe = errors.New("no recipe data found")

// Recipe sind die normalisierten Angaben aus den Rezeptdaten einer Seite.
type Recipe struct {
	Title        string
	ImageURL     string
	Yield        string
	Ingredients  []string
	Instructions []string
	Course       string
	Cuisine      string
	Tags         []string
	TotalMinutes *int
	// URL ist die Adresse aus den Rezeptdaten, falls angegeben.
	URL string
}

// Page sind die für den Import relevanten Teile einer HTML-Seite.
type Page struct {
	Recipe    Recipe
	Canonical string
}

// Parse liest Rezeptdaten und Canonical-Link aus einer HTML-Seite. base ist die Adresse der Seite
// und dient zum Auflösen relativer Links.
func Parse(body []byte, base *url.URL) (*Page, error) {
	doc, err := xhtml.Parse(bytes.NewReader(body))
	if err != nil {
		return nil, ErrNoRecipe
	}

	var scripts []string
	var canonical string
	for n := range doc.Descendants() {
		if n.Type != xhtml.ElementNode {
			continue
		}
		switch n.DataAtom {
		case atom.Script:
			if strings.EqualFold(strings.TrimSpace(attr(n, "type")), "application/ld+json") && n.FirstChild != nil {
				scripts = append(scripts, n.FirstChild.Data)
			}
		case atom.Link:
			if canonical == "" && hasToken(attr(n, "rel"), "canonical") {
				canonical = resolve(base, attr(n, "href"))
			}
		}
	}

	var blocks []any
	for _, script := range scripts {
		var data any
		// Kaputte Blöcke sind häufig; sie werden übersprungen.
		if err := json.Unmarshal([]byte(cleanJSON(script)), &data); err == nil {
			blocks = append(blocks, data)
		}
	}
	ids := indexIDs(blocks)
	for _, data := range blocks {
		for _, node := range findRecipes(data) {
			if recipe, ok := normalize(node, ids, base); ok {
				return &Page{Recipe: recipe, Canonical: canonical}, nil
			}
		}
	}
	return nil, ErrNoRecipe
}

func attr(n *xhtml.Node, key string) string {
	for _, a := range n.Attr {
		if strings.EqualFold(a.Key, key) {
			return a.Val
		}
	}
	return ""
}

func hasToken(list, token string) bool {
	for _, field := range strings.Fields(list) {
		if strings.EqualFold(field, token) {
			return true
		}
	}
	return false
}

// cleanJSON entfernt HTML-Kommentare und CDATA-Hüllen, die manche Seiten um JSON-LD legen.
func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	for _, wrap := range [][2]string{{"<!--", "-->"}, {"<![CDATA[", "]]>"}, {"//<![CDATA[", "//]]>"}} {
		if strings.HasPrefix(s, wrap[0]) && strings.HasSuffix(s, wrap[1]) {
			s = strings.TrimSpace(s[len(wrap[0]) : len(s)-len(wrap[1])])
		}
	}
	return s
}

// findRecipes sammelt in Dokumentreihenfolge alle Knoten vom Typ Recipe aus Objekten, Listen, @graph und
// mainEntity. Listen von Rezepten (ItemList) werden bewusst nicht durchsucht: Sie stehen auf Übersichtsseiten,
// und dort soll nicht irgendein Rezept der Liste importiert werden.
func findRecipes(data any) []map[string]any {
	var found []map[string]any
	var walk func(any)
	walk = func(data any) {
		switch v := data.(type) {
		case []any:
			for _, item := range v {
				walk(item)
			}
		case map[string]any:
			if isType(v["@type"], "Recipe") {
				found = append(found, v)
				return
			}
			for _, key := range []string{"@graph", "mainEntity", "mainEntityOfPage"} {
				if child, ok := v[key]; ok {
					walk(child)
				}
			}
		}
	}
	walk(data)
	return found
}

// indexIDs sammelt alle Knoten mit @id, damit Verweise wie {"@id": "…#primaryimage"} aufgelöst werden können.
func indexIDs(blocks []any) map[string]map[string]any {
	ids := map[string]map[string]any{}
	var walk func(any)
	walk = func(data any) {
		switch v := data.(type) {
		case []any:
			for _, item := range v {
				walk(item)
			}
		case map[string]any:
			if id, ok := v["@id"].(string); ok && len(v) > 1 {
				if _, seen := ids[id]; !seen {
					ids[id] = v
				}
			}
			for _, child := range v {
				walk(child)
			}
		}
	}
	for _, block := range blocks {
		walk(block)
	}
	return ids
}

// deref ersetzt einen reinen Verweis {"@id": "…"} durch den Knoten mit dieser @id.
func deref(value any, ids map[string]map[string]any) any {
	if m, ok := value.(map[string]any); ok && len(m) == 1 {
		if id, ok := m["@id"].(string); ok {
			if node, ok := ids[id]; ok {
				return node
			}
		}
	}
	return value
}

func isType(value any, name string) bool {
	switch v := value.(type) {
	case string:
		return strings.EqualFold(strings.TrimPrefix(v, "http://schema.org/"), name) ||
			strings.EqualFold(strings.TrimPrefix(v, "https://schema.org/"), name)
	case []any:
		for _, item := range v {
			if isType(item, name) {
				return true
			}
		}
	}
	return false
}

func normalize(node map[string]any, ids map[string]map[string]any, base *url.URL) (Recipe, bool) {
	r := Recipe{Title: cleanText(asString(node["name"]))}
	if r.Title == "" {
		return Recipe{}, false
	}
	r.ImageURL = imageURL(node["image"], ids, base)
	r.Yield = yield(node["recipeYield"])
	for _, item := range asList(node["recipeIngredient"]) {
		if text := cleanText(asString(item)); text != "" {
			r.Ingredients = append(r.Ingredients, text)
		}
	}
	if len(r.Ingredients) == 0 {
		// Ältere Seiten nutzen noch das veraltete Feld "ingredients".
		for _, item := range asList(node["ingredients"]) {
			if text := cleanText(asString(item)); text != "" {
				r.Ingredients = append(r.Ingredients, text)
			}
		}
	}
	r.Instructions = instructions(node["recipeInstructions"])
	r.Course = course(asString(node["recipeCategory"]))
	r.Cuisine = cleanText(asString(node["recipeCuisine"]))
	r.Tags = keywords(node["keywords"])
	r.TotalMinutes = durationMinutes(asString(node["totalTime"]))
	// Ohne Zutaten und Schritte ist es kein Rezept, sondern etwa eine Übersichtsseite mit Rezept-Auszeichnung.
	if len(r.Ingredients) == 0 && len(r.Instructions) == 0 {
		return Recipe{}, false
	}
	if u := resolve(base, asString(node["url"])); u != "" {
		r.URL = u
	}
	return r, true
}

var courseAliases = map[string]string{
	"hauptspeise": "Hauptgericht", "hauptgericht": "Hauptgericht", "main course": "Hauptgericht", "abendessen": "Hauptgericht", "dinner": "Hauptgericht",
	"beilage": "Beilage", "side dish": "Beilage",
	"suppe": "Suppe", "soup": "Suppe",
	"salat": "Salat", "salad": "Salat",
	"vorspeise": "Vorspeise", "appetizer": "Vorspeise", "starter": "Vorspeise",
	"nachtisch": "Dessert", "dessert": "Dessert",
	"frühstück": "Frühstück", "fruehstueck": "Frühstück", "breakfast": "Frühstück",
	"snack":  "Snack",
	"gebäck": "Gebäck", "gebaeck": "Gebäck", "baking": "Gebäck", "baked goods": "Gebäck",
	"getränk": "Getränk", "getraenk": "Getränk", "drink": "Getränk", "beverage": "Getränk",
	"sauce": "Sauce & Dip", "dip": "Sauce & Dip", "sauce & dip": "Sauce & Dip",
}

func course(value string) string {
	return courseAliases[strings.ToLower(cleanText(value))]
}

func keywords(value any) []string {
	var candidates []string
	for _, item := range asList(value) {
		text := cleanText(asString(item))
		if text == "" {
			continue
		}
		candidates = append(candidates, strings.Split(text, ",")...)
	}
	result := []string{}
	seen := map[string]bool{}
	for _, candidate := range candidates {
		candidate = cleanText(candidate)
		key := strings.ToLower(candidate)
		length := utf8.RuneCountInString(candidate)
		if length < 2 || length > 30 || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, candidate)
		if len(result) == 10 {
			break
		}
	}
	return result
}

var isoDuration = regexp.MustCompile(`(?i)^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$`)

func durationMinutes(value string) *int {
	match := isoDuration.FindStringSubmatch(strings.TrimSpace(value))
	if match == nil {
		return nil
	}
	minutes := 0
	for i, factor := range []int{0, 24 * 60, 60, 1} {
		if i == 0 || match[i] == "" {
			continue
		}
		n, err := strconv.Atoi(match[i])
		if err != nil {
			return nil
		}
		minutes += n * factor
	}
	if match[4] != "" {
		seconds, _ := strconv.Atoi(match[4])
		if seconds > 0 {
			minutes++
		}
	}
	if minutes < 1 || minutes > 1440 {
		return nil
	}
	return &minutes
}

func asString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case map[string]any:
		// z. B. {"@value": "..."}
		if s, ok := v["@value"].(string); ok {
			return s
		}
	}
	return ""
}

func asList(value any) []any {
	switch v := value.(type) {
	case []any:
		return v
	case nil:
		return nil
	default:
		return []any{v}
	}
}

// cleanText entfernt HTML-Tags, dekodiert Entities und fasst Leerraum zusammen.
func cleanText(s string) string {
	if strings.ContainsAny(s, "<&") {
		s = stripTags(s)
	}
	return strings.Join(strings.Fields(s), " ")
}

func stripTags(s string) string {
	var b strings.Builder
	tokenizer := xhtml.NewTokenizer(strings.NewReader(s))
	for {
		switch tokenizer.Next() {
		case xhtml.ErrorToken:
			// Doppelt kodierte Entities ("&amp;amp;") kommen auf Rezeptseiten vor.
			return html.UnescapeString(b.String())
		case xhtml.TextToken:
			b.Write(tokenizer.Text())
		case xhtml.StartTagToken, xhtml.EndTagToken, xhtml.SelfClosingTagToken:
			b.WriteByte(' ')
		}
	}
}

func imageURL(value any, ids map[string]map[string]any, base *url.URL) string {
	for _, item := range asList(deref(value, ids)) {
		var candidate string
		switch v := deref(item, ids).(type) {
		case string:
			candidate = v
		case map[string]any:
			candidate = asString(v["url"])
			if candidate == "" {
				candidate = asString(v["contentUrl"])
			}
		}
		if u := resolve(base, candidate); strings.HasPrefix(u, "https://") {
			return u
		}
	}
	return ""
}

func yield(value any) string {
	for _, item := range asList(value) {
		if text := cleanText(asString(item)); text != "" {
			return text
		}
	}
	return ""
}

func instructions(value any) []string {
	var steps []string
	var walk func(any)
	walk = func(v any) {
		switch item := v.(type) {
		case string:
			for _, line := range strings.Split(stripLineTags(item), "\n") {
				if text := cleanText(line); text != "" {
					steps = append(steps, text)
				}
			}
		case []any:
			for _, child := range item {
				walk(child)
			}
		case map[string]any:
			switch {
			case isType(item["@type"], "HowToSection"):
				walk(item["itemListElement"])
			case item["text"] != nil:
				if text := cleanText(asString(item["text"])); text != "" {
					steps = append(steps, text)
				}
			case item["itemListElement"] != nil:
				walk(item["itemListElement"])
			case item["name"] != nil:
				if text := cleanText(asString(item["name"])); text != "" {
					steps = append(steps, text)
				}
			}
		}
	}
	walk(value)
	return steps
}

// stripLineTags wandelt Absätze und Zeilenumbrüche in HTML-Anweisungen in echte Zeilenumbrüche um.
func stripLineTags(s string) string {
	replacer := strings.NewReplacer("<br>", "\n", "<br/>", "\n", "<br />", "\n", "</p>", "\n", "</li>", "\n")
	return replacer.Replace(s)
}

func resolve(base *url.URL, ref string) string {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return ""
	}
	u, err := url.Parse(ref)
	if err != nil {
		return ""
	}
	if base != nil {
		u = base.ResolveReference(u)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	return u.String()
}
