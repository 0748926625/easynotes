import { useState, useRef, useCallback } from "react";
import { useWhisper } from "../context/WhisperContext";
import { beep } from "../utils/beep";

const NUMBERS = Array.from({ length: 21 }, (_, i) => i);
const STORAGE_KEY = "easynotes_voicemap";
const MAX_RETRIES = 3;

export function loadVoiceMap() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (_) { return {}; }
}

function saveVoiceMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export default function Calibration({ onDone, onSkip }) {
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [phase, setPhase]             = useState("intro");
  // intro | speaking | waiting | recording | ok | error | done
  const [transcript, setTranscript]   = useState("");
  const [retryCount, setRetryCount]   = useState(0);
  const [voiceMap, setVoiceMap]       = useState(() => loadVoiceMap());
  const [results, setResults]         = useState({});

  // Récapitulatif : ré-enregistrement
  const [reRecNum, setReRecNum]           = useState(null);
  const [reRecPhase, setReRecPhase]       = useState("idle");
  const [reRecTranscript, setReRecTranscript] = useState("");

  const synthRef       = useRef(window.speechSynthesis);
  const currentIdxRef  = useRef(0);
  const retryCountRef  = useRef(0);
  const voiceMapRef    = useRef(voiceMap);

  const { status: whisperStatus, loadProgress, loadLabel, startRecording, finishRecording } = useWhisper();

  // ── Utilitaires ──────────────────────────────────────────────────────────────

  const speak = useCallback((text, onEnd) => {
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fr-FR";
    utt.rate = 0.9;
    if (onEnd) utt.onend = onEnd;
    synthRef.current.speak(utt);
  }, []);

  function applyResult(num, rawText) {
    const t = rawText.toLowerCase().trim();
    const entries = { [t]: num };
    t.split(/\s+/).forEach(w => { if (w) entries[w] = num; });
    setVoiceMap(prev => {
      const updated = { ...prev, ...entries };
      voiceMapRef.current = updated;
      saveVoiceMap(updated);
      return updated;
    });
    setResults(prev => ({ ...prev, [num]: t }));
    return t;
  }

  // ── Calibration principale ────────────────────────────────────────────────────

  const goToNext = useCallback((fromIdx) => {
    retryCountRef.current = 0;
    setRetryCount(0);
    const next = fromIdx + 1;
    if (next >= NUMBERS.length) {
      setPhase("done");
    } else {
      currentIdxRef.current = next;
      setCurrentIdx(next);
      askNumber(next);
    }
  }, []);

  const askNumber = useCallback((idx) => {
    retryCountRef.current = 0;
    setRetryCount(0);
    setPhase("speaking");
    setTranscript("");
    const num = NUMBERS[idx];
    speak(`Dites le nombre ${num}`, () => setPhase("waiting"));
  }, [speak]);

  // appelé depuis le bouton push-to-talk
  function handleMicDown(e) {
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    if (phase !== "waiting") return;
    beep.start();
    setPhase("recording");
    setTranscript("");

    startRecording(
      (text) => {
        const t = text.split('|')[0].toLowerCase().trim();
        if (!t) { handleRetry(); return; }
        applyResult(NUMBERS[currentIdxRef.current], t);
        beep.success();
        setPhase("ok");
        setTranscript(t);
        setTimeout(() => goToNext(currentIdxRef.current), 900);
      },
      (err) => {
        if (err === 'no-speech') { setPhase("waiting"); return; }
        handleRetry();
      }
    );
  }

  function handleMicUp() {
    if (phase === "recording") finishRecording();
  }

  function handleRetry() {
    const retry = retryCountRef.current + 1;
    retryCountRef.current = retry;
    setRetryCount(retry);
    if (retry >= MAX_RETRIES) {
      beep.error();
      setPhase("error");
      setTranscript(`Ignoré après ${MAX_RETRIES} tentatives`);
      speak(`Nombre ${NUMBERS[currentIdxRef.current]} ignoré. Suivant.`, () => goToNext(currentIdxRef.current));
    } else {
      beep.error();
      setPhase("error");
      setTranscript(`Non reconnu — essai ${retry} sur ${MAX_RETRIES}`);
      speak(`Répétez le nombre.`, () => setPhase("waiting"));
    }
  }

  function handleStart() {
    currentIdxRef.current = 0;
    setCurrentIdx(0);
    askNumber(0);
  }

  function handleSkipNumber() {
    synthRef.current.cancel();
    goToNext(currentIdxRef.current);
  }

  // ── Ré-enregistrement dans le récapitulatif ───────────────────────────────────

  function startReRecord(num) {
    setReRecNum(num);
    setReRecPhase("waiting");
    setReRecTranscript("");
  }

  function handleReRecMicDown(e, num) {
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    if (reRecPhase !== "waiting") return;
    beep.start();
    setReRecPhase("recording");

    startRecording(
      (text) => {
        const t = text.split('|')[0].toLowerCase().trim();
        if (!t) {
          beep.error();
          setReRecPhase("error");
          setReRecTranscript("Non reconnu");
          setTimeout(() => { setReRecNum(null); setReRecPhase("idle"); }, 1200);
          return;
        }
        applyResult(num, t);
        beep.success();
        setReRecPhase("ok");
        setReRecTranscript(t);
        setTimeout(() => { setReRecNum(null); setReRecPhase("idle"); }, 1200);
      },
      () => {
        beep.error();
        setReRecPhase("error");
        setReRecTranscript("Erreur micro");
        setTimeout(() => { setReRecNum(null); setReRecPhase("idle"); }, 1200);
      }
    );
  }

  function handleReRecMicUp() {
    if (reRecPhase === "recording") finishRecording();
  }

  function handleFinish() {
    saveVoiceMap(voiceMapRef.current);
    onDone(voiceMapRef.current);
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  const progress   = currentIdx / NUMBERS.length;
  const currentNum = NUMBERS[currentIdx];

  return (
    <div className="calibration">
      <h2>Calibration vocale</h2>
      <p className="calib-desc">
        L'app énonce chaque nombre. Appuyez sur le bouton 🎤 et maintenez-le pendant que vous parlez.
      </p>

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="calib-intro">
          <div className="calib-icon">🎙️</div>
          <p>
            L'app apprend <strong>ta façon de prononcer</strong> chaque nombre.<br />
            Indispensable pour un accent africain ou régional.
          </p>
          <p>Durée : environ 2 minutes</p>
          {whisperStatus === "loading" ? (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#64748b" }}>Chargement… {loadProgress}%</p>
              <div className="vi-progress-bar">
                <div className="vi-progress-fill" style={{ width: `${loadProgress}%` }} />
              </div>
            </div>
          ) : (
            <button className="btn-start" onClick={handleStart}>Démarrer la calibration</button>
          )}
          {onSkip && (
            <button className="btn-skip-calib" onClick={onSkip} style={{ marginTop: 8 }}>
              Passer — utiliser le dictionnaire standard
            </button>
          )}
        </div>
      )}

      {/* ── Calibration en cours ── */}
      {phase !== "intro" && phase !== "done" && (
        <>
          <div className="vi-progress-bar" style={{ marginBottom: 20 }}>
            <div className="vi-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>

          <div className="calib-counter">{currentIdx} / {NUMBERS.length}</div>
          <div className="calib-number">{currentNum}</div>

          {retryCount > 0 && phase !== "ok" && (
            <div className="calib-retry-badge">Tentative {retryCount} / {MAX_RETRIES}</div>
          )}

          <div className={`vi-status vi-status-${phase === "ok" ? "ok" : phase === "error" ? "error" : "listening"}`}>
            <span className="vi-status-icon">
              {phase === "speaking"  ? "🔊"
               : phase === "waiting"   ? "🎤"
               : phase === "recording" ? "🔴"
               : phase === "ok"        ? "✅"
               : "❌"}
            </span>
            <span className="vi-transcript">
              {phase === "speaking"  ? "Écoutez…"
               : phase === "waiting"   ? "Appuyez et maintenez pour parler"
               : phase === "recording" ? "Parlez… relâchez quand vous avez fini"
               : phase === "ok"        ? `Reconnu : « ${transcript} »`
               : transcript}
            </span>
          </div>

          {/* Bouton push-to-talk principal */}
          {(phase === "waiting" || phase === "recording") && (
            <div className="ptt-zone">
              <button
                className={`btn-ptt ${phase === "recording" ? "btn-ptt-active" : ""}`}
                onPointerDown={handleMicDown}
                onPointerUp={handleMicUp}
                onPointerCancel={handleMicUp}
              >
                🎤
              </button>
              <span className="ptt-hint">
                {phase === "recording" ? "Relâchez pour valider" : "Maintenez et parlez"}
              </span>
            </div>
          )}

          <div className="calib-actions">
            <button className="btn-skip" onClick={handleSkipNumber}>Passer ce nombre</button>
          </div>
        </>
      )}

      {/* ── Récapitulatif ── */}
      {phase === "done" && (
        <div className="calib-done">
          <div className="calib-icon">✅</div>
          <h3>Calibration terminée</h3>

          {(() => {
            const captured = NUMBERS.filter(n => results[n]).length;
            const skipped  = NUMBERS.length - captured;
            return (
              <div className="calib-summary-row">
                <div className="calib-badge calib-badge-ok">✅ {captured} enregistrés</div>
                <div className="calib-badge calib-badge-skip">⬜ {skipped} ignorés</div>
              </div>
            );
          })()}

          <p className="calib-legend">
            Clique sur 🎤 puis maintiens pour ré-enregistrer un nombre manquant ou incorrect.
          </p>

          <div className="calib-table-wrapper">
            <table className="calib-table">
              <thead>
                <tr><th>Nombre</th><th>Entendu</th><th>Action</th></tr>
              </thead>
              <tbody>
                {NUMBERS.map(n => {
                  const heard      = results[n];
                  const isActive   = reRecNum === n;

                  return (
                    <tr key={n} className={heard ? "calib-ok" : "calib-skip"}>
                      <td className="calib-td-num">{n}</td>
                      <td className="calib-td-heard">
                        {isActive ? (
                          <em style={{ color: "#6366f1" }}>
                            {reRecPhase === "waiting"   ? "Appuyez sur 🎤…"
                             : reRecPhase === "recording" ? "Parlez…"
                             : reRecPhase === "ok"        ? `✅ ${reRecTranscript}`
                             : reRecTranscript || "…"}
                          </em>
                        ) : heard ? heard : <em>ignoré</em>}
                      </td>
                      <td>
                        {isActive && (reRecPhase === "waiting" || reRecPhase === "recording") ? (
                          <button
                            className={`btn-rerec ${reRecPhase === "recording" ? "btn-ptt-active" : ""}`}
                            onPointerDown={(e) => handleReRecMicDown(e, n)}
                            onPointerUp={handleReRecMicUp}
                            onPointerCancel={handleReRecMicUp}
                          >
                            🎤
                          </button>
                        ) : (
                          <button
                            className="btn-rerec"
                            onClick={() => startReRecord(n)}
                            disabled={reRecNum !== null}
                            title={`Ré-enregistrer ${n}`}
                          >
                            {heard ? "🔄" : "🎤"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="calib-info">Sauvegardé automatiquement — ne se refait qu'une seule fois.</p>
          <button className="btn-start" onClick={handleFinish} disabled={reRecNum !== null}>
            Démarrer la saisie →
          </button>
        </div>
      )}
    </div>
  );
}
