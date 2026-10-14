package webimport

import (
	"net/url"
	"sort"
	"strings"

	"golang.org/x/net/publicsuffix"
)

// trackingParams werden beim Vergleich von Adressen ignoriert.
var trackingParams = map[string]bool{"fbclid": true, "gclid": true, "mc_cid": true, "mc_eid": true, "igshid": true}

// CanonicalURL bestimmt die Adresse, unter der ein Rezept als Duplikat erkannt wird:
// Canonical-Link der Seite, sonst die URL aus den Rezeptdaten, sonst die Adresse nach Weiterleitungen.
// Kandidaten auf einer anderen Domain als die abgerufene Seite werden ignoriert.
func CanonicalURL(page *Page, final *url.URL) string {
	for _, candidate := range []string{page.Canonical, page.Recipe.URL} {
		u, err := url.Parse(candidate)
		if err != nil || candidate == "" {
			continue
		}
		if sameSite(u, final) {
			return Normalize(u)
		}
	}
	return Normalize(final)
}

func sameSite(a, b *url.URL) bool {
	siteA, errA := publicsuffix.EffectiveTLDPlusOne(strings.ToLower(a.Hostname()))
	siteB, errB := publicsuffix.EffectiveTLDPlusOne(strings.ToLower(b.Hostname()))
	return errA == nil && errB == nil && siteA == siteB
}

// Normalize vereinheitlicht eine Adresse: Host klein, ohne Fragment, Standardport und Tracking-Parameter,
// übrige Query-Parameter sortiert.
func Normalize(u *url.URL) string {
	n := *u
	n.Scheme = strings.ToLower(n.Scheme)
	host := strings.ToLower(n.Hostname())
	if port := n.Port(); port != "" && !(n.Scheme == "http" && port == "80") && !(n.Scheme == "https" && port == "443") {
		host += ":" + port
	}
	n.Host = host
	n.Fragment = ""
	n.RawFragment = ""
	n.User = nil
	if n.Path == "" {
		n.Path = "/"
	}

	query := n.Query()
	for key := range query {
		if strings.HasPrefix(strings.ToLower(key), "utm_") || trackingParams[strings.ToLower(key)] {
			query.Del(key)
		}
	}
	keys := make([]string, 0, len(query))
	for key := range query {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var parts []string
	for _, key := range keys {
		values := query[key]
		sort.Strings(values)
		for _, value := range values {
			parts = append(parts, url.QueryEscape(key)+"="+url.QueryEscape(value))
		}
	}
	n.RawQuery = strings.Join(parts, "&")
	n.ForceQuery = false
	return n.String()
}
