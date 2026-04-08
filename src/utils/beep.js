// Génère des bips via Web Audio API (sans fichier audio)
function makeBeep(freq, duration, volume = 0.4, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
    setTimeout(() => ctx.close(), duration + 100);
  } catch (_) {}
}

export const beep = {
  tick:    () => makeBeep(440, 80,  0.2),   // tick du compte à rebours
  start:   () => makeBeep(880, 180, 0.5),   // BIP → parlez
  success: () => makeBeep(1046, 220, 0.4),  // BIP → validé
  error:   () => makeBeep(220, 300, 0.4, 'sawtooth'), // erreur
};
