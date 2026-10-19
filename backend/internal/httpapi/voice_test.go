package httpapi

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/felikowski/essenplaner/backend/internal/auth"
	"github.com/felikowski/essenplaner/backend/internal/config"
	"github.com/felikowski/essenplaner/backend/internal/seed"
	"github.com/felikowski/essenplaner/backend/internal/store"
	"github.com/felikowski/essenplaner/backend/internal/voice"
)

// fakeVoice ersetzt den Sprachdienst: Die Aufnahme ist hier schon der Text.
type fakeVoice struct {
	mu    sync.Mutex
	calls int
	hints []string
	lines []string
	err   error
}

func (f *fakeVoice) Transcribe(_ context.Context, audio io.Reader, _ string, hints []string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	f.hints = hints
	if f.err != nil {
		return "", f.err
	}
	data, _ := io.ReadAll(audio)
	return string(data), nil
}

func (f *fakeVoice) SplitLines(_ context.Context, text string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if f.lines != nil {
		return f.lines, nil
	}
	return voice.Clean(strings.Split(text, ",")), nil
}

func newVoiceAPI(t *testing.T, fake *fakeVoice, logs io.Writer) (http.Handler, *store.DB) {
	t.Helper()
	ctx := context.Background()
	db, err := store.Open(ctx, t.TempDir()+"/test.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := seed.Run(ctx, db); err != nil {
		t.Fatal(err)
	}
	if logs == nil {
		logs = io.Discard
	}
	return NewServer(StoresFrom(db), slog.New(slog.NewTextHandler(logs, nil))).WithVoice(fake).Handler(nil), db
}

func postAudio(t *testing.T, h http.Handler, contentType string, audio []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("POST", "/api/shopping/voice/parse", bytes.NewReader(audio))
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func postVoiceText(t *testing.T, h http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("POST", "/api/shopping/voice/parse", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

type voiceResponse struct {
	Transcript string
	Lines      []struct {
		Text, Name, Category string
		MergesInto           *string
	}
}

func TestVoiceAvailability(t *testing.T) {
	without, _ := newTestAPI(t)
	if got := do(t, without, "GET", "/api/shopping/voice", "").Body.String(); got != "{\"available\":false}\n" {
		t.Errorf("ohne dienst: %s", got)
	}
	assertError(t, postVoiceText(t, without, `{"text":"Feta"}`), http.StatusServiceUnavailable)

	with, _ := newVoiceAPI(t, &fakeVoice{}, nil)
	if got := do(t, with, "GET", "/api/shopping/voice", "").Body.String(); got != "{\"available\":true}\n" {
		t.Errorf("mit dienst: %s", got)
	}
}

func TestVoiceParseAudio(t *testing.T) {
	fake := &fakeVoice{}
	h, _ := newVoiceAPI(t, fake, nil)
	shoppingOf(t, do(t, h, "POST", "/api/shopping/items", `{"text":"Bier"}`))
	do(t, h, "POST", "/api/shopping/staples", `{"text":"1 Becher Skyr"}`)
	version := shoppingOf(t, do(t, h, "GET", "/api/shopping/list", "")).Version

	rec := postAudio(t, h, "audio/webm;codecs=opus", []byte("2 Gurken, Feta, Bier, Spülmittel"))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	got := decode[voiceResponse](t, rec)
	if got.Transcript != "2 Gurken, Feta, Bier, Spülmittel" || len(got.Lines) != 4 {
		t.Fatalf("antwort = %+v", got)
	}
	if got.Lines[0].Text != "2 Gurken" || got.Lines[0].Category != "Obst & Gemüse" || got.Lines[2].MergesInto == nil {
		t.Errorf("zeilen = %+v", got.Lines)
	}
	if strings.Join(fake.hints, ",") != "Bier,Skyr" {
		t.Errorf("schreibhilfe = %q", fake.hints)
	}
	if list := shoppingOf(t, do(t, h, "GET", "/api/shopping/list", "")); list.Version != version {
		t.Error("auswertung hat die Liste geändert")
	}
}

func TestVoiceParseText(t *testing.T) {
	fake := &fakeVoice{}
	h, _ := newVoiceAPI(t, fake, nil)
	rec := postVoiceText(t, h, `{"text":"500g Hack, Tomaten (Dose), Parmesan"}`)
	got := decode[voiceResponse](t, rec)
	if rec.Code != http.StatusOK || len(got.Lines) != 3 || fake.calls != 1 {
		t.Errorf("status %d, %+v, %d aufrufe", rec.Code, got, fake.calls)
	}
}

func TestVoiceParseErrors(t *testing.T) {
	h, _ := newVoiceAPI(t, &fakeVoice{}, nil)
	assertError(t, postAudio(t, h, "audio/mp4", bytes.Repeat([]byte("a"), 5<<20+1)), http.StatusRequestEntityTooLarge)
	assertError(t, postAudio(t, h, "audio/ogg", nil), http.StatusUnprocessableEntity)
	assertError(t, postAudio(t, h, "audio/wav", []byte("x")), http.StatusUnsupportedMediaType)
	assertError(t, postVoiceText(t, h, `{"text":"`+strings.Repeat("ä", 2001)+`"}`), http.StatusUnprocessableEntity)
	assertError(t, postVoiceText(t, h, `{"text":"  "}`), http.StatusUnprocessableEntity)
	assertError(t, postVoiceText(t, h, `{}`), http.StatusBadRequest)
	if rec := postVoiceText(t, h, `{"text":"`+strings.Repeat("ä", 2000)+`"}`); rec.Code != http.StatusOK {
		t.Errorf("2000 zeichen: %d", rec.Code)
	}

	nothing, _ := newVoiceAPI(t, &fakeVoice{lines: []string{}}, nil)
	rec := postVoiceText(t, nothing, `{"text":"äh"}`)
	assertError(t, rec, http.StatusUnprocessableEntity)
	if !strings.Contains(rec.Body.String(), "Ich habe nichts zum Einkaufen herausgehört.") {
		t.Errorf("meldung = %s", rec.Body.String())
	}
	if rec := postAudio(t, nothing, "audio/webm", []byte(" ")); rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("stille aufnahme: %d", rec.Code)
	}

	for _, err := range []error{&voice.Error{Kind: "timeout"}, &voice.Error{Kind: "http", Status: 500}, &voice.Error{Kind: "schema", Status: 200}} {
		broken, _ := newVoiceAPI(t, &fakeVoice{err: err}, nil)
		rec := postAudio(t, broken, "audio/webm", []byte("Feta"))
		assertError(t, rec, http.StatusBadGateway)
		if !strings.Contains(rec.Body.String(), "Die Spracherkennung ist gerade nicht erreichbar.") {
			t.Errorf("%v: %s", err, rec.Body.String())
		}
	}
}

func TestVoiceRateLimit(t *testing.T) {
	fake := &fakeVoice{}
	h, _ := newVoiceAPI(t, fake, nil)
	for i := range voiceLimit {
		if rec := postVoiceText(t, h, `{"text":"Feta"}`); rec.Code != http.StatusOK {
			t.Fatalf("ansage %d: %d", i+1, rec.Code)
		}
	}
	rec := postVoiceText(t, h, `{"text":"Feta"}`)
	assertError(t, rec, http.StatusTooManyRequests)
	if !strings.Contains(rec.Body.String(), "Zu viele Ansagen, bitte kurz warten.") || fake.calls != voiceLimit {
		t.Errorf("%s, %d aufrufe", rec.Body.String(), fake.calls)
	}
}

func TestRateLimiterWindow(t *testing.T) {
	l := newRateLimiter(2, time.Hour)
	start := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	if !l.allow("anna", start) || !l.allow("anna", start.Add(time.Minute)) || l.allow("anna", start.Add(2*time.Minute)) {
		t.Fatal("grenze greift nicht")
	}
	if !l.allow("ben", start.Add(2*time.Minute)) {
		t.Error("grenze gilt je Nutzer")
	}
	if !l.allow("anna", start.Add(time.Hour)) || l.allow("anna", start.Add(time.Hour+time.Second)) {
		t.Error("gleitendes fenster")
	}
}

func TestVoiceLogsNoContent(t *testing.T) {
	var logs bytes.Buffer
	h, _ := newVoiceAPI(t, &fakeVoice{}, &logs)
	postAudio(t, h, "audio/webm", []byte("Geheimgurke, Flüsterfeta"))
	postVoiceText(t, h, `{"text":"Tuscheltomate"}`)
	broken, _ := newVoiceAPI(t, &fakeVoice{err: &voice.Error{Kind: "http", Status: 503}}, &logs)
	postAudio(t, broken, "audio/webm", []byte("Raunrum"))

	out := logs.String()
	if !strings.Contains(out, "ansage ausgewertet") || !strings.Contains(out, "lines=2") || !strings.Contains(out, "service_status=503") {
		t.Errorf("protokoll unvollständig:\n%s", out)
	}
	for _, secret := range []string{"Geheimgurke", "Flüsterfeta", "Tuscheltomate", "Raunrum"} {
		if strings.Contains(out, secret) {
			t.Errorf("protokoll enthält %q:\n%s", secret, out)
		}
	}
}

func TestVoiceRequiresSession(t *testing.T) {
	fake := &fakeVoice{}
	_, db := newVoiceAPI(t, fake, nil)
	cfg := config.Auth{Domain: "auth.example", ClientID: "id", ClientSecret: "secret", PublicURL: "https://essenplaner.example", AllowedSubjects: []string{"auth0|anna"}}
	service := auth.New(cfg, db, quietLogger(), auth.Options{})
	h := NewServer(StoresFrom(db), quietLogger()).WithVoice(fake).WithAuth(service, true).Handler(nil)

	req := httptest.NewRequest("POST", "/api/shopping/voice/parse", strings.NewReader("Feta"))
	req.Header.Set("Content-Type", "audio/webm")
	req.Header.Set("Origin", "https://essenplaner.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized || fake.calls != 0 {
		t.Errorf("status %d, %d aufrufe an den Sprachdienst", rec.Code, fake.calls)
	}
}
