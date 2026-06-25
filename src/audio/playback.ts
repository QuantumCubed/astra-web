let playbackCtx: AudioContext | null = null;
let playbackSampleRate = 0;
let nextStartTime = 0;
let lastSource: AudioBufferSourceNode | null = null;

function getCtx(sampleRate: number): AudioContext {
  if (!playbackCtx || playbackCtx.state === 'closed' || playbackSampleRate !== sampleRate) {
    void playbackCtx?.close();
    playbackCtx = new AudioContext({ sampleRate });
    playbackSampleRate = sampleRate;
  }
  return playbackCtx;
}

/** Begin a streaming TTS playback. Resets the scheduling cursor; call on `tts_start`. */
export function startTtsStream(sampleRate: number): void {
  const ctx = getCtx(sampleRate);
  void ctx.resume();
  // Small lead so the first chunk isn't scheduled in the past (which would glitch).
  nextStartTime = ctx.currentTime + 0.1;
  lastSource = null;
}

/**
 * Schedule one PCM chunk to play back-to-back after everything queued so far, and
 * return the milliseconds from now until it actually starts. The caller uses that
 * delay to reveal the matching transcript text exactly when the audio plays.
 *
 * The `max(nextStartTime, currentTime)` guard restarts the cursor at "now" if playback
 * ever falls behind real time (an underrun), so a momentary stall just costs one small
 * gap instead of scheduling everything in the past.
 */
export function enqueueChunk(bytes: ArrayBuffer, sampleRate: number): number {
  const ctx = getCtx(sampleRate);
  const samples = new Float32Array(bytes);
  if (samples.length === 0) return 0;

  const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);

  const startAt = Math.max(nextStartTime, ctx.currentTime);
  source.start(startAt);
  nextStartTime = startAt + audioBuffer.duration;
  lastSource = source;

  return Math.max(0, (startAt - ctx.currentTime) * 1000);
}

/** Fire `onEnded` when the last scheduled chunk finishes playing. Call on `tts_end`. */
export function endTtsStream(onEnded: () => void): void {
  if (lastSource) {
    lastSource.onended = onEnded;
  } else {
    onEnded();
  }
}
