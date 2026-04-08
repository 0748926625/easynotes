import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook pour la transcription audio avec Whisper (local, sans API).
 * status: 'loading' | 'ready' | 'recording' | 'processing' | 'error'
 */
export function useWhisper() {
  const [status, setStatus] = useState('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadLabel, setLoadLabel] = useState('Chargement du modèle...');

  const workerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const onResultRef = useRef(null);
  const onErrorRef = useRef(null);
  const stopTimerRef = useRef(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/whisper.worker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const { type, data, text, message } = e.data;
      switch (type) {
        case 'progress':
          // Transformers.js envoie status: 'download', 'progress', 'initiate', 'done'
          if (data?.progress != null) {
            setLoadProgress(Math.round(data.progress));
          }
          if (data?.file) {
            setLoadLabel(`Téléchargement… ${data.file}`);
          }
          break;
        case 'ready':
          setStatus('ready');
          setLoadProgress(100);
          setLoadLabel('Modèle prêt');
          break;
        case 'result':
          setStatus('ready');
          if (onResultRef.current) onResultRef.current(text);
          break;
        case 'error':
          // Si le modèle n'est pas encore chargé → erreur fatale
          // Si c'est une erreur de transcription → remettre à 'ready' pour pouvoir réessayer
          setStatus(workerRef.current ? 'ready' : 'error');
          if (onErrorRef.current) onErrorRef.current(message);
          break;
      }
    };

    workerRef.current = worker;
    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
      clearTimeout(stopTimerRef.current);
    };
  }, []);

  /**
   * Lance l'enregistrement puis envoie à Whisper.
   * @param {function} onResult  (text: string) => void
   * @param {function} onError   (msg: string) => void
   * @param {number}   duration  durée max en ms (défaut 4000)
   */
  const startRecording = useCallback(async (onResult, onError, duration = 4000) => {
    if (status !== 'ready') return;

    onResultRef.current = onResult;
    onErrorRef.current = onError;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Détection du format supporté (webm sur Android, mp4 sur iOS)
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4;codecs=aac')   ? 'audio/mp4;codecs=aac' :
        MediaRecorder.isTypeSupported('audio/mp4')              ? 'audio/mp4' : '';

      if (!mimeType) {
        stream.getTracks().forEach(t => t.stop());
        setStatus('ready');
        if (onErrorRef.current) onErrorRef.current('Format audio non supporté');
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStatus('processing');
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const arrayBuffer = await blob.arrayBuffer();

          // Décoder à la fréquence native du navigateur (ne pas forcer 16000)
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          audioCtx.close();

          // Rééchantillonner à 16 kHz si nécessaire (Whisper attend exactement 16 kHz)
          const TARGET_SR = 16000;
          let float32;
          if (decoded.sampleRate === TARGET_SR) {
            float32 = decoded.getChannelData(0);
          } else {
            const frames = Math.round(decoded.duration * TARGET_SR);
            const offCtx = new OfflineAudioContext(1, frames, TARGET_SR);
            const src = offCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(offCtx.destination);
            src.start(0);
            const resampled = await offCtx.startRendering();
            float32 = resampled.getChannelData(0);
          }

          workerRef.current.postMessage(
            { type: 'transcribe', audio: float32 },
            [float32.buffer]
          );
        } catch (err) {
          // Erreur de transcription : remettre à 'ready' pour pouvoir réessayer
          setStatus('ready');
          if (onErrorRef.current) onErrorRef.current(err.message);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setStatus('recording');

      // Arrêt automatique après `duration` ms
      stopTimerRef.current = setTimeout(() => stopRecording(), duration);

    } catch (err) {
      setStatus('error');
      if (onErrorRef.current) onErrorRef.current(err.message);
    }
  }, [status]);

  const stopRecording = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { status, loadProgress, loadLabel, startRecording, stopRecording };
}
