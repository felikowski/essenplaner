package httpapi

import (
	"bytes"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/felikowski/essenplaner/backend/internal/auth"
	"github.com/felikowski/essenplaner/backend/internal/ingredient"
	"github.com/felikowski/essenplaner/backend/internal/voice"
)

const (
	maxVoiceAudioBytes = 5 << 20
	maxVoiceTextRunes  = 2000
	voiceLimit         = 30
	voiceWindow        = time.Hour
)

// WithVoice schaltet die Spracheingabe der Einkaufsliste ein.
func (s *Server) WithVoice(service voice.Service) *Server {
	s.voice = service
	s.voiceLimiter = newRateLimiter(voiceLimit, voiceWindow)
	return s
}

func (s *Server) routeVoice(mux *routes) {
	mux.HandleFunc("GET /api/shopping/voice", s.handleVoiceAvailability)
	mux.HandleFunc("POST /api/shopping/voice/parse", s.handleVoiceParse)
}

func (s *Server) handleVoiceAvailability(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"available": s.voice != nil})
}

type voiceResult struct {
	Transcript string `json:"transcript"`
	linesBody
}

// handleVoiceParse wertet eine Aufnahme oder einen Freitext aus und liefert die Vorschau der Zeilen.
// Inhalte (Audio, Transkript, Zeilen) werden nie protokolliert.
func (s *Server) handleVoiceParse(w http.ResponseWriter, r *http.Request) {
	if s.voice == nil {
		writeError(w, http.StatusServiceUnavailable, "Die Spracheingabe ist nicht eingerichtet.")
		return
	}
	mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	var (
		audio []byte
		text  string
	)
	switch _, isAudio := voice.AudioTypes[mediaType]; {
	case isAudio:
		data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxVoiceAudioBytes))
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "Die Aufnahme ist zu groß (höchstens 5 MB).")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid audio body")
			return
		}
		if len(data) == 0 {
			writeError(w, http.StatusUnprocessableEntity, "Die Aufnahme ist leer.")
			return
		}
		audio = data
	case mediaType == "application/json":
		var body textBody
		if !decodeBody(w, r, &body) {
			return
		}
		if body.Text == nil {
			writeError(w, http.StatusBadRequest, `"text" is required`)
			return
		}
		text = strings.TrimSpace(*body.Text)
		if text == "" || utf8.RuneCountInString(text) > maxVoiceTextRunes {
			writeError(w, http.StatusUnprocessableEntity, "Der Text muss 1 bis 2000 Zeichen lang sein.")
			return
		}
	default:
		writeError(w, http.StatusUnsupportedMediaType, "Erwartet wird eine Aufnahme (audio/webm, audio/mp4, audio/ogg) oder JSON.")
		return
	}

	subject := ""
	if session, ok := auth.SessionFrom(r.Context()); ok {
		subject = session.Subject
	}
	if !s.voiceLimiter.allow(subject, time.Now()) {
		writeError(w, http.StatusTooManyRequests, "Zu viele Ansagen, bitte kurz warten.")
		return
	}
	// Transkription und Zerlegung dürfen je 20 Sekunden dauern, länger als das allgemeine WriteTimeout.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(2*voice.Timeout + 5*time.Second))

	start := time.Now()
	kind := "text"
	fail := func(err error) {
		var serviceErr *voice.Error
		errors.As(err, &serviceErr)
		attrs := []any{"kind", kind, "duration", time.Since(start).Round(time.Millisecond)}
		if serviceErr != nil {
			attrs = append(attrs, "error", serviceErr.Kind, "service_status", serviceErr.Status)
		}
		s.logger.Warn("sprachdienst fehlgeschlagen", attrs...)
		writeError(w, http.StatusBadGateway, "Die Spracherkennung ist gerade nicht erreichbar.")
	}
	if audio != nil {
		kind = "audio"
		hints, err := s.voiceHints(r)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		if text, err = s.voice.Transcribe(r.Context(), bytes.NewReader(audio), mediaType, hints); err != nil {
			fail(err)
			return
		}
	}
	lines := []string{}
	if text != "" {
		var err error
		if lines, err = s.voice.SplitLines(r.Context(), text); err != nil {
			fail(err)
			return
		}
	}
	s.logger.Info("ansage ausgewertet", "kind", kind, "duration", time.Since(start).Round(time.Millisecond), "lines", len(lines))
	if len(lines) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "Ich habe nichts zum Einkaufen herausgehört.")
		return
	}
	previews, err := s.shopping.PreviewShoppingLines(r.Context(), lines)
	if s.writeShoppingError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, voiceResult{Transcript: text, linesBody: linesBody{Lines: previews}})
}

// voiceHints sind die Namen der Artikel auf der Liste und im Vorrat, als Schreibhilfe für die Transkription.
func (s *Server) voiceHints(r *http.Request) ([]string, error) {
	list, err := s.shopping.ShoppingList(r.Context())
	if err != nil {
		return nil, err
	}
	staples, err := s.shopping.Staples(r.Context())
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	hints := []string{}
	add := func(name string) {
		if key := strings.ToLower(name); name != "" && !seen[key] {
			seen[key] = true
			hints = append(hints, name)
		}
	}
	for _, item := range list.Items {
		add(item.Name)
	}
	for _, staple := range staples {
		add(ingredient.Parse(staple.Text).Name)
	}
	return hints, nil
}

// rateLimiter lässt je Schlüssel höchstens limit Ereignisse in einem gleitenden Fenster zu.
// Der Zustand liegt nur im Speicher und beginnt nach einem Neustart von vorn.
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	events map[string][]time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, events: map[string][]time.Time{}}
}

func (l *rateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	recent := l.events[key][:0]
	for _, t := range l.events[key] {
		if now.Sub(t) < l.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.limit {
		l.events[key] = recent
		return false
	}
	l.events[key] = append(recent, now)
	return true
}
