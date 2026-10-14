// Package safefetch ruft fremde Webseiten ab, ohne interne Netzadressen zu erreichen (Schutz vor SSRF).
//
// Geprüft wird die IP-Adresse, mit der tatsächlich verbunden wird, und zwar bei jeder Verbindung.
// Das deckt auch DNS-Namen ab, die auf interne Adressen zeigen, DNS-Rebinding und Weiterleitungen.
package safefetch

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"syscall"
	"time"
)

const (
	DefaultTimeout      = 10 * time.Second
	DefaultMaxBytes     = 5 << 20
	DefaultMaxRedirects = 5
)

var (
	// ErrInvalidURL: keine gültige http(s)-URL, falscher Port oder Zugangsdaten in der URL.
	ErrInvalidURL = errors.New("invalid url")
	// ErrBlocked: die Adresse liegt nicht im öffentlichen Internet.
	ErrBlocked = errors.New("address not allowed")
	// ErrFetch: die Seite ist nicht erreichbar, antwortet mit einem Fehler oder liefert kein HTML.
	ErrFetch = errors.New("fetch failed")
	// ErrTooLarge: die Seite ist größer als erlaubt.
	ErrTooLarge = errors.New("response too large")
)

// Page ist eine abgerufene HTML-Seite.
type Page struct {
	// URL ist die Adresse nach allen Weiterleitungen.
	URL  *url.URL
	Body []byte
}

type Client struct {
	http      *http.Client
	maxBytes  int64
	userAgent string
	policy    urlPolicy
}

// urlPolicy legt fest, welche URLs vor dem Verbinden zulässig sind.
type urlPolicy struct {
	allowPort func(port string) bool
	// checkLiteralIP lehnt URLs mit interner IP-Adresse als Host schon vor dem Verbinden ab.
	checkLiteralIP bool
}

var productionPolicy = urlPolicy{
	allowPort:      func(port string) bool { return port == "80" || port == "443" },
	checkLiteralIP: true,
}

type Options struct {
	Timeout      time.Duration
	MaxBytes     int64
	MaxRedirects int
	UserAgent    string
	// AllowAddr erlaubt zusätzlich bestimmte Adressen. Nur für Tests gedacht (lokaler Testserver).
	AllowAddr func(netip.Addr) bool
}

func New(opts Options) *Client {
	if opts.Timeout == 0 {
		opts.Timeout = DefaultTimeout
	}
	if opts.MaxBytes == 0 {
		opts.MaxBytes = DefaultMaxBytes
	}
	if opts.MaxRedirects == 0 {
		opts.MaxRedirects = DefaultMaxRedirects
	}
	if opts.UserAgent == "" {
		opts.UserAgent = "Essenplaner/1.0"
	}
	policy := productionPolicy
	if opts.AllowAddr != nil {
		// Testserver laufen auf zufälligen Ports und unter 127.0.0.1; der Dialer prüft trotzdem jede Adresse.
		policy = urlPolicy{allowPort: func(string) bool { return true }}
	}

	dialer := &net.Dialer{
		Timeout: opts.Timeout,
		Control: func(_, address string, _ syscall.RawConn) error {
			addrPort, err := netip.ParseAddrPort(address)
			if err != nil {
				return fmt.Errorf("%w: %s", ErrBlocked, address)
			}
			addr := addrPort.Addr().Unmap()
			if opts.AllowAddr != nil && opts.AllowAddr(addr) {
				return nil
			}
			if !IsPublic(addr) {
				return fmt.Errorf("%w: %s", ErrBlocked, addr)
			}
			if !policy.allowPort(fmt.Sprint(addrPort.Port())) {
				return fmt.Errorf("%w: port %d", ErrBlocked, addrPort.Port())
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   opts.Timeout,
		ResponseHeaderTimeout: opts.Timeout,
		MaxIdleConns:          4,
		IdleConnTimeout:       30 * time.Second,
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   opts.Timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > opts.MaxRedirects {
				return fmt.Errorf("%w: too many redirects", ErrFetch)
			}
			return checkURL(req.URL, policy)
		},
	}
	return &Client{http: client, maxBytes: opts.MaxBytes, userAgent: opts.UserAgent, policy: policy}
}

// ParseURL prüft eine vom Nutzer eingegebene Adresse.
func ParseURL(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return nil, ErrInvalidURL
	}
	if err := checkURL(u, productionPolicy); err != nil {
		return nil, err
	}
	return u, nil
}

func checkURL(u *url.URL, policy urlPolicy) error {
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: scheme %q", ErrInvalidURL, u.Scheme)
	}
	if u.User != nil {
		return fmt.Errorf("%w: credentials in url", ErrInvalidURL)
	}
	port := u.Port()
	if port == "" {
		if u.Scheme == "http" {
			port = "80"
		} else {
			port = "443"
		}
	}
	if !policy.allowPort(port) {
		return fmt.Errorf("%w: port %s", ErrBlocked, port)
	}
	if policy.checkLiteralIP {
		if addr, err := netip.ParseAddr(u.Hostname()); err == nil && !IsPublic(addr) {
			return fmt.Errorf("%w: %s", ErrBlocked, addr)
		}
	}
	return nil
}

// Fetch lädt eine HTML-Seite.
func (c *Client) Fetch(ctx context.Context, u *url.URL) (*Page, error) {
	if err := checkURL(u, c.policy); err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, ErrInvalidURL
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("Accept-Language", "de,en;q=0.5")

	res, err := c.http.Do(req)
	if err != nil {
		for _, sentinel := range []error{ErrBlocked, ErrInvalidURL} {
			if errors.Is(err, sentinel) {
				return nil, err
			}
		}
		return nil, fmt.Errorf("%w: %v", ErrFetch, err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, fmt.Errorf("%w: status %d", ErrFetch, res.StatusCode)
	}
	mediaType, _, _ := mime.ParseMediaType(res.Header.Get("Content-Type"))
	if mediaType != "text/html" && mediaType != "application/xhtml+xml" {
		return nil, fmt.Errorf("%w: content type %q", ErrFetch, mediaType)
	}

	body, err := io.ReadAll(io.LimitReader(res.Body, c.maxBytes+1))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrFetch, err)
	}
	if int64(len(body)) > c.maxBytes {
		return nil, ErrTooLarge
	}
	return &Page{URL: res.Request.URL, Body: body}, nil
}

var (
	cgnat = netip.MustParsePrefix("100.64.0.0/10")
	// NAT64 kann auf beliebige IPv4-Adressen (auch interne) übersetzen.
	nat64      = netip.MustParsePrefix("64:ff9b::/96")
	nat64Local = netip.MustParsePrefix("64:ff9b:1::/48")
	// Dokumentations-, Benchmark- und reservierte Bereiche
	blockedPrefixes = []netip.Prefix{
		cgnat, nat64, nat64Local,
		netip.MustParsePrefix("0.0.0.0/8"),
		netip.MustParsePrefix("192.0.0.0/24"),
		netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"),
		netip.MustParsePrefix("240.0.0.0/4"),
		netip.MustParsePrefix("2001:db8::/32"),
		netip.MustParsePrefix("2002::/16"), // 6to4 kann interne IPv4-Adressen einbetten
		netip.MustParsePrefix("2001::/32"), // Teredo
	}
)

// IsPublic meldet, ob eine Adresse im öffentlichen Internet liegt.
func IsPublic(addr netip.Addr) bool {
	addr = addr.Unmap()
	if !addr.IsValid() || !addr.IsGlobalUnicast() || addr.IsPrivate() {
		return false
	}
	for _, prefix := range blockedPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}
