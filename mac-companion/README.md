# Teamflow KI auf dem Mac

## Einrichtung
1. ZIP entpacken. `Einrichten.command` öffnen. macOS-Sicherheitseinstellungen nur für diese bewusst heruntergeladene Datei prüfen; Schutzfunktionen nicht global abschalten.
2. Fehlt Homebrew, zuerst über https://brew.sh installieren und die Einrichtung erneut starten.
3. Das Skript installiert Python, FFmpeg, whisper.cpp, Ollama und Poppler. Es lädt mehrsprachige Whisper-Modelle und Qwen2.5. Mindestens 10 GB freier Speicher und eine Internetverbindung für die Einrichtung werden benötigt. Ab 16 GB RAM werden größere Modelle gewählt. Ein aktuelles macOS mit Homebrew-Unterstützung wird vorausgesetzt; ältere Intel-Macs können zusätzliche Einrichtung benötigen.
4. Danach öffnet sich http://127.0.0.1:8765/. Für spätere Starts `~/Applications/Teamflow-KI/Starten.command` öffnen. Das Terminal während der Verarbeitung geöffnet lassen und den Mac nicht in den Ruhezustand versetzen.

## Nutzung
Aufnahme hochladen, Transkript einfügen oder nach Zustimmung aller Beteiligten aufnehmen. Bei Videomeetings den Browser-Tab mit **Tab-Audio** und zusätzlich das Mikrofon freigeben. Die reine Mikrofonaufnahme erfasst entfernte Teilnehmer nicht zuverlässig. Unterstützt der Browser keine Tab-Audio-Freigabe, eine vollständige externe Aufnahme hochladen. Vor langen Meetings eine kurze Testaufnahme mit allen Stimmen prüfen.

Die KI erstellt Zusammenfassung, Punkte, Beschlüsse, belegte Aufgaben- und Änderungsvorschläge. Aufgaben annehmen, bearbeiten oder ablehnen. Namen werden nur aus ausdrücklichen Aussagen abgeleitet; keine automatische Sprecheridentifikation oder Anmeldung. Relative Fristen werden nicht automatisch als Datum gesetzt. Alle Zahlen, Zuständigkeiten und Beschlüsse kontrollieren.

Optional TXT, Markdown, DOCX oder textbasierte PDF hinzufügen. Dokumentänderungen einzeln freigeben; der Export erzeugt **neue TXT-Kopien**. Originale und deren Layout bleiben unverändert. Keine automatische Word-/PDF-Layoutbearbeitung, kein OCR für gescannte PDFs. Maximal fünf Dokumente, je 10 MB und 30.000 Textzeichen. Aufnahme maximal 512 MB und sechs Stunden; lange Meetings besser aufteilen. Echtzeittranskription ist nicht enthalten.

Nach Prüfung JSON exportieren. In https://vieto1.github.io/teamflow/ unter **KI-Protokoll** importieren, Aufgaben prüfen und ausdrücklich freigeben. Erst dann werden ausgewählte Inhalte gemeinsam gespeichert. Das vollständige Transkript wird standardmäßig nicht geteilt. Der JSON-Export selbst enthält das Transkript und bleibt zunächst eine lokale Datei. Teamflows bestehender Workspace ist ohne Anmeldung öffentlich zugänglich: Veröffentlichte Inhalte sind für jeden Besucher lesbar. Die Personenauswahl ist keine Identitätsprüfung.

## Lokal und Kosten
Spracherkennung mit whisper.cpp, Auswertung mit Ollama/Qwen2.5 laufen auf dem Mac. Kein API-Schlüssel und keine laufenden KI-API-Gebühren. Hardware, Strom und Einrichtung bleiben eigene Aufwände. Modelle und Werkzeuge werden einmal aus dem Internet geladen. Der Dienst bindet ausschließlich an die lokale Loopback-Adresse; keine automatische Audio-/Dokumentübertragung an Teamflow. Auf einem iPhone verweist localhost auf das iPhone, nicht auf den Mac. Dort nur die geteilten Ergebnisse in Teamflow verwenden.

## Daten und Updates
Private lokale Daten: `~/Library/Application Support/Teamflow-KI/`. Anwendung: `~/Applications/Teamflow-KI/`. Jobs lassen sich in der lokalen Oberfläche entfernen. Kontextdokumente bleiben im Datenordner, bis dieser bewusst aufgeräumt wird. Zum vollständigen Entfernen zuerst den Dienst beenden und beide Ordner löschen; heruntergeladene Ollama-Modelle werden separat von Ollama verwaltet.

Für Updates die neue ZIP herunterladen, entpacken und `Einrichten.command` erneut ausführen. Bestehende lokale Daten liegen außerhalb des Anwendungsordners. Vorher sichern. Ein laufender Dienst muss vor dem Update beendet werden.

## Prüfstand
Python-Tests prüfen Quellenvalidierung, Fristen, Export, unveränderte Originaldokumente und lokale HTTP-Zugriffssperren. Build und Syntax werden geprüft. Die Modellverarbeitung wurde in der Entwicklungsumgebung mit simulierten KI-Antworten geprüft. Ein echter macOS-Installationslauf und echte Whisper-/Ollama-Inferenz müssen auf dem Zielgerät getestet werden; Qualität und Geschwindigkeit hängen vom Mac, Modell und Ton ab.

## Fehlerbehebung Version 1.0.1

Browseraufnahmen ohne Dauerangabe (N/A) werden nach einer zeitlich begrenzten Umwandlung anhand ihrer tatsächlichen PCM-Länge geprüft. Bei einer älteren Installation Dienst mit Ctrl+C beenden, das aktuelle Paket entpacken und Einrichten.command erneut ausführen. Lokale Daten und vorhandene Modelle bleiben erhalten. Anschließend beim fehlgeschlagenen Job Erneut auswerten wählen.

## Version 1.0.2: Prozess-Neustart

Für eine bestehende Installation Aktualisieren.command aus dem neu entpackten Download öffnen. Es prüft den Python-Dienst auf Port 8765 anhand von Arbeitsordner und Prozessbefehl, beendet nur den eindeutig identifizierten Teamflow-Dienst und kopiert die korrigierten Programmdateien. Modelle und private Daten werden nicht verändert. Laufende Analysen werden unterbrochen und können anschließend erneut gestartet werden. Fremde Dienste werden nicht beendet. Die Oberfläche und der HTTP-Header zeigen jetzt die aktive Version. Starten.command verwaltet den Python-Prozess direkt und verwendet alte Dienste nicht mehr stillschweigend weiter.

## Version 1.1.0: Transkript zuerst

Das Ergebnis zeigt drei getrennte Spalten: vollständiges Transkript, bearbeitbare Zusammenfassung und gefilterte Aufgabenvorschläge. Auf schmalen Bildschirmen stehen sie untereinander. Das Transkript kann als Fließtext oder in Zeitabschnitten gelesen und separat als TXT heruntergeladen werden. Zeitabschnitte sind keine erkannten Sprecherwechsel. Namen lassen sich manuell nach dem Anhören zuordnen; diese Beschriftungen bleiben in diesem Browser und fließen nur in den TXT-Export der Abschnittsansicht ein. Es gibt keine automatische Diarisierung oder verifizierte Sprecheridentität. Automatische Spracherkennung garantiert keine fehlerfreie wortgetreue Wiedergabe.

Das Originaltranskript wird vor der Zusammenfassung auf dem Mac gespeichert und bleibt auch bei einem anschließenden KI-Fehler abrufbar. Die ursprüngliche Aufnahme bleibt erhalten.

Auf Wunsch der bereits einverstandenen Gruppe ist die Gruppenfreigabe standardmäßig aktiv. Sie und die automatische Auswertung nach dem Aufnahmestopp sind unter Aufnahmeeinstellungen abschaltbar; Auswahl bleibt in diesem Browser gespeichert. Mikrofon-/Tab-Audio-Freigaben des Browsers bleiben erforderlich. Nach dem Start wird ausschließlich eine tatsächlich laufende lokale Aufnahme angezeigt. Nach dem Stopp startet die Verarbeitung automatisch, wenn die Einstellung aktiv ist.

Noch nicht enthalten: automatischer Mitschnitt beim Start eines eingebetteten Jitsi-Meetings, automatische Erkennung des letzten Teilnehmers, automatische Übertragung der Jitsi-Aufnahme an den Mac oder Freigabe des Mac-Dienstes für andere Geräte. Es besteht bisher keine Audioverbindung zwischen Jitsi-IFrame und lokalem Dienst. Hierfür ist eine gesonderte Recorder-Anbindung erforderlich. Eine Browser-Tab-Aufnahme kann die erneute Freigabe des Betriebssystems/Browsers nicht umgehen.

## Version 1.2.0: Aufnahmebutton im Teamflow-Meeting

Auf dem eingerichteten Mac Starten.command öffnen und Teamflow in Chrome oder Edge nutzen. Im eingebetteten Meeting „Aufnahme einrichten · Mac-KI öffnen“ wählen. Im lokalen Fenster einmal „Mit diesem Meeting verbinden“ anklicken. Zurück im Meeting „Aufnahme starten“ wählen, den Teamflow-Browser-Tab mit Tab-Audio sowie das Mikrofon freigeben. Nach erfolgreichem Start erscheint REC mit Laufzeit. Andere Teilnehmer erhalten den gemeldeten Aufnahmestatus über Jitsis Datenkanal; im externen Jitsi-Client gibt es zusätzlich eine Chatnachricht beim Start. Die Meldung eines anderen Teilnehmers ist kein technischer Beweis für eine erfolgreiche Aufnahme.

„Aufnahme stoppen“ oder Verlassen des Meetings auf dem Aufnahmegerät beendet den Mitschnitt. Die vollständige Aufnahme wird per postMessage an das explizit verbundene lokale Fenster übergeben und dort transkribiert und ausgewertet. Die fertigen Ergebnisse erscheinen automatisch im KI-Protokoll des öffnenden Teamflow-Fensters. Erst nach bewusster Freigabe werden Notizen/Transkript und angenommene Aufgaben im bestehenden öffentlichen Workspace gespeichert. Bereits geteilte Protokolle sind im KI-Protokoll-Bereich für alle abrufbar.

Beide Browserfenster und das Mac-Terminal offen lassen. Aufzeichnung erfolgt durch einen Mac; Handy- und Windows-Teilnehmer brauchen keine lokale KI. Safari und mobile Browser unterstützen den benötigten Tab-Ton nicht durchgängig. Die lokale Adresse auf anderen Geräten erreicht nicht den Mac. Ein Live-Gesprächston-Test mit allen Teilnehmern ist notwendig. Der Betriebssystem-/Browserdialog für Audiofreigabe bleibt erforderlich. Keine neue Zustimmungsabfrage zur bereits vereinbarten Gruppenfreigabe.

Diese Version stoppt, wenn der aufzeichnende Mac das Meeting verlässt. Sie überwacht keinen leeren Raum, nachdem das Aufnahmegerät bereits gegangen ist. Bei geschlossenem KI-Fenster wird die verfügbare Aufnahme als Sicherungsdatei heruntergeladen. Browserabsturz, Ruhezustand, Abbruch des Tabs oder Downloadsperren können Aufnahmen verlieren; längere Sitzungen vorher testen. Während des Aufnahmebetriebs den Teamflow-Tab nicht neu laden und keinen anderen Raum öffnen. Die Zeitgrenze wird weiter lokal geprüft.

Nach Neustart einer Seite können fertige Ergebnisse weiterhin über den lokalen JSON-Export importiert werden. Ein automatischer erneuter Ergebnisversand nach einem fehlgeschlagenen Job und manueller Wiederholung ist nicht implementiert. Browser-Bridge-Tests nutzen simulierte Nachrichten und Audio-Blobs; echte macOS-/Jitsi-Aufnahme und Browserberechtigungen müssen auf dem Zielgerät getestet werden.

Die separate Mikrofonspur übernimmt Jitsis Stummschaltung über audioMuteStatusChanged. Sie ist zunächst stumm, bis der Meetingstatus eine aktive Mikrofonfreigabe meldet. Im Testgespräch auch Stummschalten und erneutes Einschalten prüfen.
