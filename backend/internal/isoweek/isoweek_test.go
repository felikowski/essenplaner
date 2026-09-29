package isoweek

import (
	"slices"
	"testing"
	"time"
)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestOf(t *testing.T) {
	tests := []struct {
		name string
		date time.Time
		want string
	}{
		{"30.09.2026 liegt in KW 40", date(2026, time.September, 30), "2026-W40"},
		{"31.12.2026 liegt in KW 53", date(2026, time.December, 31), "2026-W53"},
		{"03.01.2027 gehört noch zu KW 53/2026", date(2027, time.January, 3), "2026-W53"},
		{"04.01.2027 beginnt KW 1/2027", date(2027, time.January, 4), "2027-W01"},
		{"29.12.2025 gehört zu KW 1/2026", date(2025, time.December, 29), "2026-W01"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Of(tt.date).String(); got != tt.want {
				t.Errorf("Of(%s) = %s, erwartet %s", FormatDate(tt.date), got, tt.want)
			}
		})
	}
}

func TestDays(t *testing.T) {
	tests := []struct {
		week string
		want []string
	}{
		{"2026-W40", []string{"2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"}},
		{"2026-W41", []string{"2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"}},
		{"2027-W01", []string{"2027-01-04", "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08", "2027-01-09", "2027-01-10"}},
	}
	for _, tt := range tests {
		t.Run(tt.week, func(t *testing.T) {
			w, err := ParseWeek(tt.week)
			if err != nil {
				t.Fatal(err)
			}
			if got := w.Days(); !slices.Equal(got, tt.want) {
				t.Errorf("Days() = %v, erwartet %v", got, tt.want)
			}
		})
	}
}

func TestNextAndPrevious(t *testing.T) {
	tests := []struct{ week, next string }{
		{"2026-W40", "2026-W41"},
		{"2026-W53", "2027-W01"},
		{"2025-W52", "2026-W01"},
	}
	for _, tt := range tests {
		t.Run(tt.week, func(t *testing.T) {
			w, err := ParseWeek(tt.week)
			if err != nil {
				t.Fatal(err)
			}
			if got := w.Next().String(); got != tt.next {
				t.Errorf("Next() = %s, erwartet %s", got, tt.next)
			}
			if got := w.Next().Previous().String(); got != tt.week {
				t.Errorf("Next().Previous() = %s, erwartet %s", got, tt.week)
			}
		})
	}
}

func TestParseWeekInvalid(t *testing.T) {
	for _, input := range []string{"2025-W53", "2026-W00", "2026-W54", "2026-W60", "2026-40", "abc", "", "2026-W4"} {
		if _, err := ParseWeek(input); err == nil {
			t.Errorf("ParseWeek(%q): Fehler erwartet", input)
		}
	}
	if _, err := ParseWeek("2026-W53"); err != nil {
		t.Errorf("2026-W53 sollte gültig sein: %v", err)
	}
}

func TestParseDate(t *testing.T) {
	if got, err := ParseDate("2026-09-30"); err != nil || FormatDate(got) != "2026-09-30" {
		t.Errorf("ParseDate(2026-09-30) = %v, %v", got, err)
	}
	for _, input := range []string{"2026-02-30", "2026-13-01", "30.09.2026", "2026-9-30", "abc", ""} {
		if _, err := ParseDate(input); err == nil {
			t.Errorf("ParseDate(%q): Fehler erwartet", input)
		}
	}
}
