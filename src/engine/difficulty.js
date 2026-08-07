export const STOCKFISH_MIN_ELO = 1320;
export const STOCKFISH_MAX_ELO = 3190;

export const DIFFICULTY_LEVELS = Object.freeze([
  { id: 1, nameEn: "Beginner", nameEl: "Αρχάριος", elo: 1320, displayElo: "1320" },
  { id: 2, nameEn: "Novice", nameEl: "Νέος παίκτης", elo: 1400, displayElo: "1400" },
  { id: 3, nameEn: "Intermediate", nameEl: "Μέτριος", elo: 1500, displayElo: "1500" },
  { id: 4, nameEn: "Club Player", nameEl: "Παίκτης συλλόγου", elo: 1650, displayElo: "1650" },
  { id: 5, nameEn: "Strong Club Player", nameEl: "Ισχυρός παίκτης συλλόγου", elo: 1800, displayElo: "1800" },
  { id: 6, nameEn: "Expert", nameEl: "Ειδικός", elo: 2000, displayElo: "2000" },
  { id: 7, nameEn: "Candidate Master (CM) level", nameEl: "Επίπεδο Υποψήφιου Μαίτρ (CM)", elo: 2200, displayElo: "2200" },
  { id: 8, nameEn: "FIDE Master (FM) level", nameEl: "Επίπεδο Μαίτρ FIDE (FM)", elo: 2300, displayElo: "2300" },
  { id: 9, nameEn: "International Master (IM) level", nameEl: "Επίπεδο Διεθνούς Μαίτρ (IM)", elo: 2400, displayElo: "2400" },
  { id: 10, nameEn: "Grandmaster (GM) level", nameEl: "Επίπεδο Γκρανμέτρ (GM)", elo: 2500, displayElo: "2500" },
  { id: 11, nameEn: "Super-GM level", nameEl: "Επίπεδο κορυφαίου γκρανμέτρ", elo: 2700, displayElo: "2700" },
  {
    id: 12,
    nameEn: "Engines Level",
    nameEl: "Επίπεδο μηχανών",
    elo: STOCKFISH_MAX_ELO,
    displayElo: "2900+",
  },
]);

export function getDifficultyProfile(id) {
  return DIFFICULTY_LEVELS.find((level) => level.id === Number(id)) || DIFFICULTY_LEVELS[4];
}

export function normalizeStockfishElo(value) {
  const elo = Number(value);
  if (!Number.isFinite(elo)) return STOCKFISH_MIN_ELO;
  return Math.min(STOCKFISH_MAX_ELO, Math.max(STOCKFISH_MIN_ELO, Math.round(elo)));
}
