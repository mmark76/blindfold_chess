// All strings in English

const numberWords = new Map([
  ["one", "1"], ["two", "2"], ["three", "3"], ["four", "4"],
  ["five", "5"], ["six", "6"], ["seven", "7"], ["eight", "8"]
]);

const pieceWords = new Map([
  ["knight", "N"],
  ["bishop", "B"],
  ["rook", "R"],
  ["queen", "Q"],
  ["king", "K"]
]);

const promoWords = new Map([
  ["queen", "Q"],
  ["rook", "R"],
  ["bishop", "B"],
  ["knight", "N"]
]);

function normToken(t) {
  let s = (t || "").toLowerCase().trim();
  s = s.replace(/[^a-z0-9]/g, "");
  if (numberWords.has(s)) return numberWords.get(s);
  return s;
}

function isFile(t) {
  return typeof t === "string" && /^[a-h]$/.test(t);
}

function isRank(t) {
  return typeof t === "string" && /^[1-8]$/.test(t);
}

function toSquare(file, rank) {
  if (!isFile(file) || !isRank(rank)) return "";
  return `${file}${rank}`;
}

export function sanFromSpeech(raw) {
  if (!raw) return "";

  const cleaned = raw
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Castling
  if (
    cleaned.includes("castle") &&
    (cleaned.includes("king side") || cleaned.includes("kingside") || cleaned.includes("short"))
  ) return "O-O";
  if (
    cleaned.includes("castle") &&
    (cleaned.includes("queen side") || cleaned.includes("queenside") || cleaned.includes("long"))
  ) return "O-O-O";
  if (cleaned === "o o" || cleaned === "oo" || cleaned === "o-o") return "O-O";
  if (cleaned === "o o o" || cleaned === "ooo" || cleaned === "o-o-o") return "O-O-O";

  const tokens = cleaned.split(" ").map(normToken).filter(Boolean);

  const hasMate = tokens.includes("checkmate") || tokens.includes("mate");
  const hasCheck = tokens.includes("check") || hasMate;

  // Promotion parsing (basic)
  let promo = "";
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "promote" || tokens[i] === "promotion" || tokens[i] === "promotes") {
      for (let j = i; j < Math.min(i + 4, tokens.length); j++) {
        const p = tokens[j];
        if (promoWords.has(p)) promo = `=${promoWords.get(p)}`;
      }
    }
  }

  const takesIdx = tokens.findIndex((t) => t === "takes" || t === "capture" || t === "captures" || t === "x");
  const isCapture = takesIdx !== -1;

  // Pawn move: "e four" -> "e4"
  if (tokens.length >= 2 && isFile(tokens[0]) && isRank(tokens[1])) {
    let san = toSquare(tokens[0], tokens[1]);

    if (!promo && tokens.length >= 3 && promoWords.has(tokens[2])) {
      promo = `=${promoWords.get(tokens[2])}`;
    }
    san += promo;

    if (hasMate) san += "#";
    else if (hasCheck) san += "+";
    return san;
  }

  // Pawn capture: "d takes e five" -> "dxe5"
  if (
    tokens.length >= 4 &&
    isFile(tokens[0]) &&
    isCapture &&
    isFile(tokens[takesIdx + 1]) &&
    isRank(tokens[takesIdx + 2])
  ) {
    const fromFile = tokens[0];
    const sq = toSquare(tokens[takesIdx + 1], tokens[takesIdx + 2]);
    if (sq) {
      let san = `${fromFile}x${sq}${promo}`;
      if (hasMate) san += "#";
      else if (hasCheck) san += "+";
      return san;
    }
  }

  // Piece move/capture: "knight f three" -> "Nf3", "bishop takes e five" -> "Bxe5"
  const pieceIdx = tokens.findIndex((t) => pieceWords.has(t));
  if (pieceIdx !== -1) {
    const P = pieceWords.get(tokens[pieceIdx]);

    let dest = "";
    for (let i = 0; i < tokens.length - 1; i++) {
      if (isFile(tokens[i]) && isRank(tokens[i + 1])) dest = toSquare(tokens[i], tokens[i + 1]);
    }
    if (!dest) return "";

    let san = P + (isCapture ? "x" : "") + dest + promo;
    if (hasMate) san += "#";
    else if (hasCheck) san += "+";
    return san;
  }

  // Fallback: already-SAN-ish
  const fallback = cleaned.replace(/\s+/g, "").replace(/[^a-z0-9x\+\#\=\-o]/gi, "");
  return fallback || "";
}
