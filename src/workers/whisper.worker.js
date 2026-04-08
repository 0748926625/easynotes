import { pipeline, env } from '@xenova/transformers';

// Utiliser uniquement le cache navigateur, pas de modèles locaux
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

async function loadModel(onProgress) {
  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny',
    { progress_callback: onProgress }
  );
}

self.onmessage = async (e) => {
  const { type, audio } = e.data;

  if (type === 'load') {
    try {
      await loadModel((p) => {
        self.postMessage({ type: 'progress', data: p });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
    return;
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      try {
        await loadModel(() => {});
      } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
        return;
      }
    }
    try {
      const result = await transcriber(audio, {
        language: 'french',
        task: 'transcribe',
      });
      const text = result.text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
      self.postMessage({ type: 'result', text });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
