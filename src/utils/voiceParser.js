// Table principale : mot → valeur
const WORDS = {
  // zéro
  "zero": 0, "zaro": 0, "zéro": 0, "0": 0,
  // 1 — accent ivoirien : "un" → "on", "han", "in", "hein"
  "un": 1, "une": 1, "1": 1, "on": 1, "han": 1, "hein": 1, "hin": 1,
  // 2 — accent ivoirien : "deux" → "dé", "de" (retiré du bruit), "do"
  "deux": 2, "deu": 2, "2": 2, "de": 2, "do": 2,
  // 3 — accent ivoirien : "trois" → "twa", "trwa", "troi"
  "trois": 3, "troi": 3, "3": 3, "twa": 3, "troix": 3, "trwa": 3, "trois": 3,
  // 4
  "quatre": 4, "katre": 4, "4": 4, "kat": 4, "catre": 4, "katr": 4,
  // 5 — accent ivoirien : "cinq" → "senk", "sin"
  "cinq": 5, "sank": 5, "saint": 5, "5": 5, "sink": 5, "sang": 5, "senk": 5, "sin": 5,
  // 6 — accent ivoirien : "six" → "si", "sis"
  "six": 6, "sis": 6, "6": 6, "si": 6,
  // 7 — accent ivoirien : "sept" → "set", "sète"
  "sept": 7, "sète": 7, "set": 7, "sete": 7, "7": 7, "sait": 7,
  // 8 — accent ivoirien : "huit" → "wit", "oui", "ui"
  "huit": 8, "uit": 8, "huite": 8, "8": 8, "hutte": 8, "wit": 8, "oui": 8, "ui": 8,
  // 9 — accent ivoirien : "neuf" → "nef", "nœf"
  "neuf": 9, "noeuf": 9, "9": 9, "neu": 9, "neuve": 9, "nef": 9,
  // 10 — accent ivoirien : "dix" → "di", "dis"
  "dix": 10, "dis": 10, "10": 10, "dice": 10, "dise": 10, "di": 10,
  // 11
  "onze": 11, "once": 11, "11": 11, "honze": 11,
  // 12
  "douze": 12, "douz": 12, "12": 12, "douce": 12,
  // 13
  "treize": 13, "trèze": 13, "13": 13, "treze": 13, "treiz": 13,
  // 14
  "quatorze": 14, "katorze": 14, "14": 14, "katorz": 14, "qatorze": 14,
  // 15
  "quinze": 15, "kenz": 15, "15": 15, "kinze": 15, "quinz": 15,
  // 16
  "seize": 16, "sèze": 16, "16": 16, "seze": 16, "seiz": 16,
  // 17
  "dix-sept": 17, "dix sept": 17, "dixsept": 17, "17": 17,
  "dis sept": 17, "dis-sept": 17, "di sept": 17,
  // 18
  "dix-huit": 18, "dix huit": 18, "dixhuit": 18, "dis huit": 18, "18": 18,
  "dis-huit": 18, "di huit": 18, "dix-huite": 18,
  // 19
  "dix-neuf": 19, "dix neuf": 19, "dixneuf": 19, "dis neuf": 19, "19": 19,
  "dis-neuf": 19, "di neuf": 19, "dix-neu": 19,
  // 20 — accent ivoirien : "vingt" → "ving", "van", "ven"
  "vingt": 20, "ving": 20, "van": 20, "20": 20, "vint": 20, "vent": 20, "vain": 20, "ven": 20,
};

// Mots à ignorer dans une phrase pour chercher le nombre dedans
const NOISE = new Set([
  "la", "le", "les", "du", "des", "est", "note", "notes",
  "c'est", "j'ai", "dit", "euh", "heu", "ah", "oh", "alors",
  "ma", "mon", "sa", "son", "il", "elle",
  // "de" retiré : peut être la transcription de "deux" avec accent ivoirien
]);

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprime accents
    .replace(/[''`'']/g, "")
    .replace(/\s+/g, " ");
}

function lookupWord(w) {
  const key = normalize(w);
  if (WORDS[key] !== undefined) return WORDS[key];
  return null;
}

// Tente de parser une chaîne en un seul nombre (entier ou décimal)
export function parseVoiceToNumber(raw) {
  if (!raw) return null;
  const text = normalize(raw);

  // Lookup direct
  const direct = lookupWord(text);
  if (direct !== null) return direct;

  // Chiffre numérique (avec virgule ou point)
  const asFloat = parseFloat(text.replace(",", "."));
  if (!isNaN(asFloat)) return asFloat;

  // Décimale : "X virgule cinq" / "X point cinq" / "X et demi" / "X et cinq"
  const decimalMatch = text.match(
    /^(.+?)\s+(?:virgule|point|et)\s+(.+)$/
  );
  if (decimalMatch) {
    const intPart = lookupWord(decimalMatch[1]);
    const rawDec  = decimalMatch[2].trim();
    if (intPart !== null) {
      if (rawDec === "demi" || rawDec === "demie") return intPart + 0.5;
      const decPart = lookupWord(rawDec);
      if (decPart !== null && decPart < 10) {
        return parseFloat(`${intPart}.${decPart}`);
      }
    }
  }

  // "X cinq" sans mot-clé (deux tokens, deuxième = demi-point)
  const twoTokens = text.match(/^(\S+)\s+(\S+)$/);
  if (twoTokens) {
    const intPart = lookupWord(twoTokens[1]);
    const decPart = lookupWord(twoTokens[2]);
    if (intPart !== null && decPart !== null && decPart < 10) {
      return parseFloat(`${intPart}.${decPart}`);
    }
  }

  // Chercher un nombre caché dans la phrase en ignorant les mots parasites
  const tokens = text.split(/\s+/);

  // 2 tokens consécutifs (ex: "dix sept" au milieu d'une phrase)
  for (let i = 0; i < tokens.length - 1; i++) {
    const combined = tokens[i] + " " + tokens[i + 1];
    const val = lookupWord(combined);
    if (val !== null) return val;
  }

  // 1 token en filtrant le bruit
  const meaningful = tokens.filter(t => !NOISE.has(t));
  for (const token of meaningful) {
    const val = lookupWord(token);
    if (val !== null) return val;
  }

  return null;
}

// Parse plusieurs notes depuis une seule phrase : "8 12 15" ou "huit douze quinze"
export function parseMultipleNotes(raw) {
  if (!raw) return [];
  const text = normalize(raw);

  // Séparateurs forts : virgule, point-virgule, slash, "et"
  // On découpe d'abord sur ces séparateurs pour éviter de combiner
  // des nombres distincts (ex: "un, deux" ne doit pas devenir 1.2)
  const segments = text.split(/[,;\/]|\s+et\s+/).map(s => s.trim()).filter(Boolean);

  const results = [];

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length) {
      // Nombres composés uniquement : "dix sept", "dix huit", "dix neuf"
      // (pas de logique décimale ici — en mode multi-notes, deux tokens
      // consécutifs sont toujours deux notes distinctes)
      if (i + 1 < tokens.length) {
        const combined = tokens[i] + " " + tokens[i + 1];
        const val = lookupWord(combined);
        if (val !== null) {
          results.push(val);
          i += 2;
          continue;
        }
      }

      if (!NOISE.has(tokens[i])) {
        const val = parseVoiceToNumber(tokens[i]);
        if (val !== null) results.push(val);
      }
      i++;
    }
  }
  return results;
}

// Essaie de parser parmi plusieurs alternatives (résultats SpeechRecognition)
export function parseBestAlternative(alternatives, voiceMap = {}) {
  for (let i = 0; i < alternatives.length; i++) {
    const text = alternatives[i].transcript;
    const normalized = normalize(text);

    // 1. Carte personnelle en priorité
    if (voiceMap[normalized] !== undefined) {
      return { value: voiceMap[normalized], text };
    }

    // 2. Parser standard
    const val = parseVoiceToNumber(text);
    if (val !== null) return { value: val, text };
  }
  return null;
}

// Cherche l'élève dont le nom correspond le mieux au texte prononcé
// Retourne l'index dans le tableau students, ou -1 si aucun match
export function findStudent(spoken, students) {
  if (!spoken || !students.length) return -1;
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const spk = norm(spoken);

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const candidates = [
      norm(`${s.nom} ${s.prenom}`),
      norm(`${s.prenom} ${s.nom}`),
      norm(s.nom),
      norm(s.prenom),
    ];

    for (const cand of candidates) {
      if (spk === cand) return i; // correspondance parfaite

      // Score par tokens communs
      const spTokens = spk.split(/\s+/);
      const cTokens  = cand.split(/\s+/);
      let hits = 0;
      for (const st of spTokens) {
        if (cTokens.some(ct => ct.includes(st) || st.includes(ct))) hits++;
      }
      const score = hits / Math.max(spTokens.length, cTokens.length);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
  }

  return bestScore >= 0.5 ? bestIdx : -1;
}

export function parseMultipleBestAlternative(alternatives, voiceMap = {}) {
  for (let i = 0; i < alternatives.length; i++) {
    const text = alternatives[i].transcript;
    const normalized = normalize(text);

    // 1. Carte personnelle exacte
    if (voiceMap[normalized] !== undefined) {
      return { values: [voiceMap[normalized]], text };
    }

    // 2. Essai token par token avec voiceMap
    const parts = normalized.split(/[,;\s]+/).filter(Boolean);
    const fromMap = parts.map(p => voiceMap[p]).filter(v => v !== undefined);
    if (fromMap.length > 0) return { values: fromMap, text };

    // 3. Parser standard
    const vals = parseMultipleNotes(text);
    if (vals.length > 0) return { values: vals, text };
  }
  return null;
}
