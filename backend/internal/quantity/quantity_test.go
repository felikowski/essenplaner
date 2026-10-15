package quantity

import "testing"

func q(v float64) *float64 { return &v }

func TestSumAndFormat(t *testing.T) {
	cases := []struct {
		name  string
		parts []Part
		want  string
	}{
		{"gleiche Einheit", []Part{{q(500), "g"}, {q(200), "g"}}, "700 g"},
		{"umrechnen in kg", []Part{{q(800), "g"}, {q(1), "kg"}}, "1,8 kg"},
		{"verschiedene Einheiten", []Part{{q(250), "g"}, {q(2), "EL"}}, "250 g + 2 EL"},
		{"umgerechnete Portionen", []Part{{q(250 * 8.0 / 6), "g"}}, "333 g"},
		{"ohne Einheit zusammenzählen", []Part{{q(1), ""}, {q(3), ""}}, "4"},
		{"ohne Einheit aufrunden", []Part{{q(2 * 8.0 / 6), ""}}, "3"},
		{"zählbare Einheit aufrunden", []Part{{q(1.2), "Dose"}}, "2 Dose"},
		{"keine Aufrundung bei genauen Werten", []Part{{q(0.5), ""}, {q(1.5), ""}}, "2"},
		{"Liter", []Part{{q(1.5), "l"}, {q(500), "ml"}}, "2 l"},
		{"cl und dl", []Part{{q(2), "dl"}, {q(5), "cl"}}, "250 ml"},
		{"Löffel auf Hälften", []Part{{q(1), "EL"}, {q(0.4), "EL"}}, "1½ EL"},
		{"halber Löffel", []Part{{q(0.3), "TL"}}, "½ TL"},
		{"Milligramm", []Part{{q(300), "mg"}}, "300 mg"},
		{"ohne Menge", []Part{{nil, ""}}, ""},
		{"ohne Menge zählt nicht mit", []Part{{nil, ""}, {q(2), ""}}, "2"},
		{"Reihenfolge des ersten Auftretens", []Part{{q(2), "EL"}, {q(100), "g"}, {q(1), "EL"}}, "3 EL + 100 g"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Format(Sum(c.parts)); got != c.want {
				t.Errorf("Format(Sum(...)) = %q, erwartet %q", got, c.want)
			}
		})
	}
}

func TestFormatNumber(t *testing.T) {
	for value, want := range map[float64]string{0.5: "½", 2.5: "2½", 1.8: "1,8", 3: "3", 1.25: "1,3"} {
		if got := FormatNumber(value); got != want {
			t.Errorf("FormatNumber(%v) = %q, erwartet %q", value, got, want)
		}
	}
}

func TestScale(t *testing.T) {
	if Scale(nil, 2) != nil {
		t.Error("nil muss nil bleiben")
	}
	if got := *Scale(q(3), 2); got != 6 {
		t.Errorf("Scale = %v", got)
	}
}
