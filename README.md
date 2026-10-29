# Teamflow – Meeting- und Aufgaben-Dashboard

Ein schlanker, deutschsprachiger Prototyp für Agenda, Meeting-Archiv und teamweite Aufgaben. Meetings und Aufgaben werden lokal im Browser gespeichert. Audio wird auf dem Server transkribiert und anschließend mit KI zusammengefasst; erkannte Aufgaben werden mit Verantwortlichen in die Liste übernommen.

## Voraussetzungen

- Node.js 20 oder neuer
- Ein OpenAI API-Schlüssel für die Audioanalyse (optional; alle übrigen Funktionen laufen ohne Schlüssel)

## Lokal starten

```bash
cd team-standup
npm install
cp .env.example .env.local
```

Trage in `.env.local` deinen Schlüssel ein:

```env
OPENAI_API_KEY=sk-...
```

Danach:

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

Ohne API-Schlüssel kannst du Meetings und Aufgaben weiter nutzen; die Audioanalyse zeigt dann einen Hinweis. Audioformate wie MP3, M4A und WAV bis 24 MB werden akzeptiert. Die KI-Pipeline nutzt OpenAI `whisper-1` für die Transkription und `gpt-4o-mini` für Zusammenfassung, Entscheidungen und Aufgabenextraktion. Kontrolliere automatisch erkannte Namen, Zuständigkeiten und Fristen vor der Weitergabe.

## Funktionen

- Kommende und vergangene Meetings mit Teilnehmenden
- Meeting planen und Detailansicht öffnen
- Aufgaben nach Teammitglied sortieren, suchen und Status ändern
- Audiodatei zu einem Meeting hochladen, Transkript, Zusammenfassung, Kernpunkte und Entscheidungen erzeugen
- Aufgaben aus der KI-Analyse übernehmen und im Browser lokal speichern

## Daten und Datenschutz

Meeting- und Aufgabendaten liegen im `localStorage` des jeweiligen Browsers. Der Browser überträgt Audiodateien an den eigenen Next.js-Server; dieser sendet sie zur Transkription und Analyse an OpenAI. Der API-Schlüssel bleibt serverseitig in `.env.local` und wird nicht in den Client eingebunden. Dieser erste Prototyp hat keine Anmeldung, zentrale Team-Synchronisierung, Lösch-/Aufbewahrungsregeln oder Rollenverwaltung; vor gemeinsamem produktiven Einsatz diese Punkte ergänzen und die Datenschutzanforderungen des Teams prüfen.
