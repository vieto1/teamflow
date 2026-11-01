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
