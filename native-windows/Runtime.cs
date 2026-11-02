using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Teamflow;

internal sealed class LocalRuntime : IDisposable
{
    public static readonly string State = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Teamflow", "KI");
    public static readonly string Root = AppContext.BaseDirectory;
    public static readonly string RuntimeRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Teamflow", "Runtime");
    readonly HttpClient client = new(new HttpClientHandler { CookieContainer = new CookieContainer(), AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(120) };
    Process? server, ollama;
    string csrf = "";
    public Action<string>? Progress;
    static readonly object LogLock=new();
    string OllamaMarker => Path.Combine(RuntimeRoot,"ollama","complete.flag");
    string OllamaExe => Path.Combine(RuntimeRoot,"ollama","ollama.exe");
    public bool Configured => File.Exists(Path.Combine(State,"config.json")) && File.Exists(OllamaExe) && File.Exists(OllamaMarker);
    public static Process Spawn(string file, params string[] args)
    {
        var info = new ProcessStartInfo(file) { UseShellExecute=false, CreateNoWindow=true, RedirectStandardOutput=true, RedirectStandardError=true, WorkingDirectory=Root };
        foreach (string arg in args) info.ArgumentList.Add(arg);
        info.Environment["TEAMFLOW_STATE"]=State;
        info.Environment["PATH"]=Path.Combine(Root,"tools")+Path.PathSeparator+info.Environment["PATH"];
        info.Environment["OLLAMA_HOST"]="127.0.0.1:11434";
        info.Environment["OLLAMA_NO_CLOUD"]="1";
        info.Environment["OLLAMA_MODELS"]=Path.Combine(State,"ollama-models");
        Directory.CreateDirectory(State);
        var process=Process.Start(info) ?? throw new IOException("Lokaler Dienst konnte nicht gestartet werden.");
        void Log(object sender,DataReceivedEventArgs args)
        {
            if(args.Data==null)return;
            try { lock(LogLock) {string log=Path.Combine(State,"desktop.log");if(File.Exists(log)&&new FileInfo(log).Length>5*1024*1024)File.Move(log,log+".old",true);File.AppendAllText(log,args.Data+Environment.NewLine);} }catch{}
        }
        process.OutputDataReceived+=Log;process.ErrorDataReceived+=Log;process.BeginOutputReadLine();process.BeginErrorReadLine();return process;
    }
    public async Task Download(string url, string destination, string sha256)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        string partial=destination+".part";
        using (var response=await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
        {
            // Downloads follow only the official release/CDN HTTPS redirects via a separate client.
            if ((int)response.StatusCode is >=300 and <400) { await DownloadRedirected(url, partial); }
            else { response.EnsureSuccessStatusCode(); await SaveResponse(response, partial); }
        }
        await using(var input=File.OpenRead(partial))
        {
            string actual=Convert.ToHexString(await SHA256.HashDataAsync(input)).ToLowerInvariant();
            if(actual!=sha256.ToLowerInvariant()) { File.Delete(partial); throw new IOException("Prüfsumme stimmt nicht. Bitte Einrichtung erneut starten."); }
        }
        File.Move(partial,destination,true);
    }
    async Task DownloadRedirected(string url,string partial)
    {
        using var download=new HttpClient { Timeout=TimeSpan.FromHours(2) };
        using var response=await download.GetAsync(url,HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode(); await SaveResponse(response,partial);
    }
    async Task SaveResponse(HttpResponseMessage response,string partial)
    {
        await using var source=await response.Content.ReadAsStreamAsync();
        await using var output=File.Create(partial);
        byte[] buffer=new byte[1024*128];long total=0;int count;long? size=response.Content.Headers.ContentLength;
        var next=DateTime.MinValue;
        while((count=await source.ReadAsync(buffer))>0)
        {
            await output.WriteAsync(buffer.AsMemory(0,count));total+=count;
            if(DateTime.UtcNow>next) { Progress?.Invoke($"Download: {total/1048576:N0} MB"+(size.HasValue?$" / {size.Value/1048576:N0} MB":""));next=DateTime.UtcNow.AddSeconds(1); }
        }
    }
    public async Task Setup()
    {
        Directory.CreateDirectory(State);Directory.CreateDirectory(RuntimeRoot);
        var drive=new DriveInfo(Path.GetPathRoot(State)!);
        if(drive.AvailableFreeSpace<20L*1024*1024*1024) throw new IOException("Bitte mindestens 20 GB freien Speicher für Programme, Modelle und Aufnahmen schaffen.");
        if(!File.Exists(OllamaExe)||!File.Exists(OllamaMarker))
        {
            var manifest=JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(Root,"runtime-downloads.json")))!;
            string archive=Path.Combine(RuntimeRoot,"ollama.zip");
            Progress?.Invoke("Ollama wird einmalig heruntergeladen …");
            await Download(manifest["ollamaUrl"]!.GetValue<string>(),archive,manifest["ollamaSha256"]!.GetValue<string>());
            Progress?.Invoke("Ollama wird entpackt …");
            await Task.Run(()=>ZipFile.ExtractToDirectory(archive,Path.Combine(RuntimeRoot,"ollama"),true));await File.WriteAllTextAsync(OllamaMarker,"SHA256 verified and extraction complete");File.Delete(archive);
        }
        string whisper=Path.Combine(State,"models","ggml-small.bin");
        if(!File.Exists(whisper))
        {
            Progress?.Invoke("Spracherkennung wird heruntergeladen …");
            // The pinned model revision is also used by the Mac installer.
            await Download("https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin",whisper,"1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b");
        }
        await EnsureOllama();
        Progress?.Invoke("Lokales Textmodell qwen2.5:3b wird geladen …");
        using var request=new HttpRequestMessage(HttpMethod.Post,"http://127.0.0.1:11434/api/pull") { Content=JsonContent.Create(new {model="qwen2.5:3b",stream=true}) };
        using var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead);response.EnsureSuccessStatusCode();
        using var reader=new StreamReader(await response.Content.ReadAsStreamAsync());bool success=false;
        while(await reader.ReadLineAsync() is { } line)
        {
            var row=JsonNode.Parse(line)!;if(row["error"]!=null)throw new IOException(row["error"]!.ToString());
            string status=row["status"]?.ToString()??"Modell wird geladen …";Progress?.Invoke(status);
            if(status=="success")success=true;
        }
        if(!success)throw new IOException("Modell-Download wurde nicht erfolgreich abgeschlossen.");
        string config=JsonSerializer.Serialize(new {model="qwen2.5:3b",whisperModel=whisper});
        await File.WriteAllTextAsync(Path.Combine(State,"config.json.tmp"),config);File.Move(Path.Combine(State,"config.json.tmp"),Path.Combine(State,"config.json"),true);
    }
    async Task<bool> Alive(string url)
    {
        try { using var request=new HttpRequestMessage(HttpMethod.Get,url);using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(2));using var response=await client.SendAsync(request,timeout.Token);return response.IsSuccessStatusCode; }catch{return false;}
    }
    async Task EnsureOllama()
    {
        if(await Alive("http://127.0.0.1:11434/api/tags"))return;
        ollama=Spawn(OllamaExe,"serve");
        for(int i=0;i<100;i++) { if(await Alive("http://127.0.0.1:11434/api/tags"))return;await Task.Delay(300); }
        throw new IOException("Ollama konnte nicht gestartet werden. Bitte Sicherheits-/Firmenrichtlinien prüfen.");
    }
    public async Task EnsureServer()
    {
        if(!Configured)throw new IOException("Bitte zuerst die einmalige Einrichtung in der Windows-App abschließen.");
        await EnsureOllama();
        if(!await Alive("http://127.0.0.1:8765/"))
        {
            server=Spawn(Path.Combine(Root,"companion","Teamflow-KI.exe"));
            for(int i=0;i<100;i++){if(await Alive("http://127.0.0.1:8765/"))break;await Task.Delay(200);}
        }
        using var response=await client.GetAsync("http://127.0.0.1:8765/");
        response.EnsureSuccessStatusCode();
        if(!response.Headers.TryGetValues("X-Teamflow-Version",out var values)||values.FirstOrDefault()!="1.2.0")throw new IOException("Port 8765 ist belegt oder ein alter KI-Dienst läuft. Bitte den alten Teamflow-Dienst einmal beenden.");
        string html=await response.Content.ReadAsStringAsync();
        var match=System.Text.RegularExpressions.Regex.Match(html,"name=\"csrf\" content=\"([^\"]+)\"");
        if(!match.Success)throw new IOException("Lokaler Teamflow-Dienst konnte nicht bestätigt werden.");csrf=match.Groups[1].Value;
    }
    public async Task<JsonObject> Analyze(string audio,JsonObject meeting)
    {
        await EnsureServer();
        string title=Uri.EscapeDataString(meeting["title"]!.GetValue<string>()),date=Uri.EscapeDataString(meeting["date"]!.GetValue<string>());
        using var upload=new HttpRequestMessage(HttpMethod.Post,$"http://127.0.0.1:8765/api/jobs/audio?title={title}&date={date}&name=meeting.m4a&consent=1");
        upload.Headers.Add("X-Teamflow-CSRF",csrf);
        await using var file=File.OpenRead(audio);upload.Content=new StreamContent(file);upload.Content.Headers.ContentType=new("application/octet-stream");
        using var response=await client.SendAsync(upload);var data=JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        if(response.StatusCode!=HttpStatusCode.Created)throw new IOException(data["error"]?.ToString()??"Audio-Übergabe fehlgeschlagen.");
        string id=data["id"]!.GetValue<string>();
        for(;;)
        {
            await Task.Delay(2000);
            var jobs=JsonNode.Parse(await client.GetStringAsync("http://127.0.0.1:8765/api/jobs"))!.AsArray();
            var job=jobs.FirstOrDefault(j=>j?["id"]?.ToString()==id)??throw new IOException("Protokoll nicht gefunden.");
            Progress?.Invoke(job["stage"]?.ToString()??"Lokale KI arbeitet …");
            if(job["status"]?.ToString()=="failed")throw new IOException(job["error"]?.ToString()??"KI-Auswertung fehlgeschlagen.");
            if(job["status"]?.ToString()=="done")
            {
                var result=JsonNode.Parse(await client.GetStringAsync($"http://127.0.0.1:8765/api/jobs/{id}/result"))!.AsObject();
                result["sourceMeetingId"]=meeting["id"]?.GetValue<string>()??"";return result;
            }
        }
    }
    public async Task<string> Compress(string input)
    {
        string output=Path.Combine(Path.GetDirectoryName(input)!,"meeting.m4a");
        using var process=Spawn(Path.Combine(Root,"tools","ffmpeg.exe"),"-nostdin","-v","error","-y","-i",input,"-c:a","aac","-b:a","128k",output);
        await process.WaitForExitAsync();if(process.ExitCode!=0)throw new IOException("Audiodatei konnte nicht umgewandelt werden. Das WAV-Original bleibt lokal erhalten.");return output;
    }
    public void Dispose()
    {
        // Only stop processes started by this app. Existing Ollama installations remain running.
        foreach(var process in new[]{server,ollama}) { try { if(process is {HasExited:false})process.Kill(true);process?.Dispose(); }catch{} }
        client.Dispose();
    }
}
