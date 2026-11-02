using NAudio.Wave;
using NAudio.Extras;
using NAudio.CoreAudioApi;

namespace Teamflow;

// Process loopback includes WebView2 children, never unrelated application audio.
internal sealed class AudioRecorder : IAsyncDisposable
{
    WasapiRecorder? system, microphone;
    RealtimeCaptureMixer? mixer;
    WaveFileWriter? writer;
    Task? pump;
    volatile bool stop, closing, muted = true;
    Exception? captureError;
    CaptureMixerInput? systemInput, micInput;
    public Action<Exception>? Failed;
    public string FilePath { get; private set; } = "";
    public void SetMuted(bool value) => muted = value;

    public async Task Start(string directory)
    {
        Directory.CreateDirectory(directory);
        FilePath = Path.Combine(directory, "original.wav");
        try
        {
            system = await new WasapiRecorderBuilder()
                .WithProcessLoopback((uint)Environment.ProcessId, ProcessLoopbackMode.IncludeTargetProcessTree)
                .WithFormat(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2)).BuildAsync();
            microphone = new WasapiRecorderBuilder().WithCommunicationsMode().Build();
            mixer = new RealtimeCaptureMixer(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2));
            systemInput = mixer.AddInput(system.WaveFormat); micInput = mixer.AddInput(microphone.WaveFormat);
            system.DataAvailable += (data, flags, device, qpc) => systemInput.AddSamples(data);
            microphone.DataAvailable += (data, flags, device, qpc) =>
            {
                if (muted) micInput.AddSamples(new byte[data.Length]); else micInput.AddSamples(data);
            };
            system.RecordingStopped += OnStopped; microphone.RecordingStopped += OnStopped;
            writer = new WaveFileWriter(FilePath, new WaveFormat(48000, 16, 1));
            mixer.Start(); system.StartRecording(); microphone.StartRecording();
            pump = Task.Run(async () =>
            {
                var floats = new float[9600]; var pcm = new byte[9600];
                try
                {
                    while (!stop)
                    {
                        int count = mixer.Read(floats, 0, floats.Length);
                        if (count == 0) { await Task.Delay(5); continue; }
                        // Average stereo channels and leave headroom for two voices.
                        for (int i=0; i<count/2; i++)
                        {
                            short sample = (short)(Math.Clamp((floats[2*i]+floats[2*i+1])*0.25f,-1,1)*short.MaxValue);
                            pcm[2*i]=(byte)sample; pcm[2*i+1]=(byte)(sample>>8);
                        }
                        writer.Write(pcm, 0, count);
                    }
                }
                catch (Exception ex) { captureError=ex; Failed?.Invoke(ex); }
            });
        }
        catch { await DisposeAsync(); throw; }
    }
    void OnStopped(object? sender, StoppedEventArgs args)
    {
        if (args.Exception != null && !closing) { captureError=args.Exception; Failed?.Invoke(args.Exception); }
    }
    public async Task<string> Stop()
    {
        bool receivedMic=micInput?.HasReceivedData == true;
        bool receivedSystem=systemInput?.HasReceivedData == true;
        await DisposeAsync();
        if (captureError != null) throw new IOException("Audioaufnahme unterbrochen. Original bleibt lokal erhalten.", captureError);
        if (!receivedMic || !receivedSystem) throw new IOException("Mikrofon- oder Gesprächston fehlt. Bitte ein Testmeeting mit einer zweiten Person und Windows-Mikrofonfreigabe prüfen. Original bleibt lokal erhalten.");
        return FilePath;
    }
    public async ValueTask DisposeAsync()
    {
        closing=true;
        system?.StopRecording(); microphone?.StopRecording();
        if (system != null) { await system.DisposeAsync(); system=null; }
        if (microphone != null) { await microphone.DisposeAsync(); microphone=null; }
        if (pump != null) { await Task.Delay(150); stop=true; await pump; pump=null; }
        writer?.Dispose(); writer=null;
    }
}
