package safefetch

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestIsPublic(t *testing.T) {
	tests := []struct {
		addr   string
		public bool
	}{
		{"93.184.215.14", true},
		{"2a00:1450:4001:82a::200e", true},
		{"127.0.0.1", false},
		{"127.1.2.3", false},
		{"::1", false},
		{"0.0.0.0", false},
		{"::", false},
		{"10.0.0.5", false},
		{"172.16.0.1", false},
		{"192.168.1.1", false},
		{"169.254.169.254", false},
		{"fe80::1", false},
		{"fc00::1", false},
		{"100.64.0.1", false},
		{"100.127.255.254", false},
		{"::ffff:127.0.0.1", false},
		{"::ffff:10.0.0.1", false},
		{"::ffff:93.184.215.14", true},
		{"64:ff9b::7f00:1", false},
		{"2002:7f00:1::", false},
		{"224.0.0.1", false},
		{"255.255.255.255", false},
		{"198.18.0.1", false},
		{"192.0.2.1", false},
	}
	for _, tt := range tests {
		if got := IsPublic(netip.MustParseAddr(tt.addr)); got != tt.public {
			t.Errorf("IsPublic(%s) = %v, erwartet %v", tt.addr, got, tt.public)
		}
	}
}

func TestParseURL(t *testing.T) {
	tests := []struct {
		raw  string
		want error
	}{
		{"https://www.chefkoch.de/rezepte/123/curry.html", nil},
		{"  http://example.com/rezept  ", nil},
		{"https://example.com:443/x", nil},
		{"ftp://example.com/x", ErrInvalidURL},
		{"javascript:alert(1)", ErrInvalidURL},
		{"example.com/rezept", ErrInvalidURL},
		{"", ErrInvalidURL},
		{"https://user:pass@example.com/", ErrInvalidURL},
		{"https://example.com:8443/", ErrBlocked},
		{"http://127.0.0.1:8080/api/recipes", ErrBlocked},
		{"http://127.0.0.1/", ErrBlocked},
		{"http://169.254.169.254/", ErrBlocked},
		{"http://[::1]/", ErrBlocked},
		{"http://[::ffff:127.0.0.1]/", ErrBlocked},
		{"http://0.0.0.0/", ErrBlocked},
		{"http://10.0.0.5/", ErrBlocked},
	}
	for _, tt := range tests {
		_, err := ParseURL(tt.raw)
		if tt.want == nil && err != nil {
			t.Errorf("ParseURL(%q) = %v, erwartet ok", tt.raw, err)
		}
		if tt.want != nil && !errors.Is(err, tt.want) {
			t.Errorf("ParseURL(%q) = %v, erwartet %v", tt.raw, err, tt.want)
		}
	}
}

// Der Dialer muss auch Namen abweisen, die auf interne Adressen auflösen (hier: localhost).
func TestFetchBlocksNamesResolvingToInternalAddresses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("interner server wurde erreicht")
	}))
	defer server.Close()

	client := New(Options{})
	for _, raw := range []string{"http://localhost/", "http://localhost:80/"} {
		u, _ := url.Parse(raw)
		if _, err := client.Fetch(context.Background(), u); !errors.Is(err, ErrBlocked) {
			t.Errorf("Fetch(%s) = %v, erwartet ErrBlocked", raw, err)
		}
	}
}

// testClient erlaubt nur 127.0.0.1, damit ein lokaler Testserver erreichbar ist.
func testClient(opts Options) *Client {
	loopback := netip.MustParseAddr("127.0.0.1")
	opts.AllowAddr = func(addr netip.Addr) bool { return addr == loopback }
	return New(opts)
}

func fetch(t *testing.T, client *Client, raw string) (*Page, error) {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return client.Fetch(context.Background(), u)
}

func TestFetchReturnsHTMLAndFinalURL(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/alt", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/rezept", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/rezept", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") == "" || !strings.HasPrefix(r.Header.Get("Accept-Language"), "de") {
			t.Errorf("header fehlen: %v", r.Header)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte("<html>ok</html>"))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	page, err := fetch(t, testClient(Options{}), server.URL+"/alt")
	if err != nil {
		t.Fatal(err)
	}
	if string(page.Body) != "<html>ok</html>" || page.URL.Path != "/rezept" {
		t.Errorf("page = %q, %s", page.Body, page.URL)
	}
}

func TestFetchRejectsRedirectToInternalAddress(t *testing.T) {
	for _, target := range []string{"http://10.0.0.5/", "http://[::1]:80/", "http://169.254.169.254/latest/meta-data"} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, target, http.StatusFound)
		}))
		_, err := fetch(t, testClient(Options{Timeout: 2 * time.Second}), server.URL)
		server.Close()
		if !errors.Is(err, ErrBlocked) {
			t.Errorf("weiterleitung nach %s: %v, erwartet ErrBlocked", target, err)
		}
	}
}

func TestFetchRejectsRedirectToOtherScheme(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "file:///etc/passwd", http.StatusFound)
	}))
	defer server.Close()
	if _, err := fetch(t, testClient(Options{}), server.URL); !errors.Is(err, ErrInvalidURL) {
		t.Errorf("err = %v, erwartet ErrInvalidURL", err)
	}
}

func TestFetchLimitsRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/next"+r.URL.Path, http.StatusFound)
	}))
	defer server.Close()
	if _, err := fetch(t, testClient(Options{}), server.URL); !errors.Is(err, ErrFetch) {
		t.Errorf("err = %v, erwartet ErrFetch", err)
	}
}

func TestFetchLimitsSize(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(strings.Repeat("a", 101)))
	}))
	defer server.Close()
	if _, err := fetch(t, testClient(Options{MaxBytes: 100}), server.URL); !errors.Is(err, ErrTooLarge) {
		t.Errorf("err = %v, erwartet ErrTooLarge", err)
	}
	if _, err := fetch(t, testClient(Options{MaxBytes: 101}), server.URL); err != nil {
		t.Errorf("genau an der grenze: %v", err)
	}
}

func TestFetchTimesOut(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer server.Close()
	defer close(release)

	start := time.Now()
	_, err := fetch(t, testClient(Options{Timeout: 200 * time.Millisecond}), server.URL)
	if !errors.Is(err, ErrFetch) {
		t.Errorf("err = %v, erwartet ErrFetch", err)
	}
	if time.Since(start) > 2*time.Second {
		t.Error("timeout griff nicht")
	}
}

func TestFetchRejectsErrorsAndNonHTML(t *testing.T) {
	tests := map[string]http.HandlerFunc{
		"404": func(w http.ResponseWriter, r *http.Request) { http.NotFound(w, r) },
		"json": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}"))
		},
		"pdf": func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/pdf")
			w.Write([]byte("%PDF"))
		},
	}
	for name, handler := range tests {
		server := httptest.NewServer(handler)
		_, err := fetch(t, testClient(Options{}), server.URL)
		server.Close()
		if !errors.Is(err, ErrFetch) {
			t.Errorf("%s: err = %v, erwartet ErrFetch", name, err)
		}
	}
}
