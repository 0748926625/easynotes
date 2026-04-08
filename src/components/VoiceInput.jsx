import { useState, useEffect, useRef, useCallback } from "react";
import { parseBestAlternative, parseMultipleBestAlternative, findStudent } from "../utils/voiceParser";
import { enrichStudents } from "../utils/calculations";
import { useWhisper } from "../context/WhisperContext";
import { beep } from "../utils/beep";

export default function VoiceInput({ students, session, voiceMap = {}, onUpdate, onFinish }) {
  const { noteTypes, mode, classe } = session;

  const [studentIndex, setStudentIndex] = useState(0);
  const [noteIndex, setNoteIndex]       = useState(0);
  // phase : idle | speaking | recording | ok | error | paused
  const [phase, setPhase]               = useState("idle");
  // en mode inversé : "name" = on attend le nom, "note" = on attend la note
  const [inverseStep, setInverseStep]   = useState("name");
  const [transcript, setTranscript]     = useState("");
  const [paused, setPaused]             = useState(false);
  const [started, setStarted]           = useState(false);
  const [localStudents, setLocalStudents] = useState(() =>
    students.map((s) => ({ ...s, notes: new Array(noteTypes.length).fill(null) }))
  );

  const studentIndexRef  = useRef(0);
  const noteIndexRef     = useRef(0);
  const pausedRef        = useRef(false);
  const localStudentsRef = useRef(localStudents);
  const synthRef         = useRef(window.speechSynthesis);
  const announceRef      = useRef(null);

  const { startRecording, stopRecording } = useWhisper();

  useEffect(() => {
    localStudentsRef.current = localStudents;
    onUpdate(enrichStudents(localStudents, noteTypes));
  }, [localStudents]);

  function setStudentIndexBoth(v) { studentIndexRef.current = v; setStudentIndex(v); }
  function setNoteIndexBoth(v)    { noteIndexRef.current = v;    setNoteIndex(v); }

  const speak = useCallback((text, onEnd) => {
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fr-FR";
    utt.rate = 1.1;
    if (onEnd) utt.onend = onEnd;
    synthRef.current.speak(utt);
  }, []);

  // ── Enregistrement automatique ────────────────────────────────────────────────

  const listenForNote = useCallback(() => {
    if (pausedRef.current) return;
    beep.start();
    setPhase("recording");
    setTranscript("…");

    startRecording(
      (text, alternatives) => {
        const alts = alternatives || [{ transcript: text, confidence: 1 }];
        setTranscript(alts[0].transcript);
        handleNoteTranscript(text, alts);
      },
      (err) => {
        if (err === "no-speech") {
          if (!pausedRef.current) listenForNote();
          return;
        }
        beep.error();
        setPhase("error");
        setTranscript("Non reconnu");
        setTimeout(() => { if (!pausedRef.current) listenForNote(); }, 800);
      }
    );
  }, [startRecording]);

  const listenForName = useCallback(() => {
    if (pausedRef.current) return;
    beep.start();
    setPhase("recording");
    setTranscript("…");

    startRecording(
      (text) => {
        const raw = text.split("|")[0];
        setTranscript(raw);
        handleNameTranscript(raw);
      },
      (err) => {
        if (err === "no-speech") {
          if (!pausedRef.current) listenForName();
          return;
        }
        beep.error();
        setPhase("error");
        setTranscript("Non reconnu");
        setTimeout(() => { if (!pausedRef.current) listenForName(); }, 800);
      }
    );
  }, [startRecording]);

  // ── Annonce + démarrage ───────────────────────────────────────────────────────

  const announceStudent = useCallback((sIdx, nIdx) => {
    if (pausedRef.current) return;
    const student = localStudentsRef.current[sIdx];
    if (!student) return;
    let text = `${student.nom} ${student.prenom}`;
    if (mode === "simple" && noteTypes.length > 1) text += `, note ${nIdx + 1}`;
    setPhase("speaking");
    speak(text, () => { if (!pausedRef.current) listenForNote(); });
  }, [mode, noteTypes, speak, listenForNote]);

  announceRef.current = announceStudent;

  useEffect(() => {
    if (!started) return;
    if (mode === "inverse") {
      setInverseStep("name");
      listenForName();
    } else {
      const t = setTimeout(() => announceRef.current(0, 0), 300);
      return () => clearTimeout(t);
    }
  }, [started]);

  // ── Mode inversé : reconnaissance du nom ─────────────────────────────────────

  function handleNameTranscript(raw) {
    const idx = findStudent(raw, localStudentsRef.current);
    if (idx === -1) {
      beep.error();
      setPhase("error");
      setTranscript(`"${raw}" — élève non trouvé`);
      setTimeout(() => { if (!pausedRef.current) listenForName(); }, 1200);
      return;
    }
    studentIndexRef.current = idx;
    setStudentIndex(idx);
    const notes = localStudentsRef.current[idx].notes;
    const nIdx  = notes.findIndex(n => n === null);
    if (nIdx === -1) {
      beep.error();
      setPhase("error");
      const s = localStudentsRef.current[idx];
      setTranscript(`${s.prenom} ${s.nom} — déjà complet`);
      setTimeout(() => { if (!pausedRef.current) listenForName(); }, 1500);
      return;
    }
    noteIndexRef.current = nIdx;
    setNoteIndex(nIdx);
    beep.success();
    setInverseStep("note");
    const s = localStudentsRef.current[idx];
    const label = noteTypes.length > 1 ? `, note ${nIdx + 1}` : "";
    setPhase("speaking");
    speak(`${s.prenom} ${s.nom}${label}`, () => {
      if (!pausedRef.current) listenForNote();
    });
  }

  // ── Traitement de la note ─────────────────────────────────────────────────────

  function handleNoteTranscript(text, alternatives) {
    const sIdx = studentIndexRef.current;
    const nIdx = noteIndexRef.current;

    if (mode === "simple" || mode === "inverse") {
      const result = parseBestAlternative(alternatives, voiceMap);
      const type   = noteTypes[nIdx];

      if (!result || result.value < 0 || result.value > type.max) {
        beep.error();
        setPhase("error");
        setTranscript(`"${alternatives[0].transcript}" — non reconnu`);
        setTimeout(() => { if (!pausedRef.current) listenForNote(); }, 800);
        return;
      }

      beep.success();
      setPhase("ok");
      setTranscript(`${result.value}`);

      saveNote(sIdx, nIdx, result.value, () => {
        setTimeout(() => {
          if (pausedRef.current) return;

          if (mode === "inverse") {
            // Vérifier s'il reste des notes pour cet élève
            const notes    = localStudentsRef.current[sIdx].notes;
            const nextNIdx = notes.findIndex(n => n === null);
            if (nextNIdx !== -1 && noteTypes.length > 1) {
              noteIndexRef.current = nextNIdx;
              setNoteIndex(nextNIdx);
              setPhase("speaking");
              speak(`Note ${nextNIdx + 1}`, () => {
                if (!pausedRef.current) listenForNote();
              });
            } else {
              // Retour à la saisie du nom
              setInverseStep("name");
              listenForName();
            }
          } else {
            // Mode simple : avancer séquentiellement
            const nextNI = nIdx + 1;
            if (nextNI < noteTypes.length) {
              setNoteIndexBoth(nextNI);
              announceRef.current(sIdx, nextNI);
            } else {
              const nextSI = sIdx + 1;
              if (nextSI >= localStudentsRef.current.length) { onFinish(); }
              else { setNoteIndexBoth(0); setStudentIndexBoth(nextSI); announceRef.current(nextSI, 0); }
            }
          }
        }, 500);
      });

    } else {
      // mode === "multiple"
      const result = parseMultipleBestAlternative(alternatives, voiceMap);
      const valid  = result && result.values.length > 0 && result.values.every((n, i) => {
        const type = noteTypes[i];
        return type && n >= 0 && n <= type.max;
      });

      if (!valid) {
        beep.error();
        setPhase("error");
        setTranscript(`"${alternatives[0].transcript}" — non reconnu`);
        setTimeout(() => { if (!pausedRef.current) listenForNote(); }, 800);
        return;
      }

      beep.success();
      setPhase("ok");
      setTranscript(result.values.join(", "));

      saveAllNotes(sIdx, result.values, () => {
        setTimeout(() => {
          if (pausedRef.current) return;
          const nextSI = sIdx + 1;
          if (nextSI >= localStudentsRef.current.length) { onFinish(); }
          else { setStudentIndexBoth(nextSI); announceRef.current(nextSI, 0); }
        }, 500);
      });
    }
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  function saveNote(sIdx, nIdx, value, cb) {
    setLocalStudents((prev) => {
      const next = prev.map((s, i) => {
        if (i !== sIdx) return s;
        const notes = [...s.notes]; notes[nIdx] = value;
        return { ...s, notes };
      });
      localStudentsRef.current = next;
      return next;
    });
    setTimeout(cb, 80);
  }

  function saveAllNotes(sIdx, values, cb) {
    setLocalStudents((prev) => {
      const next = prev.map((s, i) => {
        if (i !== sIdx) return s;
        return { ...s, notes: values.slice(0, noteTypes.length) };
      });
      localStudentsRef.current = next;
      return next;
    });
    setTimeout(cb, 80);
  }

  function manualEdit(sIdx, nIdx, value) {
    const parsed = parseFloat(value);
    setLocalStudents((prev) =>
      prev.map((s, i) => {
        if (i !== sIdx) return s;
        const notes = [...s.notes];
        notes[nIdx] = isNaN(parsed) ? null : parsed;
        return { ...s, notes };
      })
    );
  }

  // ── Contrôles ────────────────────────────────────────────────────────────────

  function togglePause() {
    if (paused) {
      pausedRef.current = false;
      setPaused(false);
      if (mode === "inverse" && inverseStep === "name") listenForName();
      else announceRef.current(studentIndexRef.current, noteIndexRef.current);
    } else {
      pausedRef.current = true;
      setPaused(true);
      setPhase("paused");
      synthRef.current.cancel();
      stopRecording();
    }
  }

  function skipStudent() {
    synthRef.current.cancel();
    stopRecording();
    if (mode === "inverse") {
      setInverseStep("name");
      setTimeout(() => { if (!pausedRef.current) listenForName(); }, 200);
      return;
    }
    const nextIdx = studentIndexRef.current + 1;
    if (nextIdx >= localStudentsRef.current.length) { onFinish(); return; }
    setNoteIndexBoth(0);
    setStudentIndexBoth(nextIdx);
    setTimeout(() => { if (!pausedRef.current) announceRef.current(nextIdx, 0); }, 200);
  }

  function replay() {
    synthRef.current.cancel();
    stopRecording();
    if (mode === "inverse" && inverseStep === "name") {
      setTimeout(() => { if (!pausedRef.current) listenForName(); }, 200);
    } else {
      setTimeout(() => { if (!pausedRef.current) announceRef.current(studentIndexRef.current, noteIndexRef.current); }, 200);
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  const enriched  = enrichStudents(localStudents, noteTypes);
  const total     = localStudents.length;
  const current   = localStudents[studentIndex];
  const phaseIcon = { idle:"⏳", speaking:"🔊", recording:"🎙️", ok:"✅", error:"❌", paused:"⏸️" };

  if (!started) {
    return (
      <div className="voice-input" style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎙️</div>
        <h2 style={{ marginBottom: 8 }}>Prêt à commencer</h2>
        <p style={{ color: "#64748b", marginBottom: 32 }}>
          Appuyez sur le bouton pour activer le microphone et démarrer.
        </p>
        <button className="btn-start" onClick={() => setStarted(true)} style={{ fontSize: "1.1rem", padding: "16px 40px" }}>
          Démarrer →
        </button>
      </div>
    );
  }

  return (
    <div className="voice-input">
      <div className="vi-header">
        <div className="vi-classe">{classe}</div>
        <div className="vi-progress">
          {mode === "inverse"
            ? `${localStudents.filter(s => s.notes.every(n => n !== null)).length} / ${total} complétés`
            : `${Math.min(studentIndex + 1, total)} / ${total}`}
        </div>
      </div>

      <div className="vi-progress-bar">
        <div className="vi-progress-fill" style={{
          width: mode === "inverse"
            ? `${(localStudents.filter(s => s.notes.every(n => n !== null)).length / total) * 100}%`
            : `${(studentIndex / total) * 100}%`
        }} />
      </div>

      {mode === "inverse" ? (
        <div className="vi-current-student">
          {inverseStep === "name" || phase === "recording" && inverseStep === "name" ? (
            <div className="vi-student-name" style={{ color: "#64748b", fontSize: "1rem" }}>
              Dites le nom de l'élève
            </div>
          ) : current ? (
            <>
              <div className="vi-student-name">{current.nom} {current.prenom}</div>
              {noteTypes.length > 1 && (
                <div className="vi-note-label">Note {noteIndex + 1} / {noteTypes.length} — {noteTypes[noteIndex]?.label}</div>
              )}
            </>
          ) : null}
        </div>
      ) : current && (
        <div className="vi-current-student">
          <div className="vi-student-name">{current.nom} {current.prenom}</div>
          {mode === "simple" && noteTypes.length > 1 && (
            <div className="vi-note-label">Note {noteIndex + 1} / {noteTypes.length} — {noteTypes[noteIndex]?.label}</div>
          )}
          {mode === "multiple" && (
            <div className="vi-note-label">Dites toutes les {noteTypes.length} notes d'un coup</div>
          )}
        </div>
      )}

      <div className={`vi-status vi-status-${phase}`}>
        <span className="vi-status-icon">{phaseIcon[phase]}</span>
        <span className="vi-transcript">
          {phase === "speaking"  ? "…"
           : phase === "recording" ? (transcript === "…" ? "Parlez" : transcript)
           : phase === "ok"        ? transcript
           : phase === "error"     ? transcript
           : phase === "paused"    ? "En pause"
           : ""}
        </span>
      </div>

      <div className="vi-controls">
        <button className="btn-pause" onClick={togglePause}>
          {paused ? "▶ Reprendre" : "⏸ Pause"}
        </button>
        <button className="btn-skip" onClick={replay} disabled={paused}>🔄 Relire</button>
        <button className="btn-skip" onClick={skipStudent} disabled={paused}>
          {mode === "inverse" ? "Autre élève" : "Passer →"}
        </button>
      </div>

      <div className="vi-table-wrapper">
        <table className="vi-table">
          <thead>
            <tr>
              <th>#</th><th>Nom</th><th>Prénom</th>
              {noteTypes.map((t, i) => <th key={i}>N{i+1}<br/><small>{t.max}</small></th>)}
              <th>Moy.</th><th>Rang</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((s, si) => (
              <tr key={s.id} className={si === studentIndex ? "vi-row-current" : ""}>
                <td>{si + 1}</td>
                <td>{s.nom}</td>
                <td>{s.prenom}</td>
                {noteTypes.map((t, ni) => (
                  <td key={ni}>
                    <input type="number" min={0} max={t.max} step={0.5}
                      value={s.notes[ni] ?? ""}
                      onChange={(e) => manualEdit(si, ni, e.target.value)}
                      className="note-input"
                    />
                  </td>
                ))}
                <td className="td-avg">{s.average ?? "—"}</td>
                <td className="td-rank">{s.rank ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
