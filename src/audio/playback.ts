let playbackCtx: AudioContext | null = null;
let playbackSampleRate = 0;

function getCtx(sampleRate: number): AudioContext {
  if (!playbackCtx || playbackCtx.state === 'closed' || playbackSampleRate !== sampleRate) {
    void playbackCtx?.close();
    playbackCtx = new AudioContext({ sampleRate });
    playbackSampleRate = sampleRate;
  }
  return playbackCtx;
}

export function playF32Audio(bytes: ArrayBuffer, sampleRate: number, onEnded?: () => void): void {
  const samples = new Float32Array(bytes);
  const ctx = getCtx(sampleRate);
  const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  if (onEnded) source.onended = onEnded;
  source.connect(ctx.destination);
  source.start();
}
