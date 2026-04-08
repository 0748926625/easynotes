// Encode un Float32Array en fichier WAV
export function encodeWAV(float32, sampleRate = 16000) {
  const numSamples = float32.length;
  const buffer     = new ArrayBuffer(44 + numSamples * 2);
  const view       = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + numSamples * 2, true);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // taille bloc fmt
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const pcm = new Int16Array(buffer, 44);
  for (let i = 0; i < numSamples; i++) {
    pcm[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7FFF;
  }

  return buffer;
}

// Convertit un ArrayBuffer en base64 (par chunks pour éviter stack overflow)
export function toBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary  = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
