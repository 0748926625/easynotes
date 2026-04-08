import { useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export default function Upload({ onStudentsLoaded }) {
  const inputRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processRows(result.data),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        processRows(data);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert("Format non supporté. Utilisez .xlsx ou .csv");
    }
  }

  function processRows(rows) {
    if (!rows || rows.length === 0) {
      alert("Fichier vide ou non lisible.");
      return;
    }

    // Détection flexible des colonnes Nom / Prénom
    const colNom = findCol(rows[0], ["nom", "name", "lastname", "last_name"]);
    const colPrenom = findCol(rows[0], ["prénom", "prenom", "firstname", "first_name", "prenom"]);

    if (!colNom || !colPrenom) {
      alert(
        `Colonnes 'Nom' et 'Prénom' introuvables.\nColonnes trouvées : ${Object.keys(rows[0]).join(", ")}`
      );
      return;
    }

    const students = rows.map((row, i) => ({
      id: i,
      nom: String(row[colNom]).trim(),
      prenom: String(row[colPrenom]).trim(),
      notes: [],
      average: null,
      rank: null,
    }));

    onStudentsLoaded(students);
  }

  function findCol(row, candidates) {
    const keys = Object.keys(row);
    for (const key of keys) {
      if (candidates.includes(key.toLowerCase().trim())) return key;
    }
    return null;
  }

  return (
    <div className="upload-container">
      <div className="upload-box" onClick={() => inputRef.current.click()}>
        <div className="upload-icon">📂</div>
        <p className="upload-label">Importer la liste des élèves</p>
        <p className="upload-hint">Cliquez pour choisir un fichier .xlsx ou .csv</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      <div className="upload-example">
        <p>Format attendu :</p>
        <table>
          <thead>
            <tr><th>Nom</th><th>Prénom</th></tr>
          </thead>
          <tbody>
            <tr><td>Dupont</td><td>Alice</td></tr>
            <tr><td>Martin</td><td>Bob</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
