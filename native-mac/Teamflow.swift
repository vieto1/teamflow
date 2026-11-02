import Cocoa
import WebKit
import ScreenCaptureKit
import AVFoundation
import CoreMedia

let dashboard = URL(string: "https://vieto1.github.io/teamflow/")!
let support = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Teamflow-KI")
let companion = (Bundle.main.resourceURL ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications")).appendingPathComponent("Teamflow-KI")
func failure(_ text: String) -> NSError { NSError(domain: "Teamflow", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }

// Only audio outputs are registered. No screen frames are written to disk.
final class AudioRecorder: NSObject, SCStreamOutput, SCStreamDelegate {
    private let queue = DispatchQueue(label: "de.teamflow.audio")
    private var stream: SCStream?
    private var writer: AVAssetWriter?
    private var inputs: [SCStreamOutputType: AVAssetWriterInput] = [:]
    private var muted = true
    private var dropped = 0
    private var writeError: String?
    private var received: Set<SCStreamOutputType> = []
    var onFailure: ((String) -> Void)?
    var output: URL!
    func setMuted(_ value: Bool) { queue.async { self.muted = value } }
    @MainActor func start() async throws {
        guard await AVCaptureDevice.requestAccess(for: .audio) else { throw failure("Bitte Mikrofonzugriff für Teamflow in den macOS-Systemeinstellungen erlauben.") }
        guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else { throw failure("Bitte Bildschirm- und Systemaudioaufnahme für Teamflow erlauben und die App danach neu öffnen.") }
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        guard let display = content.displays.first,
              let app = content.applications.first(where: { $0.processID == ProcessInfo.processInfo.processIdentifier }) else { throw failure("Die Teamflow-App konnte als Audioquelle nicht gefunden werden. Bitte das Hauptfenster öffnen.") }
        let folder = support.appendingPathComponent("native-recordings/" + UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        output = folder.appendingPathComponent("original.mov")
        let newWriter = try AVAssetWriter(outputURL: output, fileType: .mov)
        for kind in [SCStreamOutputType.audio, .microphone] {
            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: kind == .audio ? 2 : 1, AVEncoderBitRateKey: 96000])
            input.expectsMediaDataInRealTime = true
            guard newWriter.canAdd(input) else { throw failure("Audioformat wird nicht unterstützt.") }
            newWriter.add(input); inputs[kind] = input
        }
        writer = newWriter
        let config = SCStreamConfiguration()
        config.width = 2; config.height = 2; config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.capturesAudio = true; config.excludesCurrentProcessAudio = false
        config.captureMicrophone = true; config.sampleRate = 48000; config.channelCount = 2
        config.microphoneCaptureDeviceID = AVCaptureDevice.default(for: .audio)?.uniqueID
        let filter = SCContentFilter(display: display, including: [app], exceptingWindows: [])
        let capture = SCStream(filter: filter, configuration: config, delegate: self)
        try capture.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
        try capture.addStreamOutput(self, type: .microphone, sampleHandlerQueue: queue)
        stream = capture
        try await capture.startCapture()
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of kind: SCStreamOutputType) {
        guard CMSampleBufferDataIsReady(sample), let input = inputs[kind], let writer = writer, writeError == nil else { return }
        let pts = CMSampleBufferGetPresentationTimeStamp(sample)
        guard pts.isValid, pts.isNumeric else { return }
        if writer.status == .unknown {
            guard writer.startWriting() else { writeError = writer.error?.localizedDescription ?? "Audiodatei konnte nicht geöffnet werden."; return }
            writer.startSession(atSourceTime: pts)
        }
        guard writer.status == .writing else { writeError = writer.error?.localizedDescription ?? "Audiodatei konnte nicht geschrieben werden."; return }
        if kind == .microphone && muted {
            guard let block = CMSampleBufferGetDataBuffer(sample),
                  CMBlockBufferFillDataBytes(with: 0, blockBuffer: block, offsetIntoDestination: 0, dataLength: CMBlockBufferGetDataLength(block)) == noErr else {
                writeError = "Mikrofon-Stummschaltung konnte nicht angewendet werden."; return
            }
        }
        guard input.isReadyForMoreMediaData else { dropped += 1; return }
        if input.append(sample) { received.insert(kind) } else { writeError = writer.error?.localizedDescription ?? "Audio-Schreibfehler." }
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) { onFailure?(error.localizedDescription) }
    @MainActor func stop() async throws -> (URL, Int) {
        if let stream { try await stream.stopCapture() }; stream = nil
        return try await withCheckedThrowingContinuation { continuation in
            queue.async {
                guard let writer = self.writer, writer.status == .writing else { continuation.resume(throwing: failure(self.writeError ?? "Keine Audiodaten empfangen.")); return }
                if let message = self.writeError { writer.cancelWriting(); continuation.resume(throwing: failure(message)); return }
                // Require the app-audio track, otherwise distant voices could be missing.
                guard self.received.contains(.audio), self.received.contains(.microphone) else { writer.cancelWriting(); continuation.resume(throwing: failure("Gesprächston oder Mikrofonspur fehlt. Bitte macOS-Audiofreigaben prüfen.")); return }
                self.inputs.values.forEach { $0.markAsFinished() }
                writer.finishWriting {
                    if writer.status == .completed { continuation.resume(returning: (self.output, self.dropped)) }
                    else { continuation.resume(throwing: writer.error ?? failure("Aufnahme konnte nicht abgeschlossen werden.")) }
                }
            }
        }
    }
}

@MainActor final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!; var web: WKWebView!; var item: NSStatusItem!
    var popups: [NSWindow] = []
    var audio: AudioRecorder?; var ownedServer: Process?; var ollama: Process?
    var pendingResult: [String:Any]?
    var captureStartedAt = 0.0
    var cancelRequested = false
    var busy = false; var recording = false; var meeting: [String: Any] = [:]
    var csrf = ""; var safetyTimer: Timer?; var activity: NSObjectProtocol?
    let session: URLSession = { let c = URLSessionConfiguration.default; c.timeoutIntervalForRequest = 30; return URLSession(configuration: c) }()
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let mainMenu = NSMenu()
        let appMenu = NSMenu(); let appMenuItem = NSMenuItem(); appMenuItem.submenu = appMenu; mainMenu.addItem(appMenuItem)
        appMenu.addItem(withTitle: "Teamflow beenden", action: #selector(quit), keyEquivalent: "q").target = self
        let edit = NSMenu(title: "Bearbeiten"); let editItem = NSMenuItem(title: "Bearbeiten", action: nil, keyEquivalent: ""); editItem.submenu = edit; mainMenu.addItem(editItem)
        for (title, selector, key) in [("Widerrufen", "undo:", "z"), ("Ausschneiden", "cut:", "x"), ("Kopieren", "copy:", "c"), ("Einsetzen", "paste:", "v"), ("Alles auswählen", "selectAll:", "a")] { edit.addItem(withTitle: title, action: NSSelectorFromString(selector), keyEquivalent: key) }
        NSApp.mainMenu = mainMenu
        let menu = NSMenu()
        menu.addItem(withTitle: "Teamflow öffnen", action: #selector(show), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "Aufnahme stoppen", action: #selector(stopFromMenu), keyEquivalent: "s").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Beenden", action: #selector(quit), keyEquivalent: "q").target = self
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength); item.button?.title = "TF"; item.menu = menu
        let config = WKWebViewConfiguration(); config.websiteDataStore = .default(); config.preferences.javaScriptCanOpenWindowsAutomatically = true
        let injection = "if(location.origin==='https://vieto1.github.io'&&location.pathname.startsWith('/teamflow/')){window.__TEAMFLOW_NATIVE__={version:'1.3.0'};}"
        config.userContentController.addUserScript(WKUserScript(source: injection, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(self, name: "teamflowRecorder")
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self; web.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 850), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "Teamflow"; window.contentView = web; window.delegate = self; window.center(); web.load(URLRequest(url: dashboard))
        if !CommandLine.arguments.contains("--background") { show() }
    }
    @objc func show() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    @objc func stopFromMenu() { Task { await stop() } }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if busy { let alert = NSAlert(); alert.messageText = "Aufnahme oder Auswertung läuft noch."; alert.informativeText = "Bitte zuerst die Aufnahme stoppen und die Verarbeitung abwarten. Das Fenster darf minimiert werden."; alert.runModal(); return .terminateCancel }
        ownedServer?.terminate(); ollama?.terminate(); return .terminateNow
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { if recording { Task { await stop() } } else if busy { cancelRequested = true }; return true }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if webView === web && navigationAction.targetFrame?.isMainFrame == true, let url = navigationAction.request.url,
           !(url.scheme == "https" && url.host == "vieto1.github.io" && url.path.hasPrefix("/teamflow/")) {
            NSWorkspace.shared.open(url); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let popup = WKWebView(frame: .zero, configuration: configuration); popup.uiDelegate = self
        let child = NSWindow(contentRect: NSRect(x:0,y:0,width:700,height:750),styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false)
        child.contentView = popup; child.title = "Teamflow · Anmeldung"; child.center(); child.makeKeyAndOrderFront(nil); popups.append(child); return popup
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { if webView === web { if recording { Task { await stop() } } else if busy { cancelRequested = true } } }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { if webView === web { if recording { Task { await stop() } } else if busy { cancelRequested = true } } }
    func webViewDidClose(_ webView: WKWebView) { popups.filter { $0.contentView === webView }.forEach { $0.close() } }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.prompt) }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              url.scheme == "https", url.host == "vieto1.github.io", url.path.hasPrefix("/teamflow/"),
              let body = message.body as? [String: Any], let command = body["command"] as? String else { return }
        switch command {
        case "start":
            guard !busy, let data = body["meeting"] as? [String:Any], let title = data["title"] as? String, !title.isEmpty, title.count <= 200,
                  let date = data["date"] as? String, date.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options:.regularExpression) != nil else { emit(["type":"error","error":"Meetingdaten fehlen oder eine Verarbeitung läuft bereits."]); return }
            meeting = data; Task { await start() }
        case "stop": Task { await stop() }
        case "mute": if let muted = body["muted"] as? Bool { audio?.setMuted(muted) }
        case "heartbeat": break
        case "status": if let result = pendingResult { emit(["type":"result","result":result]) } else { emit(["type":"available","recording":recording,"busy":busy,"startedAt":captureStartedAt]) }
        default: break
        }
    }
    func emit(_ data: [String: Any]) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: data), let json = String(data: bytes,encoding:.utf8) else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('teamflow:native',{detail:\(json)}));", completionHandler:nil)
    }
    func path(_ name: String) throws -> String {
        for prefix in ["/opt/homebrew/bin/","/usr/local/bin/","/opt/homebrew/opt/python@3.12/bin/","/usr/local/opt/python@3.12/bin/"] { let p = prefix+name; if FileManager.default.isExecutableFile(atPath:p) { return p } }
        throw failure("\(name) fehlt. Bitte zuerst die vorhandene Teamflow-KI-Einrichtung abschließen.")
    }
    func spawn(_ binary: String, _ args: [String]) throws -> Process {
        let p = Process(); p.executableURL = URL(fileURLWithPath: binary); p.arguments = args; p.currentDirectoryURL = companion
        var env = ProcessInfo.processInfo.environment; env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"; env["OLLAMA_HOST"] = "127.0.0.1:11434"; env["OLLAMA_NO_CLOUD"] = "1"; p.environment = env
        try FileManager.default.createDirectory(at: support,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
        let log = support.appendingPathComponent("desktop.log"); if !FileManager.default.fileExists(atPath:log.path) { FileManager.default.createFile(atPath:log.path,contents:nil,attributes:[.posixPermissions:0o600]) }
        let handle = try FileHandle(forWritingTo:log); try handle.seekToEnd(); p.standardOutput = handle; p.standardError = handle; try p.run(); return p
    }
    func ensureServer() async throws {
        guard FileManager.default.fileExists(atPath:support.appendingPathComponent("config.json").path) else { throw failure("Bitte zuerst Einrichten.command aus dem Teamflow-KI-Paket ausführen. Modelle werden weiterverwendet.") }
        if (try? await session.data(from:URL(string:"http://127.0.0.1:11434/api/tags")!)) == nil { ollama = try spawn(try path("ollama"),["serve"]) }
        var page: (Data,URLResponse)?
        do { page = try await session.data(from:URL(string:"http://127.0.0.1:8765/")!) } catch {
            ownedServer = try spawn(try path("python3.12"),[companion.appendingPathComponent("server.py").path])
            for _ in 0..<40 { try await Task.sleep(nanoseconds:250_000_000); if let response = try? await session.data(from:URL(string:"http://127.0.0.1:8765/")!) { page = response; break } }
        }
        guard let (data,response) = page, let http = response as? HTTPURLResponse, http.statusCode == 200, http.value(forHTTPHeaderField:"X-Teamflow-Version") == "1.2.0",
              let html = String(data:data,encoding:.utf8), let range = html.range(of:"name=\"csrf\" content=\""), let end = html[range.upperBound...].firstIndex(of:"\"") else { throw failure("Lokaler Teamflow-Dienst ist nicht erreichbar oder veraltet. Bitte das alte KI-Terminal einmal beenden (Ctrl+C), danach Aufnahme erneut starten. Port 8765 muss frei sein.") }
        csrf = String(html[range.upperBound..<end])
    }
    func endActivity() { if let activity { ProcessInfo.processInfo.endActivity(activity) }; activity = nil }
    func start() async {
        cancelRequested = false; pendingResult = nil; busy = true; activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .idleSystemSleepDisabled], reason: "Teamflow-Aufnahme und lokale Transkription"); emit(["type":"progress","stage":"Mac-Aufnahme wird vorbereitet …"])
        do {
            try await ensureServer()
            if cancelRequested { throw failure("Aufnahmestart wurde abgebrochen.") }
            let capture = AudioRecorder(); audio = capture; capture.setMuted(true)
            capture.onFailure = { [weak self] message in Task { @MainActor in self?.emit(["type":"warning","stage":"Audio-Unterbrechung: "+message]); await self?.stop() } }
            try await capture.start(); if cancelRequested { _ = try? await capture.stop(); audio = nil; busy = false; endActivity(); emit(["type":"error","error":"Aufnahmestart wurde abgebrochen."]); return }; recording = true; item.button?.title = "● REC"
            captureStartedAt = Date().timeIntervalSince1970*1000; emit(["type":"started","startedAt":captureStartedAt])
            safetyTimer = Timer.scheduledTimer(withTimeInterval:21600,repeats:false) { [weak self] _ in Task { @MainActor in await self?.stop() } }
        } catch { audio = nil; busy = false; endActivity(); emit(["type":"error","error":error.localizedDescription]) }
    }
    func stop() async {
        guard recording, let capture = audio else { if busy { cancelRequested = true }; return }; recording = false; safetyTimer?.invalidate(); item.button?.title = "TF · KI"
        emit(["type":"processing","stage":"Aufnahme wird gespeichert und lokal transkribiert …"])
        do {
            let (source,dropped) = try await capture.stop(); audio = nil
            // Mix both real audio tracks, preserving timestamp gaps. No video stream exists.
            let mixed = source.deletingLastPathComponent().appendingPathComponent("meeting.m4a")
            let ffmpeg = try path("ffmpeg")
            let args = ["-nostdin","-v","error","-y","-i",source.path,"-filter_complex","[0:a:0]aresample=async=1:first_pts=0[a];[0:a:1]aresample=async=1:first_pts=0[b];[a][b]amix=inputs=2:duration=longest:normalize=1[out]","-map","[out]","-c:a","aac","-b:a","128k",mixed.path]
            let process = try spawn(ffmpeg,args)
            while process.isRunning { try await Task.sleep(nanoseconds:300_000_000) }
            guard process.terminationStatus == 0 else { throw failure("Audio konnte nicht zusammengeführt werden. Original bleibt lokal in native-recordings erhalten.") }
            try await ensureServer()
            var components = URLComponents(string:"http://127.0.0.1:8765/api/jobs/audio")!
            components.queryItems = [URLQueryItem(name:"title",value:meeting["title"] as? String),URLQueryItem(name:"date",value:meeting["date"] as? String),URLQueryItem(name:"name",value:"meeting.m4a"),URLQueryItem(name:"consent",value:"1")]
            var request = URLRequest(url:components.url!); request.httpMethod = "POST"; request.setValue(csrf,forHTTPHeaderField:"X-Teamflow-CSRF"); request.setValue("application/octet-stream",forHTTPHeaderField:"Content-Type"); request.timeoutInterval = 120
            let (data,response) = try await session.upload(for:request,fromFile:mixed)
            let json = try JSONSerialization.jsonObject(with:data) as? [String:Any]
            guard (response as? HTTPURLResponse)?.statusCode == 201, let id = json?["id"] as? String else { throw failure(json?["error"] as? String ?? "Übergabe an die lokale KI fehlgeschlagen.") }
            while true {
                try await Task.sleep(nanoseconds:2_000_000_000)
                let (rows,_) = try await session.data(from:URL(string:"http://127.0.0.1:8765/api/jobs")!)
                let list = try JSONSerialization.jsonObject(with:rows) as? [[String:Any]]
                guard let job = list?.first(where: { $0["id"] as? String == id }) else { throw failure("Lokales Protokoll nicht mehr gefunden.") }
                emit(["type":"progress","stage":job["stage"] as? String ?? "KI arbeitet …"])
                if job["status"] as? String == "failed" { throw failure(job["error"] as? String ?? "KI-Auswertung fehlgeschlagen.") }
                if job["status"] as? String == "done" {
                    let (result,_) = try await session.data(from:URL(string:"http://127.0.0.1:8765/api/jobs/\(id)/result")!)
                    var protocolData = try JSONSerialization.jsonObject(with:result) as! [String:Any]
                    protocolData["sourceMeetingId"] = meeting["id"] as? String ?? ""
                    if dropped > 0 { var warnings = protocolData["warnings"] as? [String] ?? []; warnings.append("Die Aufnahme hatte \(dropped) Audio-Pufferaussetzer. Bitte das Original prüfen."); protocolData["warnings"] = warnings }
                    pendingResult = protocolData; emit(["type":"result","result":protocolData]); break
                }
            }
        } catch { audio = nil; emit(["type":"error","error":error.localizedDescription+" Aufnahmen und vorhandene Ergebnisse bleiben auf dem Mac gespeichert."]) }
        busy = false; endActivity(); item.button?.title = "TF"
    }
}
@main struct Main {
    @MainActor static func main() {
        if CommandLine.arguments.contains("--self-test") { print("Teamflow native helper 1.3.0 · macOS 15+ · audio only"); return }
        let app = NSApplication.shared; let delegate = App(); app.delegate = delegate; app.run()
    }
}
