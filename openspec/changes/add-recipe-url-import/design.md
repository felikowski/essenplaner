## Context

Rezepte haben bereits `source.kind = 'web'` (seit `add-frontend-mock-data`), `origin` und `available` (seit `add-google-drive-recipes`). Der Server läuft öffentlich hinter Login und darf nach diesem Change selbst Anfragen ins Internet stellen. Das ist das Hauptrisiko des Changes.

## Goals / Non-Goals

**Goals:**
- Funktioniert mit den gängigen deutschsprachigen Rezeptseiten (Chefkoch, Lecker, Kitchen Stories, eat.de, Blogs mit WordPress-Rezept-Plugins), die schema.org JSON-LD ausliefern
- Kein Einfallstor für SSRF auf interne Dienste des Hosts

**Non-Goals:**
- Suche auf Rezeptseiten
- Rezepte ohne strukturierte Daten per Heuristik oder KI auslesen
- Importierte Rezepte bearbeiten oder regelmäßig aktualisieren
- Bilder lokal speichern (sie werden von der Quelle geladen)
- „Teilen“-Ziel am Handy (Web Share Target), das eine PWA voraussetzt; als späterer Change denkbar

## Decisions

**Nur JSON-LD (schema.org `Recipe`).** Das ist der Standard, den Google für Rezept-Suchergebnisse verlangt, deshalb liefern ihn praktisch alle relevanten Seiten. Microdata und RDFa lassen wir aus, weil sie selten geworden sind und den Parser verdoppeln würden. Scheitert ein Import, sieht der Nutzer eine klare Meldung.

**Parser** (`internal/webimport/jsonld.go`): Alle `<script type="application/ld+json">` per `golang.org/x/net/html` einsammeln. Jedes Stück wird tolerant gelesen, denn einzelne kaputte Blöcke sind häufig und werden übersprungen. Knoten werden rekursiv durchlaufen, inklusive Arrays und `@graph`. Genommen wird der erste Knoten, dessen `@type` `Recipe` ist oder enthält. Die Felder werden normalisiert:
- `name` → Titel (HTML-Entities dekodiert, Leerraum bereinigt); ohne Titel gilt der Knoten als ungültig
- `image`: String, Liste oder `ImageObject.url` → erste absolute https-URL
- `recipeYield`: String, Zahl oder Liste → erster Eintrag als Text
- `recipeIngredient` → Liste von Strings (Tags entfernt, leere Einträge verworfen)
- `recipeInstructions`: String (an Zeilenumbrüchen geteilt), `HowToStep.text` oder `HowToSection.itemListElement` → flache Liste von Schritten in Reihenfolge

Getestet wird mit gespeicherten HTML-Fixtures typischer Seiten unter `testdata/`, inklusive einer Seite ohne Rezeptdaten und einer mit kaputtem JSON.

**Abgesicherter HTTP-Client** (`internal/safefetch`):
- Nur Schemata `http`/`https`, nur Ports 80/443, keine Zugangsdaten in der URL
- Eigener `net.Dialer` mit `Control`-Hook: Die tatsächlich verbundene IP wird geprüft. Das schützt auch gegen DNS-Rebinding und gegen Weiterleitungen, weil jede neue Verbindung erneut geprüft wird. Gesperrt ist alles, was nicht `netip.Addr.IsGlobalUnicast()` ist, sowie private Bereiche (`IsPrivate`), CGNAT `100.64.0.0/10`, IPv4-gemappte IPv6-Adressen solcher Bereiche und NAT64-Präfixe.
- Kein Proxy aus der Umgebung (`Proxy: nil`)
- `CheckRedirect` erlaubt höchstens 5 Weiterleitungen und prüft Schema und Port erneut
- Timeout 10 s gesamt, `io.LimitReader` bei 5 MB + 1 Byte, um Überschreitungen zu erkennen
- Nur `text/html`/`application/xhtml+xml`
- User-Agent `Essenplaner/1.0 (+<PUBLIC_URL>)`, `Accept-Language: de`

Die Alternative, jede URL nur einmal vor dem Abruf per DNS zu prüfen, verwerfen wir: Sie ist anfällig für DNS-Rebinding und übersieht Weiterleitungen.

**Kanonische URL:** Priorität hat `<link rel="canonical">` auf demselben Registrable-Domain-Teil. Danach folgt die `url` aus den JSON-LD-Daten, sonst die finale URL. Anschließend wird normalisiert: Host in Kleinbuchstaben, Fragment entfernt, `utm_*`/`fbclid`/`gclid` entfernt, verbleibende Query-Parameter sortiert. Eindeutiger Index auf `canonical_url`.

**Speicherung:** Rezepte mit `origin = 'web-import'`, `source_kind = 'web'`, `source_ref` = kanonische URL; Zutaten und Schritte kommen in die vorhandenen JSON-Spalten. Entfernen setzt `available = 0` und nutzt die Semantik aus `recipe-catalog`.

**Bilder:** `imageUrl` zeigt direkt auf die Quelle. Die CSP aus `add-google-login` erlaubt bereits `img-src https:`. Den Nachteil nehmen wir in Kauf: Der Browser lädt Bilder von fremden Servern (`referrerpolicy="no-referrer"` am `<img>`).

## Risks / Trade-offs

- [SSRF über Randfälle, etwa IPv6-Varianten oder neue Adressbereiche] → Die Prüfung geschieht an der verbundenen IP und nicht am Namen. Eine umfangreiche Tabellentest-Suite deckt bekannte Umgehungen ab (dezimale/oktale IPv4-Schreibweisen, `[::ffff:127.0.0.1]`, `0.0.0.0`, Weiterleitungsketten).
- [Seiten blockieren Server-Anfragen oder zeigen Bot-Schutz] → Das endet in einer 502-Meldung, dass die Seite den Abruf verweigert hat. Umgehung ist ausdrücklich kein Ziel.
- [Urheberrecht: gespeicherte Zutaten und Schritte] → Nur für den privaten Gebrauch der angemeldeten Familie. Das Original ist in der Detailansicht immer prominent verlinkt.
- [Bilder verschwinden an der Quelle] → Das Frontend blendet Bilder mit Ladefehler aus.

## Migration Plan

Migration: `recipes.canonical_url` plus ein eindeutiger Teilindex `WHERE origin = 'web-import'`. Für das Rollback ist nichts nötig, weil importierte Rezepte als normale Web-Rezepte erhalten bleiben.
