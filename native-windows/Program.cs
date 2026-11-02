using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Teamflow;

internal static class Program
{
    [STAThread] static int Main(string[] args)
    {
        if(args.Contains("--self-test"))return SelfTest.Run();
        using var singleton=new Mutex(true,"Local\\TeamflowDesktopWindows",out bool created);
        if(!created){MessageBox.Show("Teamflow läuft bereits. Bitte das TF-Symbol im Infobereich öffnen.");return 0;}
        ApplicationConfiguration.Initialize();Application.Run(new MainWindow(args.Contains("--background")));return 0;
    }
}
internal sealed class MainWindow : Form
{
    readonly WebView2 web=new(){Dock=DockStyle.Fill};
    readonly LocalRuntime runtime=new();
    readonly NotifyIcon tray=new(){Visible=true,Text="Teamflow"};
    readonly System.Windows.Forms.Timer safety=new(){Interval=21600000};
    readonly bool background;
    AudioRecorder? audio;
    JsonObject meeting=new(); JsonObject? pendingResult;
    bool busy,recording,cancelStart,settingUp;
    long startedAt;
    [DllImport("kernel32.dll")]static extern uint SetThreadExecutionState(uint flags);
    const string Dashboard="https://vieto1.github.io/teamflow/";
    public MainWindow(bool hidden)
    {
        background=hidden;Text="Teamflow";Width=1280;Height=850;MinimumSize=new(800,600);
        Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);tray.Icon=Icon;
        var menu=new ContextMenuStrip();
        menu.Items.Add("Teamflow öffnen",null,(_,_)=>{Show();WindowState=FormWindowState.Normal;Activate();});
        menu.Items.Add("Aufnahme stoppen",null,async(_,_)=>await StopRecording());
        menu.Items.Add("Beenden",null,(_,_)=>{Close();});tray.ContextMenuStrip=menu;
        tray.DoubleClick+=(_,_)=>{Show();WindowState=FormWindowState.Normal;Activate();};
        safety.Tick+=async(_,_)=>await StopRecording();
        runtime.Progress=stage=>OnUi(()=>Emit(new(){["type"]="progress",["stage"]=stage}));
        Shown+=async(_,_)=>await Initialize();
        FormClosing+=(_,e)=>
        {
            if(busy && !settingUp){e.Cancel=true;if(recording)_=StopRecording();else cancelStart=true;MessageBox.Show("Aufnahme oder KI-Auswertung läuft. Bitte die Verarbeitung abwarten. Das Fenster darf minimiert werden.");return;}
            tray.Visible=false;runtime.Dispose();
        };
        Resize+=(_,_)=>{if(WindowState==FormWindowState.Minimized)tray.Text=recording?"Teamflow · REC":"Teamflow";};
    }
    void OnUi(Action action){if(IsDisposed)return;if(InvokeRequired)BeginInvoke(action);else action();}
    static bool IsDashboard(string? source)=>Uri.TryCreate(source,UriKind.Absolute,out var u)&&u.Scheme=="https"&&u.Host=="vieto1.github.io"&&u.AbsolutePath.StartsWith("/teamflow/",StringComparison.Ordinal);
    public static bool ValidSource(string source)=>IsDashboard(source);
    async Task Initialize()
    {
        try
        {
            if(!runtime.Configured) { if(!await Setup()) {Close();return;} }
            Controls.Add(web);
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(LocalRuntime.State,"webview"));
            await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.Settings.IsStatusBarEnabled=false;
            await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("if(window===window.top&&location.origin==='https://vieto1.github.io'&&location.pathname.startsWith('/teamflow/')){window.__TEAMFLOW_NATIVE__={version:'1.4.1',platform:'windows'};window.webkit={messageHandlers:{teamflowRecorder:{postMessage:d=>window.chrome.webview.postMessage(d)}}};}");
            web.CoreWebView2.WebMessageReceived+=async(_,e)=>
            {
                if(!IsDashboard(e.Source))return;
                try { await Receive(JsonNode.Parse(e.WebMessageAsJson)!.AsObject()); }catch(Exception ex){Emit(new(){["type"]="error",["error"]=ex.Message});}
            };
            web.CoreWebView2.NavigationStarting+=(_,e)=>
            {
                if(!IsDashboard(e.Uri)){e.Cancel=true;OpenExternal(e.Uri);return;}
                if(recording)_=StopRecording();else if(busy)cancelStart=true;
            };
            web.CoreWebView2.ProcessFailed+=(_,_)=>{if(recording)_=StopRecording();else cancelStart=true;};
            // Retain Chromium's normal new-window behavior for Jitsi host authentication.
            web.CoreWebView2.NewWindowRequested+=async(_,e)=>
            {
                var deferral=e.GetDeferral();e.Handled=true;
                try
                {
                    var child=new Form{Text="Teamflow · Anmeldung",Width=800,Height=800};
                    var popup=new WebView2{Dock=DockStyle.Fill};child.Controls.Add(popup);child.Show(this);
                    await popup.EnsureCoreWebView2Async(env);e.NewWindow=popup.CoreWebView2;
                    popup.CoreWebView2.WindowCloseRequested+=(_,_)=>child.Close();
                    child.FormClosed+=(_,_)=>popup.Dispose();
                }
                finally{deferral.Complete();}
            };
            web.Source=new Uri(Dashboard);
            if(background){Hide();tray.ShowBalloonTip(3000,"Teamflow ist bereit","Über das TF-Symbol öffnen. Es wird noch nichts aufgenommen.",ToolTipIcon.Info);}
        }
        catch(Exception ex){MessageBox.Show("Teamflow konnte nicht geöffnet werden: "+ex.Message+"\nWebView2 (Microsoft Edge) und Firmenrichtlinien prüfen.");Close();}
    }
    static void OpenExternal(string url)
    {
        if(Uri.TryCreate(url,UriKind.Absolute,out var uri)&&uri.Scheme is "https" or "http")System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url){UseShellExecute=true});
    }
    async Task<bool> Setup()
    {
        settingUp=true;
        var panel=new FlowLayoutPanel{Dock=DockStyle.Fill,Padding=new(40),FlowDirection=FlowDirection.TopDown,WrapContents=false};
        var info=new Label{AutoSize=true,MaximumSize=new(950,0),Font=new Font("Segoe UI",13),Text="Teamflow · einmalige lokale KI-Einrichtung\n\nLädt Ollama (ca. 1,6 GB), Whisper (ca. 465 MB) und ein Textmodell (ca. 2 GB) herunter. Mindestens 20 GB freier Speicher. Keine KI-API, kein Abo und kein Terminal erforderlich. Aufnahme startet später ausschließlich über den Aufnahmebutton.\n\nAuf Firmenlaptops können Installationen oder Mikrofonzugriff durch eure IT beschränkt sein."};
        var status=new Label{AutoSize=true,MaximumSize=new(950,0),Text="Bereit zur Einrichtung."};var button=new Button{Text="Kostenlos lokal einrichten",AutoSize=true,Padding=new(12)};
        panel.Controls.Add(info);panel.Controls.Add(button);panel.Controls.Add(status);Controls.Add(panel);
        var done=new TaskCompletionSource<bool>();
        button.Click+=async(_,_)=>
        {
            button.Enabled=false;busy=true;
            runtime.Progress=stage=>OnUi(()=>status.Text=stage);
            try{await runtime.Setup();done.TrySetResult(true);}
            catch(Exception ex){if(!IsDisposed){status.Text=ex.Message;button.Enabled=true;}}
            finally{busy=false;}
        };
        FormClosed+=(_,_)=>done.TrySetResult(false);
        bool ok=await done.Task;settingUp=false;
        Controls.Remove(panel);panel.Dispose();
        runtime.Progress=stage=>OnUi(()=>Emit(new(){["type"]="progress",["stage"]=stage}));return ok;
    }
    async Task Receive(JsonObject data)
    {
        switch(data["command"]?.ToString())
        {
            case "status":if(pendingResult!=null)Emit(new(){["type"]="result",["result"]=pendingResult.DeepClone()});else Emit(new(){["type"]="available",["recording"]=recording,["busy"]=busy,["startedAt"]=startedAt});break;
            case "mute":audio?.SetMuted(data["muted"]?.GetValue<bool>()??true);break;
            case "start":
                if(busy)throw new IOException("Eine Aufnahme oder Auswertung läuft bereits.");
                var selected=data["meeting"]?.AsObject()??throw new IOException("Meetingdaten fehlen.");
                string title=selected["title"]?.ToString()??"",date=selected["date"]?.ToString()??"";
                if(title.Length is <1 or >200||!Regex.IsMatch(date,@"^\d{4}-\d{2}-\d{2}$"))throw new IOException("Ungültige Meetingdaten.");
                meeting=(JsonObject)selected.DeepClone();await StartRecording();break;
            case "stop":await StopRecording();break;
        }
    }
    void Emit(JsonObject data)
    {
        if(web.CoreWebView2==null||!IsDashboard(web.Source?.AbsoluteUri))return;
        _=web.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('teamflow:native',{detail:"+data.ToJsonString()+"}));");
    }
    async Task StartRecording()
    {
        busy=true;cancelStart=false;pendingResult=null;SetThreadExecutionState(0x80000001);
        Emit(new(){["type"]="progress",["stage"]="Windows-Aufnahme wird vorbereitet …"});
        try
        {
            await runtime.EnsureServer();if(cancelStart)throw new IOException("Aufnahmestart abgebrochen.");
            audio=new AudioRecorder();audio.Failed=ex=>OnUi(()=>{Emit(new(){["type"]="warning",["stage"]=ex.Message});_=StopRecording();});
            await audio.Start(Path.Combine(LocalRuntime.State,"recordings",Guid.NewGuid().ToString()));
            if(cancelStart){await audio.DisposeAsync();throw new IOException("Aufnahmestart abgebrochen.");}
            recording=true;startedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();tray.Text="Teamflow · REC";Text="● REC · Teamflow";safety.Start();
            Emit(new(){["type"]="started",["startedAt"]=startedAt});
            tray.ShowBalloonTip(3000,"Aufnahme läuft","Teamflow zeichnet Meetington und Mikrofon lokal auf.",ToolTipIcon.Info);
        }
        catch(Exception ex){if(audio!=null)await audio.DisposeAsync();audio=null;busy=false;SetThreadExecutionState(0x80000000);Emit(new(){["type"]="error",["error"]=ex.Message});}
    }
    async Task StopRecording()
    {
        if(!recording||audio==null){if(busy)cancelStart=true;return;}
        recording=false;safety.Stop();var capture=audio;audio=null;tray.Text="Teamflow · KI arbeitet";Text="Teamflow · lokale Auswertung";
        Emit(new(){["type"]="processing",["stage"]="Aufnahme wird gespeichert und lokal transkribiert …"});
        try
        {
            string wav=await capture.Stop();string compressed=await runtime.Compress(wav);
            var result=await runtime.Analyze(compressed,meeting);pendingResult=(JsonObject)result.DeepClone();
            Emit(new(){["type"]="result",["result"]=result});tray.ShowBalloonTip(3000,"KI-Protokoll ist bereit","Transkript, Zusammenfassung und Aufgaben in Teamflow prüfen.",ToolTipIcon.Info);
        }
        catch(Exception ex){Emit(new(){["type"]="error",["error"]=ex.Message+" Vorhandene Dateien bleiben lokal gespeichert."});}
        finally{await capture.DisposeAsync();busy=false;tray.Text="Teamflow";Text="Teamflow";SetThreadExecutionState(0x80000000);}
    }
    protected override void Dispose(bool disposing){if(disposing){tray.Dispose();safety.Dispose();}base.Dispose(disposing);}
}
