import { createContext, useContext, useRef, useCallback, useState } from 'react';
import { beep } from '../utils/beep';

const WhisperContext = createContext(null);

const GRAMMAR = `#JSGF V1.0; grammar nombres;
public <nombre> = zero | un | une | deux | trois | quatre | cinq | six | sept | huit | neuf | dix
  | onze | douze | treize | quatorze | quinze | seize
  | dix-sept | dix-huit | dix-neuf | vingt
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | <nombre> virgule cinq | <nombre> et demi ;`;

export function WhisperProvider({ children }) {
  const [status, setStatus] = useState('ready');
  const recognitionRef = useRef(null);
  const onResultRef    = useRef(null);
  const onErrorRef     = useRef(null);
  const activeRef      = useRef(false);
  const genRef         = useRef(0);

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 10;
    rec.continuous = false;
    try {
      const GL = window.SpeechGrammarList || window.webkitSpeechGrammarList;
      if (GL) {
        const list = new GL();
        list.addFromString(GRAMMAR, 1);
        rec.grammars = list;
      }
    } catch (_) {}
    return rec;
  }

  const startRecording = useCallback((onResult, onError) => {
    if (activeRef.current) return;
    onResultRef.current = onResult;
    onErrorRef.current  = onError;

    const rec = getRecognition();
    if (!rec) { onError('SpeechRecognition non supporté'); return; }

    const myGen = ++genRef.current;
    recognitionRef.current = rec;
    activeRef.current = true;
    setStatus('recording');

    rec.onresult = (e) => {
      if (genRef.current !== myGen) return;
      activeRef.current = false;
      setStatus('ready');
      const result = e.results[0];
      const alternatives = Array.from({ length: result.length }, (_, i) => ({
        transcript: result[i].transcript,
        confidence: result[i].confidence,
      }));
      const text = alternatives.map(a => a.transcript).join('|');
      if (onResultRef.current) onResultRef.current(text, alternatives);
    };

    rec.onerror = (e) => {
      if (genRef.current !== myGen) return;
      activeRef.current = false;
      setStatus('ready');
      if (onErrorRef.current) onErrorRef.current(e.error);
    };

    rec.onend = () => {
      if (genRef.current === myGen) {
        activeRef.current = false;
        setStatus('ready');
      }
    };

    try { rec.start(); } catch (e) {
      if (genRef.current === myGen) {
        activeRef.current = false;
        setStatus('ready');
        if (onErrorRef.current) onErrorRef.current(e.message);
      }
    }
  }, []);

  // Arrêt gracieux : traite l'audio capturé → déclenche onresult
  const finishRecording = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, []);

  // Arrêt forcé : annule sans résultat
  const stopRecording = useCallback(() => {
    genRef.current++;
    activeRef.current = false;
    try { recognitionRef.current?.abort(); } catch (_) {}
    setStatus('ready');
  }, []);

  return (
    <WhisperContext.Provider value={{ status, loadProgress: 100, loadLabel: '', startRecording, finishRecording, stopRecording }}>
      {children}
    </WhisperContext.Provider>
  );
}

export function useWhisper() {
  const ctx = useContext(WhisperContext);
  if (!ctx) throw new Error('useWhisper doit être dans WhisperProvider');
  return ctx;
}
