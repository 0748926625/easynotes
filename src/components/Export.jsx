import * as XLSX from "xlsx";
import { enrichStudents } from "../utils/calculations";

export default function Export({ students, session, onRestart }) {
  const { noteTypes, classe } = session;
  const enriched = enrichStudents(students, noteTypes);

  function handleExport() {
    const rows = enriched.map((s, i) => {
      const row = {
        "#": i + 1,
        Nom: s.nom,
        Prénom: s.prenom,
      };
      noteTypes.forEach((t, ni) => {
        row[`Note ${ni + 1} (${t.label})`] = s.notes[ni] ?? "";
      });
      row["Moyenne /20"] = s.average ?? "";
      row["Rang"] = s.rank ?? "";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notes");

    // Style largeur colonnes
    const colWidths = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length, 12) }));
    ws["!cols"] = colWidths;

    const filename = `notes_${classe.replace(/\s+/g, "_")}_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  const avg =
    enriched.filter((s) => s.average !== null).reduce((sum, s) => sum + s.average, 0) /
    (enriched.filter((s) => s.average !== null).length || 1);

  return (
    <div className="export-view">
      <h2>Récapitulatif — {classe}</h2>

      <div className="export-stats">
        <div className="stat-card">
          <div className="stat-val">{enriched.length}</div>
          <div className="stat-lbl">Élèves</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{isNaN(avg) ? "—" : avg.toFixed(2)}</div>
          <div className="stat-lbl">Moyenne classe</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{noteTypes.length}</div>
          <div className="stat-lbl">Notes saisies</div>
        </div>
      </div>

      <div className="export-table-wrapper">
        <table className="export-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nom</th>
              <th>Prénom</th>
              {noteTypes.map((t, i) => (
                <th key={i}>N{i + 1}<br/><small>{t.label}</small></th>
              ))}
              <th>Moy.</th>
              <th>Rang</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.nom}</td>
                <td>{s.prenom}</td>
                {noteTypes.map((_, ni) => (
                  <td key={ni}>{s.notes[ni] ?? "—"}</td>
                ))}
                <td className="td-avg">{s.average ?? "—"}</td>
                <td className="td-rank">{s.rank ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="export-actions">
        <button className="btn-export" onClick={handleExport}>
          Télécharger Excel (.xlsx)
        </button>
        <button className="btn-restart" onClick={onRestart}>
          Nouvelle session
        </button>
      </div>
    </div>
  );
}
