using NAudio.Wave;
using NAudio.Extras;
using System.Runtime.InteropServices;
namespace Teamflow;
internal static class SelfTest
{
    public static int Run()
    {
        try
        {
            if(!MainWindow.ValidSource("https://vieto1.github.io/teamflow/"))throw new Exception("Valid source rejected");
            foreach(string url in new[]{"https://evil.example/teamflow/","https://vieto1.github.io/other/","http://vieto1.github.io/teamflow/","https://vieto1.github.io/teamflow-evil/"})
                if(MainWindow.ValidSource(url))throw new Exception("Unsafe bridge source accepted");
            var format=WaveFormat.CreateIeeeFloatWaveFormat(48000,2);
            var mixer=new RealtimeCaptureMixer(format);
            var remote=mixer.AddInput(format);var mic=mixer.AddInput(new WaveFormat(16000,16,1));
            mixer.Start();var output=new float[48000];
            if(mixer.Read(output,0,output.Length)!=0)throw new Exception("Mixer ran ahead without audio");
            var samples=Enumerable.Repeat(0.25f,24000).ToArray();remote.AddSamples(MemoryMarshal.AsBytes(samples.AsSpan()));
            mic.AddSamples(new byte[8000]);mixer.Read(output,0,output.Length);Thread.Sleep(160);
            int count=mixer.Read(output,0,output.Length);
            if(count<1000||count>20000||!output.Take(count).Any(v=>v>0.1))throw new Exception("Paced mixing/resampling failed");
            // Independent local service: cookies and CSRF still required, no browser CORS.
            var testState=Path.Combine(Path.GetTempPath(),"teamflow-test-"+Guid.NewGuid());Directory.CreateDirectory(testState);
            var info=new System.Diagnostics.ProcessStartInfo(Path.Combine(AppContext.BaseDirectory,"companion","Teamflow-KI.exe")){UseShellExecute=false,CreateNoWindow=true};
            info.Environment["TEAMFLOW_STATE"]=testState;
            using var service=System.Diagnostics.Process.Start(info)!;
            try
            {
                using var client=new HttpClient(new HttpClientHandler{UseCookies=false});
                string? html=null;
                for(int i=0;i<100;i++){try{html=client.GetStringAsync("http://127.0.0.1:8765/").GetAwaiter().GetResult();break;}catch{Thread.Sleep(100);}}
                if(html==null||!html.Contains("name=\"csrf\"" )||!html.Contains("AUS GESPRÄCHEN"))throw new Exception("Bundled local service failed to start");
                using var response=client.GetAsync("http://127.0.0.1:8765/api/jobs").GetAwaiter().GetResult();
                if(response.StatusCode!=System.Net.HttpStatusCode.Forbidden)throw new Exception("Unauthenticated local API accepted");
                string token=System.Text.RegularExpressions.Regex.Match(html,"name=\"csrf\" content=\"([^\"]+)\"").Groups[1].Value;
                string id=Guid.NewGuid().ToString();string folder=Path.Combine(testState,"jobs",id);Directory.CreateDirectory(folder);
                File.WriteAllText(Path.Combine(folder,"result.json"),"{\"title\":\"Überprüfung – Hải 建設\"}");
                using var authenticated=new HttpRequestMessage(HttpMethod.Get,$"http://127.0.0.1:8765/api/jobs/{id}/result");
                authenticated.Headers.Add("Cookie","teamflow_session="+token);
                using var result=client.SendAsync(authenticated).GetAwaiter().GetResult();
                string text=result.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                if(!result.IsSuccessStatusCode||System.Text.Json.Nodes.JsonNode.Parse(text)?["title"]?.ToString()!="Überprüfung – Hải 建設")throw new Exception("Unicode protocol round-trip failed");
            }
            finally{if(!service.HasExited)service.Kill(true);service.WaitForExit();Directory.Delete(testState,true);}
            File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"self-test.txt"),"Passed: bridge URL boundaries, paced resampling/mixing, bundled service, session requirement, Unicode protocol round-trip. No actual audio-device capture was tested.");
            return 0;
        }
        catch(Exception ex){File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"self-test.txt"),ex.ToString());return 1;}
    }
}
