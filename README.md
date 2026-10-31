# Teamflow

## Meeting-Dashboard und Erinnerungen

Übersicht und Agenda enthalten einen interaktiven Wochenkalender mit Tagesfilter, Terminuhrzeiten, Teilnehmenden, Live-/Vergangenheitsstatus und Kalenderexport. Termine werden in Europe/Berlin angezeigt. Der ICS-Export enthält eine Kalendererinnerung 15 Minuten vor dem Termin; sie wird nach Import von der jeweiligen Kalender-App verwaltet.

Der Bereich „Benachrichtigungen“ zeigt den Einrichtungsstand für E-Mail (Resend) und WhatsApp (Twilio). Es sind noch keine Versandkonten verbunden, kein Hintergrundjob aktiv und keine automatischen Nachrichten eingerichtet. Gewünschte Erinnerungszeiten werden ausschließlich lokal auf dem jeweiligen Gerät gespeichert. Sie aktivieren keinen Versand und verändern keine Kalenderdatei.

Für die spätere Aktivierung: verifizierten E-Mail-Absender, WhatsApp-Business-Absender und genehmigte Nachrichtenvorlage einrichten; serverseitige Zugangsdaten und einen geplanten Versandjob ergänzen; Empfänger durch eigenen Bestätigungsprozess anmelden lassen. Empfängeradressen, Handynummern und API-Schlüssel dürfen nicht im öffentlichen Workspace gespeichert werden. Die öffentliche Schreibschnittstelle darf keinen frei adressierbaren Nachrichtenversand auslösen. Eine geschützte Empfängerverwaltung und Abmeldung sind vor Aktivierung erforderlich.

Deutschsprachiges Team-Dashboard mit Agenda, Aufgaben, Statistik und eingebetteten Jitsi-Meetings. Die Website läuft auf GitHub Pages. Meetings und Aufgaben liegen gemeinsam in Supabase (Frankfurt).

## Nutzung

Öffne https://vieto1.github.io/teamflow/ auf einem beliebigen Gerät. Es gibt keine Anmeldung und keinen Teamlink. Jeder mit der Website-Adresse kann den gemeinsamen Workspace lesen und bearbeiten. „Team einladen“ kopiert die normale Website-Adresse.

Der Datenstand wird beim Öffnen, beim Zurückkehren zum Tab, nach Wiederherstellung der Verbindung und in sichtbaren Tabs alle zehn Sekunden geladen. Änderungen erscheinen sofort lokal und werden automatisch gespeichert. Offline-Änderungen bleiben als Warteschlange im Browser. Die Oberfläche zeigt ausstehende Änderungen und Verbindungsfehler ausdrücklich an.

Gleichzeitige Änderungen verschiedener Felder werden zusammengeführt. Widersprüchliche Änderungen desselben Felds und veraltete Löschungen werden abgewiesen. Bei einem Konflikt können lokale Änderungen heruntergeladen und anschließend der aktuelle Teamstand geladen werden. Die verworfene Warteschlange bleibt zusätzlich unter `teamflow-conflict-backup` im Browser gesichert.

Frühere Browserdaten bleiben unter den ursprünglichen Schlüsseln erhalten. Eine Meldung bietet an, sie zusätzlich in den Teamstand zu importieren. Vorhandene Teameinträge mit derselben ID werden dabei nicht überschrieben.

## Lokal starten

Node.js 20 oder neuer:

```bash
npm ci
npm run dev
```

Öffne http://localhost:3000. Der gemeinsame Workspace lädt direkt. Das Frontend benötigt keine Service-Role-Schlüssel. Die konfigurierte Edge Function akzeptiert den GitHub-Ursprung und lokale Entwicklung auf Port 3000.

## Backend

- `src/lib/team-sync-core.ts`: gemeinsame Vergleichs-, Validierungs- und Konfliktlogik.
- `src/lib/use-team-sync.ts`: gemeinsamer Clientzustand, Aktualisierung, Warteschlange und Offline-Sicherung.
- `supabase/functions/teamflow-sync/`: Öffentliche Edge Function für den gemeinsamen Workspace. Service-Role-Schlüssel bleiben ausschließlich in der Edge-Laufzeit.
- `supabase/schema.sql`: Schema-Snapshot ohne Zugangsgeheimnisse oder Nutzerdaten.

Direkter Datenbankzugriff für `anon` und `authenticated` ist gesperrt. Beide Tabellen haben aktiviertes RLS und explizite Ablehnungsregeln. Die öffentliche Edge Function validiert Änderungen und schreibt ausschließlich den Teamflow-Workspace mit atomarem Compare-and-Swap über die Revisionsnummer. Die frühere Teamlink-Prüfung ist bewusst entfernt; die bestehende Key-Tabelle wird nicht mehr verwendet.

## KI und Video

Jitsi wird erst beim Öffnen eines Videoanrufs geladen. Die startende Person kann eine Anmeldung beim öffentlichen Dienst benötigen. Für anonyme Hosts ist ein anderer Anbieter bzw. eigener Videoserver erforderlich.

Die OpenAI-Route unter `src/app/api/analyze/route.ts` ist nur für einen Next.js-Serverbetrieb vorgesehen und benötigt `OPENAI_API_KEY`. Der GitHub-Pages-Workflow entfernt die Serverroute aus dem statischen Build. Die Audioanalyse ist auf GitHub Pages daher weiterhin nicht aktiv.

## Veröffentlichung

Änderungen auf `main` lösen den Workflow `.github/workflows/pages.yml` aus. Er erstellt den statischen Export unter `/teamflow` und veröffentlicht ihn auf GitHub Pages. Backend-Änderungen müssen zusätzlich als neue Version der Supabase Edge Function veröffentlicht werden.

