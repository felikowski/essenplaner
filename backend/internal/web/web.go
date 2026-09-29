// Package web liefert das gebaute Frontend aus, das beim Build nach dist/ kopiert und eingebettet wird.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var embedded embed.FS

// Dist liefert die eingebetteten Frontend-Dateien.
func Dist() fs.FS {
	dist, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err)
	}
	return dist
}

// Handler liefert Dateien aus fsys aus. Pfade ohne passende Datei erhalten die index.html,
// damit Deep-Links wie /woche/2026-W40 im Browser funktionieren.
func Handler(fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name != "" && name != "index.html" && isFile(fsys, name) {
			if strings.HasPrefix(name, "assets/") {
				// Vite versieht diese Dateien mit einem Hash im Namen.
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFileFS(w, r, fsys, name)
			return
		}

		index, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			http.Error(w, "Frontend nicht gebaut – bitte `make build` ausführen.", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodGet {
			w.Write(index)
		}
	})
}

func isFile(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}
