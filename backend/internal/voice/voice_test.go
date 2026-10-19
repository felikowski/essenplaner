package voice

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"
)

// fakeOpenAI startet einen Server, der wie die OpenAI-API antwortet.
func fakeOpenAI(t *testing.T, handler http.HandlerFunc) *OpenAI {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	o := NewOpenAI("sk-test", "transcribe-model", "parse-model")
	o.BaseURL = server.URL
	return o
}

func chatAnswer(content string) string {
	body, _ := json.Marshal(map[string]any{
		"choices": []map[string]any{{"message": map[string]any{"role": "assistant", "content": content}}},
	})
	return string(body)
}

func TestSplitLines(t *testing.T) {
	var request struct {
		Model          string `json:"model"`
		Messages       []struct{ Role, Content string }
		ResponseFormat struct {
			Type       string `json:"type"`
			JSONSchema struct {
				Strict bool `json:"strict"`
			} `json:"json_schema"`
		} `json:"response_format"`
	}
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" || r.Header.Get("Authorization") != "Bearer sk-test" {
			t.Errorf("anfrage %s mit %q", r.URL.Path, r.Header.Get("Authorization"))
		}
		json.NewDecoder(r.Body).Decode(&request)
		io.WriteString(w, chatAnswer(`{"lines": ["2 Gurken", " Feta ", "", "Bier", "3 gurken", "Spülmittel"]}`))
	})

	lines, err := o.SplitLines(context.Background(), "zwei Gurken, Feta, noch Bier und Spülmittel")
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"2 Gurken", "Feta", "Bier", "Spülmittel"}; !slices.Equal(lines, want) {
		t.Errorf("zeilen = %q, erwartet %q", lines, want)
	}
	if request.Model != "parse-model" || request.ResponseFormat.Type != "json_schema" || !request.ResponseFormat.JSONSchema.Strict {
		t.Errorf("anfrage = %+v", request)
	}
	if len(request.Messages) != 2 || !strings.Contains(request.Messages[1].Content, "noch Bier") {
		t.Errorf("nachrichten = %+v", request.Messages)
	}
}

func TestSplitLinesEmpty(t *testing.T) {
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, chatAnswer(`{"lines": []}`))
	})
	lines, err := o.SplitLines(context.Background(), "äh, nichts")
	if err != nil || len(lines) != 0 || lines == nil {
		t.Errorf("zeilen = %#v, err = %v", lines, err)
	}
}

func TestSplitLinesSchemaViolation(t *testing.T) {
	for name, body := range map[string]string{
		"kein json":       chatAnswer(`2 Gurken, Feta`),
		"falsches feld":   chatAnswer(`{"items": ["Feta"]}`),
		"falscher typ":    chatAnswer(`{"lines": "Feta"}`),
		"ohne choices":    `{"choices": []}`,
		"antwort kaputt":  `{"choices": [`,
		"inhalt ist null": `{"choices": [{"message": {"content": null}}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, body) })
			_, err := o.SplitLines(context.Background(), "Feta")
			var voiceErr *Error
			if !errors.As(err, &voiceErr) || voiceErr.Kind != "schema" {
				t.Errorf("err = %v", err)
			}
		})
	}
}

func TestHTTPError(t *testing.T) {
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		io.WriteString(w, `{"error": {"message": "Rate limit for Gurken"}}`)
	})
	_, err := o.SplitLines(context.Background(), "Gurken")
	var voiceErr *Error
	if !errors.As(err, &voiceErr) || voiceErr.Kind != "http" || voiceErr.Status != http.StatusTooManyRequests {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), "Gurken") {
		t.Errorf("fehler enthält Inhalte: %v", err)
	}
}

func TestTimeout(t *testing.T) {
	release := make(chan struct{})
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	t.Cleanup(func() { close(release) })
	o.Client.Timeout = 50 * time.Millisecond
	_, err := o.Transcribe(context.Background(), strings.NewReader("audio"), "audio/webm", nil)
	var voiceErr *Error
	if !errors.As(err, &voiceErr) || voiceErr.Kind != "timeout" {
		t.Errorf("err = %v", err)
	}
}

func TestTranscribe(t *testing.T) {
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/audio/transcriptions" {
			t.Errorf("pfad = %s", r.URL.Path)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatal(err)
		}
		if got := r.FormValue("model"); got != "transcribe-model" {
			t.Errorf("model = %q", got)
		}
		if got := r.FormValue("language"); got != "de" {
			t.Errorf("language = %q", got)
		}
		if got := r.FormValue("prompt"); !strings.Contains(got, "Skyr, Hierbas") {
			t.Errorf("prompt = %q", got)
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(file)
		if string(data) != "audio-bytes" || header.Filename != "ansage.mp4" || header.Header.Get("Content-Type") != "audio/mp4" {
			t.Errorf("datei %q %q %q", data, header.Filename, header.Header.Get("Content-Type"))
		}
		io.WriteString(w, `{"text": " zwei Gurken und Skyr "}`)
	})
	text, err := o.Transcribe(context.Background(), strings.NewReader("audio-bytes"), "audio/mp4", []string{"Skyr", " Hierbas "})
	if err != nil || text != "zwei Gurken und Skyr" {
		t.Errorf("text = %q, err = %v", text, err)
	}
}

func TestTranscribeErrors(t *testing.T) {
	o := fakeOpenAI(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	_, err := o.Transcribe(context.Background(), strings.NewReader("x"), "audio/ogg", nil)
	var voiceErr *Error
	if !errors.As(err, &voiceErr) || voiceErr.Status != 500 {
		t.Errorf("err = %v", err)
	}
	if _, err := o.Transcribe(context.Background(), strings.NewReader("x"), "audio/wav", nil); err == nil || errors.As(err, &voiceErr) {
		t.Errorf("unbekanntes format: %v", err)
	}
}

func TestClean(t *testing.T) {
	many := make([]string, 60)
	for i := range many {
		many[i] = strings.Repeat("a", i+1)
	}
	if got := Clean(many); len(got) != 50 {
		t.Errorf("%d zeilen", len(got))
	}
	long := strings.Repeat("ä", 250)
	if got := Clean([]string{long}); len([]rune(got[0])) != 200 {
		t.Errorf("länge = %d", len([]rune(got[0])))
	}
	if got := Clean([]string{"  ", "500 g  Hack", "1 kg hack"}); !slices.Equal(got, []string{"500 g Hack"}) {
		t.Errorf("zeilen = %q", got)
	}
}

func TestHintPromptIsBounded(t *testing.T) {
	hints := make([]string, 500)
	for i := range hints {
		hints[i] = "Artikel"
	}
	if got := hintPrompt(hints); len(got) > maxHintChars+60 {
		t.Errorf("prompt hat %d zeichen", len(got))
	}
}
