// Coefficient par type de note
export const NOTE_TYPES = [
  { id: 1, label: "Interrogation /10", max: 10, coef: 0.5 },
  { id: 2, label: "Interrogation /20", max: 20, coef: 1 },
  { id: 3, label: "Devoir /20", max: 20, coef: 2 },
];

// Calcule la moyenne pondérée d'un élève
export function computeAverage(notes, noteTypes) {
  let sumWeighted = 0;
  let sumCoef = 0;

  notes.forEach((note, i) => {
    if (note === null || note === undefined || note === "") return;
    const type = noteTypes[i];
    if (!type) return;
    const coef = type.coef;
    // Ramener toutes les notes sur /20
    const on20 = type.max === 10 ? note * 2 : note;
    sumWeighted += on20 * coef;
    sumCoef += coef;
  });

  if (sumCoef === 0) return null;
  return Math.round((sumWeighted / sumCoef) * 100) / 100;
}

// Calcule les rangs de tous les élèves (1 = meilleur)
export function computeRanks(students) {
  const withAvg = students.map((s, i) => ({ index: i, avg: s.average }));
  withAvg.sort((a, b) => {
    if (b.avg === null) return -1;
    if (a.avg === null) return 1;
    return b.avg - a.avg;
  });

  const ranks = new Array(students.length).fill(null);
  withAvg.forEach((item, pos) => {
    ranks[item.index] = item.avg !== null ? pos + 1 : null;
  });
  return ranks;
}

// Applique moyennes + rangs à la liste des élèves
export function enrichStudents(students, noteTypes) {
  const enriched = students.map((s) => ({
    ...s,
    average: computeAverage(s.notes, noteTypes),
  }));
  const ranks = computeRanks(enriched);
  return enriched.map((s, i) => ({ ...s, rank: ranks[i] }));
}
