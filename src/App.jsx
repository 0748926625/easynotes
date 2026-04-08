import { useState, useEffect } from "react";
import Upload from "./components/Upload";
import SessionConfig from "./components/SessionConfig";
import Calibration, { loadVoiceMap } from "./components/Calibration";
import VoiceInput from "./components/VoiceInput";
import Export from "./components/Export";
import "./App.css";

const STORAGE_KEY = "easynotes_session";
const STORAGE_VERSION = 2; // incrémenter si on change la structure
const VALID_STEPS = ["upload", "config", "calibration", "saisie", "export"];

function App() {
  const [step, setStep] = useState("upload");
  const [students, setStudents] = useState([]);
  const [session, setSession] = useState(null);
  const [finalStudents, setFinalStudents] = useState([]);
  const [voiceMap, setVoiceMap] = useState(() => loadVoiceMap());

  // Restauration depuis localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { version, step: s, students: st, session: se, finalStudents: fs } = JSON.parse(saved);
        // Invalider si version ancienne ou step inconnu
        if (version !== STORAGE_VERSION || !VALID_STEPS.includes(s)) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        if (st && st.length > 0) {
          setStep(s);
          setStudents(st);
          if (se) setSession(se);
          if (fs) setFinalStudents(fs);
        }
      }
    } catch (_) {}
  }, []);

  // Sauvegarde automatique
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, step, students, session, finalStudents })
      );
    } catch (_) {}
  }, [step, students, session, finalStudents]);

  function handleStudentsLoaded(list) {
    setStudents(list);
    setStep("config");
  }

  function handleSessionStart(config) {
    setSession(config);
    setStep("calibration");
  }

  function handleCalibrationDone(map) {
    setVoiceMap(map);
    setStep("saisie");
  }

  function handleCalibrationSkip() {
    setStep("saisie");
  }

  function handleUpdate(updated) {
    setFinalStudents(updated);
  }

  function handleFinish() {
    setStep("export");
  }

  function handleRestart() {
    localStorage.removeItem(STORAGE_KEY);
    setStep("upload");
    setStudents([]);
    setSession(null);
    setFinalStudents([]);
  }

  const STEPS = ["upload", "config", "calibration", "saisie", "export"];
  const STEP_LABELS = ["Import", "Config", "Voix", "Saisie", "Export"];
  const currentStepIdx = STEPS.indexOf(step);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">📝</span>
          <div>
            <h1 className="app-title">EasyNotes</h1>
            <p className="app-subtitle">Saisie vocale des notes</p>
          </div>
        </div>
        {step !== "upload" && (
          <button className="btn-new" onClick={handleRestart}>
            ✕ Nouvelle session
          </button>
        )}
      </header>

      <nav className="app-steps">
        {STEPS.map((s, i) => (
          <div key={s} className="step-item">
            <div
              className={[
                "step-dot",
                step === s ? "step-active" : "",
                currentStepIdx > i ? "step-done" : "",
              ].join(" ")}
            >
              {currentStepIdx > i ? "✓" : i + 1}
            </div>
            <span className="step-label">{STEP_LABELS[i]}</span>
            {i < STEPS.length - 1 && <div className="step-line" />}
          </div>
        ))}
      </nav>

      <main className="app-main">
        {step === "upload" && (
          <Upload onStudentsLoaded={handleStudentsLoaded} />
        )}
        {step === "config" && (
          <SessionConfig students={students} onStart={handleSessionStart} />
        )}
        {step === "calibration" && (
          <Calibration
            onDone={handleCalibrationDone}
            onSkip={handleCalibrationSkip}
          />
        )}
        {step === "saisie" && session && (
          <VoiceInput
            students={students}
            session={session}
            voiceMap={voiceMap}
            onUpdate={handleUpdate}
            onFinish={handleFinish}
          />
        )}
        {step === "export" && session && (
          <Export
            students={finalStudents.length > 0 ? finalStudents : students}
            session={session}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}

export default App;
