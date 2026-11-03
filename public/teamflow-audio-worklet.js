// Mono PCM16 chunks, bounded memory. No audio is played back.
class TeamflowPCM extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Int16Array(16000*60);this.used=0;this.total=0;this.port.onmessage=e=>{if(e.data==='flush'){this.flush();this.port.postMessage({flushed:true})}}}
 flush(){if(!this.used)return;const samples=this.buffer.slice(0,this.used);this.port.postMessage({samples:samples.buffer,offset:this.total-this.used},[samples.buffer]);this.used=0}
 process(inputs){const channels=inputs[0];if(!channels?.length)return true;const count=channels[0].length;let power=0;for(let i=0;i<count;i++){let n=0;for(const c of channels)n+=c[i]/channels.length;n=Math.max(-1,Math.min(1,n));power+=n*n;this.buffer[this.used++]=n<0?n*32768:n*32767;this.total++;if(this.used===this.buffer.length)this.flush()}if(this.total%80000<count&&this.used){const copy=this.buffer.slice(0,this.used);this.port.postMessage({checkpoint:copy.buffer,offset:this.total-this.used},[copy.buffer])}if(this.total%16000<count)this.port.postMessage({level:Math.sqrt(power/count)});return true}
}
registerProcessor('teamflow-pcm',TeamflowPCM);
