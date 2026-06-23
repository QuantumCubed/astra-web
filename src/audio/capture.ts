export type CaptureHandle = {
  stop: () => Promise<Uint8Array>;
};

// Whisper expects 16 kHz mono 16-bit little-endian PCM.
// Requesting sampleRate: 16000 lets the browser handle downsampling internally.
export async function startCapture(): Promise<CaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);

  // ScriptProcessorNode is deprecated but still universally supported and
  // simpler than AudioWorklet for a basic implementation.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Int16Array[] = [];

  processor.onaudioprocess = (e) => {
    chunks.push(float32ToInt16(e.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      await ctx.close();
      return mergeToUint8(chunks);
    },
  };
}

function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function mergeToUint8(chunks: Int16Array[]): Uint8Array {
  const totalBytes = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(new Uint8Array(chunk.buffer), offset);
    offset += chunk.byteLength;
  }
  return out;
}
