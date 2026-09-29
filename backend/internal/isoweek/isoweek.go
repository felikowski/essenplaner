// Package isoweek rechnet mit Kalenderwochen nach ISO 8601 ("2026-W40") und
// Kalenderdaten ("2026-09-28"). Es entspricht src/lib/isoWeek.ts im Frontend.
package isoweek

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

const dateLayout = "2006-01-02"

var weekPattern = regexp.MustCompile(`^(\d{4})-W(\d{2})$`)
var datePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// Week ist eine ISO-Kalenderwoche.
type Week struct {
	Year int
	Week int
}

// ParseWeek liest "YYYY-Www" und prüft, ob es die Woche in diesem Jahr gibt.
func ParseWeek(s string) (Week, error) {
	m := weekPattern.FindStringSubmatch(s)
	if m == nil {
		return Week{}, fmt.Errorf("ungültige Kalenderwoche %q", s)
	}
	year, _ := strconv.Atoi(m[1])
	week, _ := strconv.Atoi(m[2])
	if week < 1 || week > WeeksInYear(year) {
		return Week{}, fmt.Errorf("ungültige Kalenderwoche %q", s)
	}
	return Week{Year: year, Week: week}, nil
}

// ParseDate liest "YYYY-MM-DD" und lehnt Daten ab, die es nicht gibt (z. B. 2026-02-30).
func ParseDate(s string) (time.Time, error) {
	if !datePattern.MatchString(s) {
		return time.Time{}, fmt.Errorf("ungültiges Datum %q", s)
	}
	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return time.Time{}, fmt.Errorf("ungültiges Datum %q", s)
	}
	return t, nil
}

// FormatDate formatiert ein Datum als "YYYY-MM-DD".
func FormatDate(t time.Time) string {
	return t.Format(dateLayout)
}

// Of liefert die Kalenderwoche, in der das Datum liegt.
func Of(t time.Time) Week {
	year, week := t.ISOWeek()
	return Week{Year: year, Week: week}
}

// WeeksInYear liefert 52 oder 53.
func WeeksInYear(year int) int {
	// Der 28. Dezember liegt immer in der letzten Kalenderwoche des Jahres.
	_, week := time.Date(year, time.December, 28, 0, 0, 0, 0, time.UTC).ISOWeek()
	return week
}

func (w Week) String() string {
	return fmt.Sprintf("%04d-W%02d", w.Year, w.Week)
}

// Monday liefert den Montag der Woche (UTC, 00:00).
func (w Week) Monday() time.Time {
	// Die KW 1 ist die Woche, die den 4. Januar enthält.
	jan4 := time.Date(w.Year, time.January, 4, 0, 0, 0, 0, time.UTC)
	offset := (int(jan4.Weekday()) + 6) % 7 // Montag = 0
	return jan4.AddDate(0, 0, -offset+(w.Week-1)*7)
}

// Days liefert die sieben Tage der Woche von Montag bis Sonntag als "YYYY-MM-DD".
func (w Week) Days() []string {
	monday := w.Monday()
	days := make([]string, 7)
	for i := range days {
		days[i] = FormatDate(monday.AddDate(0, 0, i))
	}
	return days
}

// Next liefert die folgende Woche.
func (w Week) Next() Week {
	return Of(w.Monday().AddDate(0, 0, 7))
}

// Previous liefert die vorherige Woche.
func (w Week) Previous() Week {
	return Of(w.Monday().AddDate(0, 0, -7))
}
