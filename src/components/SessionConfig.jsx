import { useState } from "react";
import { NOTE_TYPES } from "../utils/calculations";

export default function SessionConfig({ students, onStart }) {
  const [classe, setClasse] = useState("");
  const [noteCount, setNoteCount] = useState(1);
  const [noteConfigs, setNoteConfigs] = useState([{ typeId: 2, label: "Note 1" }]);
  const [mode, setMode] = useState("simple"); // "simple" | "multiple" | "inverse"

  function updateNoteCount(n) {
    n = Math.max(1, Math.min(10, parseInt(n) || 1));
    setNoteCount(n);
    setNoteConfigs((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ typeId: 2, label: `Note ${next.length + 1}` });
      return next.slice(0, n);
    });
  }

  function updateNoteType(i, typeId) {
    setNoteConfigs((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, typeId: parseInt(typeId) } : c))
    );
  }

  function handleStart() {
    if (!classe.trim()) {
      alert("Veuillez saisir le nom de la classe.");
      return;
    }
    const types = noteConfigs.map((c) => NOTE_TYPES.find((t) => t.id === c.typeId));
    onStart({ classe: classe.trim(), noteTypes: types, mode });
  }

  return (
    <div className="session-config">
      <h2>Configuration de la session</h2>

      <div className="config-block">
        <label>Classe</label>
        <input
          type="text"
          placeholder="ex: 6ème 1"
          value={classe}
          onChange={(e) => setClasse(e.target.value)}
        />
      </div>

      <div className="config-block">
        <label>Nombre de notes</label>
        <input
          type="number"
          min={1}
          max={10}
          value={noteCount}
          onChange={(e) => updateNoteCount(e.target.value)}
        />
      </div>

      <div className="config-block">
        <label>Type de chaque note</label>
        <div className="note-types-list">
          {noteConfigs.map((c, i) => (
            <div key={i} className="note-type-row">
              <span>Note {i + 1}</span>
              <select value={c.typeId} onChange={(e) => updateNoteType(i, e.target.value)}>
                {NOTE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (coef {t.coef})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="config-block">
        <label>Mode de saisie</label>
        <div className="mode-selector">
          <button
            className={mode === "simple" ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode("simple")}
          >
            Mode simple<br />
            <small>Une note à la fois</small>
          </button>
          <button
            className={mode === "multiple" ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode("multiple")}
          >
            Mode multiple<br />
            <small>Toutes les notes d'un coup</small>
          </button>
          <button
            className={mode === "inverse" ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode("inverse")}
          >
            Mode inversé<br />
            <small>Tu dis le nom, tu entres la note</small>
          </button>
        </div>
      </div>

      <div className="config-summary">
        <strong>{students.length} élèves</strong> importés &bull; {noteCount} note(s) &bull; Classe : {classe || "—"}
      </div>

      <button className="btn-start" onClick={handleStart}>
        Démarrer la saisie →
      </button>
    </div>
  );
}
