# Teamflow

Deutschsprachiges Team-Dashboard mit Agenda, Aufgaben, Statistik und eingebetteten Jitsi-Meetings. Die Website läuft auf GitHub Pages. Meetings und Aufgaben liegen gemeinsam in Supabase (Frankfurt).

## Nutzung

Öffne einmal den privaten Team-Einladungslink auf jedem Gerät. Der Zugangsparameter steht im URL-Fragment, wird aus der Adressleiste entfernt und anschließend lokal gespeichert. Der normale GitHub-Link öffnet auf diesem Gerät danach denselben Workspace. Über „Team einladen“ kann ein berechtigtes Teammitglied den Link kopieren. Wer den Link besitzt, hat Lese- und Schreibzugriff; nur innerhalb des Teams teilen. Die Zugangsdaten sind nicht im Repository enthalten.

Der Datenstand wird beim Öffnen, beim Zurückkehren zum Tab, nach Wiederherstellung der Verbindung und in sichtbaren Tabs alle zehn Sekunden geladen. Änderungen erscheinen sofort lokal und werden automatisch gespeichert. Offline-Änderungen bleiben als Warteschlange im Browser. Die Oberfläche zeigt ausstehende Änderungen und Verbindungsfehler ausdrücklich an.

Gleichzeitige Änderungen verschiedener Felder werden zusammengeführt. Widersprüchliche Änderungen desselben Felds und veraltete Löschungen werden abgewiesen. Bei einem Konflikt können lokale Änderungen heruntergeladen und anschließend der aktuelle Teamstand geladen werden. Die verworfene Warteschlange bleibt zusätzlich unter `teamflow-conflict-backup` im Browser gesichert.

Frühere Browserdaten bleiben unter den ursprünglichen Schlüsseln erhalten. Eine Meldung bietet an, sie zusätzlich in den Teamstand zu importieren. Vorhandene Teameinträge mit derselben ID werden dabei nicht überschrieben.

## Lokal starten

Node.js 20 oder neuer:

```bash
npm ci
npm run dev
```

Öffne http://localhost:3000. Derselbe private Teamlink lässt sich in das Zugangsfeld einfügen. Das Frontend benötigt keine Service-Role-Schlüssel. Die konfigurierte Edge Function akzeptiert den GitHub-Ursprung und lokale Entwicklung auf Port 3000.

## Backend

- `src/lib/team-sync-core.ts`: gemeinsame Vergleichs-, Validierungs- und Konfliktlogik.
- `src/lib/use-team-sync.ts`: gemeinsamer Clientzustand, Aktualisierung, Warteschlange und Offline-Sicherung.
- `supabase/functions/teamflow-sync/`: Edge Function mit eigener Team-Key-Prüfung. Der Team-Key wird nur als SHA-256-Hash in der Datenbank gespeichert. Service-Role-Schlüssel bleiben ausschließlich in der Edge-Laufzeit.
- `supabase/schema.sql`: Schema-Snapshot ohne Zugangsgeheimnisse oder Nutzerdaten.

Direkter Datenbankzugriff für `anon` und `authenticated` ist gesperrt. Beide Tabellen haben aktiviertes RLS und explizite Ablehnungsregeln. Die Edge Function prüft den Team-Key und schreibt den Workspace mit atomarem Compare-and-Swap über die Revisionsnummer. Ein Team-Key kann durch Deaktivieren seines Eintrags in `teamflow_access_keys` widerrufen werden. Ein neuer Key darf nie in die öffentlichen Quellcodedateien eingetragen werden.

## KI und Video

Jitsi wird erst beim Öffnen eines Videoanrufs geladen. Die startende Person kann eine Anmeldung beim öffentlichen Dienst benötigen. Für anonyme Hosts ist ein anderer Anbieter bzw. eigener Videoserver erforderlich.

Die OpenAI-Route unter `src/app/api/analyze/route.ts` ist nur für einen Next.js-Serverbetrieb vorgesehen und benötigt `OPENAI_API_KEY`. Der GitHub-Pages-Workflow entfernt die Serverroute aus dem statischen Build. Die Audioanalyse ist auf GitHub Pages daher weiterhin nicht aktiv.

## Veröffentlichung

Änderungen auf `main` lösen den Workflow `.github/workflows/pages.yml` aus. Er erstellt den statischen Export unter `/teamflow` und veröffentlicht ihn auf GitHub Pages. Backend-Änderungen müssen zusätzlich als neue Version der Supabase Edge Function veröffentlicht werden.
