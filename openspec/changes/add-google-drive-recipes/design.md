## Context

Nach `add-auth0-login` gibt es ein geschütztes Backend mit SQLite. Rezepte haben `origin` (`seed`, `drive`, `web-import`) und `source_kind`. Die PDFs liegen in einem Drive-Ordner der Familie, der einem privaten Google-Konto gehört.

## Goals / Non-Goals

**Goals:**
- Die Verbindung zu Drive läuft stabil ohne regelmäßiges Neu-Anmelden
- Minimale Rechte: nur Lesen, nur dieser Ordner
- Kein Datenverlust im Plan, wenn in Drive aufgeräumt wird

**Non-Goals:**
- Text aus den PDFs lesen, etwa Zutaten per OCR
- PDFs aus der App heraus hochladen oder bearbeiten
- Unterordner als Kategorien oder Tags (als späterer Change denkbar)
- Echtzeit-Benachrichtigungen von Drive (Push-Kanäle)

## Decisions

**Zugriff über ein Google-Dienstkonto statt über den OAuth-Consent eines Nutzers.** Der Eigentümer gibt den Rezeptordner in Drive einmalig für die E-Mail-Adresse des Dienstkontos mit der Rolle „Betrachter“ frei. Das Backend authentifiziert sich mit dem Schlüssel des Dienstkontos (Scope `drive.readonly`) und sieht dadurch nur, was freigegeben ist.
- Alternative: OAuth-Consent des Eigentümers mit gespeichertem Refresh-Token. Verworfen, weil `drive.readonly` ein „restricted scope“ ist. Im Modus „Testing“ laufen die Refresh-Tokens nach 7 Tagen ab. Für den Produktionsmodus bräuchte es eine Google-Verifizierung oder man müsste mit der Warnung „nicht verifizierte App“ leben. Außerdem hätte das Token Lesezugriff auf das gesamte Drive des Eigentümers.
- Alternative: Scope `drive.file`. Verworfen, weil er nur Dateien umfasst, die die App selbst erstellt oder die per Picker ausgewählt wurden. Neue PDFs im Ordner würden damit nicht automatisch sichtbar.

**Konfiguration:** `DRIVE_FOLDER_ID` und `GOOGLE_SERVICE_ACCOUNT_JSON` (Pfad zur Schlüsseldatei; im Container als Secret eingebunden). Fehlen beide, läuft die App ohne Drive und legt wie bisher die Beispielrezepte an. Ist nur einer der beiden Werte gesetzt, bricht der Start mit einer Fehlermeldung ab.

**Vollständige Synchronisierung statt Changes-API:** Bei jedem Lauf werden rekursiv alle Unterordner gelistet und darin alle Dateien mit `mimeType = 'application/pdf' and trashed = false` (Felder: `id, name, modifiedTime, md5Checksum, thumbnailLink`). Bei einer Familiensammlung mit wenigen hundert PDFs sind das nur eine Handvoll API-Aufrufe. Die Changes-API mit Page-Token wäre effizienter, bringt aber Zustand und Randfälle mit sich (etwa Dateien, die in den Ordner hinein- oder aus ihm herausbewegt werden). Das lohnt sich erst bei deutlich mehr Dateien.

Abgleich in einer Transaktion: `drive_files(file_id PK, recipe_id, name, modified_time, md5)`. Neue Datei → neues Rezept. Bekannte Datei mit anderem Namen → Titel aktualisieren. Bekannte Datei, die fehlt → `available = 0`. Wieder aufgetauchte Datei → `available = 1`. Nur wenn das Listing vollständig erfolgreich war, wird überhaupt etwas geändert. Ein Fehler unterwegs verwirft den Lauf, sodass ein unvollständiges Listing nie als „alles gelöscht“ gewertet wird.

**Planer im Prozess:** Eine Goroutine mit `time.Ticker` (Standard 30 Minuten, `DRIVE_SYNC_INTERVAL`) plus `POST /api/sync/drive`. Ein Mutex sorgt dafür, dass nur ein Lauf gleichzeitig aktiv ist. Eine zweite Anforderung wartet auf den laufenden Lauf und erhält dessen Ergebnis. Der Status wird in der Tabelle `sync_runs` gespeichert, damit er einen Neustart übersteht.

**PDF-Proxy:** `GET /api/recipes/{id}/pdf` streamt `files.get?alt=media` direkt durch (`io.Copy`), mit `Content-Disposition: inline; filename="<Titel>.pdf"` und `Cache-Control: private, max-age=300`. Heruntergeladene PDFs werden nicht auf dem Server gespeichert.

**Vorschaubilder:** Die `thumbnailLink`s von Drive sind kurzlebig und brauchen Authentifizierung. Der Proxy lädt das Bild beim ersten Abruf mit dem Dienstkonto und legt es in einem kleinen Datei-Cache (`/data/thumbnails/<fileId>-<md5>.jpg`) ab. Ändert sich `md5Checksum`, wird es neu erzeugt.

**Beispielrezepte:** Ist Drive konfiguriert, entfällt der Seed. Beim ersten erfolgreichen Drive-Sync werden Beispielrezepte (`origin = 'seed'`) samt ihren Plan-Einträgen gelöscht. Das sind ausschließlich Testdaten.

## Risks / Trade-offs

- [Der Schlüssel des Dienstkontos ist ein langlebiges Geheimnis] → Er wird nur als Secret-Datei eingebunden, nie ins Repository eingecheckt und nie protokolliert. Das Dienstkonto hat keine weiteren Rollen im Google-Cloud-Projekt. Rotation per neuem Schlüssel und Neustart.
- [Die Freigabe des Ordners wird versehentlich entfernt] → Die Synchronisierung schlägt fehl, ohne Rezepte anzufassen, und der Status zeigt einen klaren Hinweis („Ordner nicht erreichbar – ist er für <service-account-email> freigegeben?“).
- [Doppelte Dateinamen in verschiedenen Unterordnern] → Beide werden als Rezepte übernommen und haben denselben Titel. Akzeptiert; die Detailansicht zeigt den Ordnerpfad zur Unterscheidung.
- [Kontingente der Drive-API] → Weit unterhalb der Grenzen. Bei 429/5xx wird mit exponentiellem Backoff höchstens dreimal wiederholt.

## Migration Plan

Neue Migration: `recipes.available` (Standard 1), `recipes.drive_path`, Tabellen `drive_files` und `sync_runs`. Deploy-Schritte: Dienstkonto anlegen, Ordner freigeben, Secret und `DRIVE_FOLDER_ID` setzen, deployen, im Frontend „Jetzt synchronisieren“ wählen. Rollback: Variablen entfernen und das vorherige Binary deployen; Drive-Rezepte bleiben in der Datenbank erhalten.
