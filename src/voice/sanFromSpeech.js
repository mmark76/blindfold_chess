// Spoken chess moves are expected in English, but browser speech recognition
// frequently returns homophones (for example "night" instead of "knight").

const numberWords = new Map([
  ["one", "1"], ["won", "1"],
  ["two", "2"], ["too", "2"],
  ["three", "3"], ["tree", "3"],
  ["four", "4"], ["for", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"], ["ate", "8"],
]);

const fileWords = new Map([
  ["a", "a"], ["ay", "a"],
  ["b", "b"], ["bee", "b"],
  ["c", "c"], ["see", "c"], ["sea", "c"],
  ["d", "d"], ["dee", "d"],
  ["e", "e"],
  ["f", "f"], ["ef", "f"],
  ["g", "g"], ["gee", "g"],
  ["h", "h"], ["aitch", "h"],
]);

const pieceWords = new Map([
  ["knight", "N"], ["night", "N"], ["nite", "N"], ["nights", "N"], ["horse", "N"],
  ["bishop", "B"], ["bishops", "B"],
  ["rook", "R"], ["rooks", "R"], ["rock", "R"],
  ["queen", "Q"], ["queens", "Q"],
  ["king", "K"], ["kings", "K"],
]);

const promoWords = new Map([
  ["queen", "Q"],
  ["rook", "R"], ["rock", "R"],
  ["bishop", "B"],
  ["knight", "N"], ["night", "N"], ["nite", "N"],
]);

const captureWords = new Set(["takes", "take", "capture", "captures", "captured", "x"]);

function cleanToken(token) {
  return String(token || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeFile(token) {
  return fileWords.get(cleanToken(token)) || "";
}

function normalizeRank(token) {
  const cleaned = cleanToken(token);
  if (/^[1-8]$/.test(cleaned)) return cleaned;
  // "to" is deliberately handled only where a rank is expected, so phrases
  // such as "knight to f three" do not get corrupted globally.
  if (cleaned === "to") return "2";
  return numberWords.get(cleaned) || "";
}

function normalizeCompactSquare(token) {
  const cleaned = cleanToken(token);
  const direct = /^([a-h])([1-8])$/.exec(cleaned);
  if (direct) return `${direct[1]}${direct[2]}`;

  // Some engines join a spoken file-name homophone and rank, e.g. "bee4".
  for (const [spokenFile, file] of fileWords.entries()) {
    if (!cleaned.startsWith(spokenFile)) continue;
    const rest = cleaned.slice(spokenFile.length);
    const rank = normalizeRank(rest);
    if (rank) return `${file}${rank}`;
  }

  return "";
}

function toSquare(fileToken, rankToken) {
  const file = normalizeFile(fileToken);
  const rank = normalizeRank(rankToken);
  return file && rank ? `${file}${rank}` : "";
}

function findSquares(tokens) {
  const squares = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const compact = normalizeCompactSquare(tokens[index]);
    if (compact) {
      squares.push({ square: compact, index, width: 1 });
      continue;
    }

    if (index >= tokens.length - 1) continue;
    const square = toSquare(tokens[index], tokens[index + 1]);
    if (square) squares.push({ square, index, width: 2 });
  }

  return squares;
}

function appendSuffix(san, hasCheck, hasMate) {
  if (hasMate) return `${san}#`;
  if (hasCheck) return `${san}+`;
  return san;
}

export function sanFromSpeech(raw) {
  if (!raw) return "";

  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Castling. Accept common recognition variants such as "king side castle".
  const compact = cleaned.replace(/\s+/g, "");
  const mentionsCastle = /castle|castling/.test(cleaned);
  if (
    (mentionsCastle && /(king\s*side|kingside|short)/.test(cleaned)) ||
    /^(oo|00)$/.test(compact)
  ) return "O-O";
  if (
    (mentionsCastle && /(queen\s*side|queenside|long)/.test(cleaned)) ||
    /^(ooo|000)$/.test(compact)
  ) return "O-O-O";

  const tokens = cleaned.split(" ").map(cleanToken).filter(Boolean);
  const hasMate = tokens.some((token) => token === "checkmate" || token === "mate");
  const hasCheck = hasMate || tokens.includes("check");
  const isCapture = tokens.some((token) => captureWords.has(token));
  const squares = findSquares(tokens);

  let promo = "";
  for (let index = 0; index < tokens.length; index += 1) {
    if (["promote", "promotion", "promotes", "promoting"].includes(tokens[index])) {
      for (let next = index + 1; next < Math.min(index + 5, tokens.length); next += 1) {
        if (promoWords.has(tokens[next])) {
          promo = `=${promoWords.get(tokens[next])}`;
          break;
        }
      }
    }
  }

  const pieceIndex = tokens.findIndex((token) => pieceWords.has(token));
  if (pieceIndex !== -1 && squares.length) {
    const piece = pieceWords.get(tokens[pieceIndex]);
    const destination = squares[squares.length - 1].square;
    return appendSuffix(`${piece}${isCapture ? "x" : ""}${destination}${promo}`, hasCheck, hasMate);
  }

  // Pawn capture: "d takes e five" / "dee takes e5" -> dxe5.
  if (isCapture && squares.length) {
    const captureIndex = tokens.findIndex((token) => captureWords.has(token));
    const fromFile = normalizeFile(tokens[Math.max(0, captureIndex - 1)]);
    const destination = squares[squares.length - 1].square;
    if (fromFile && destination) {
      return appendSuffix(`${fromFile}x${destination}${promo}`, hasCheck, hasMate);
    }
  }

  // Pawn move: "e four", "e4", "ee four", etc.
  if (squares.length) {
    const lastSquare = squares[squares.length - 1];
    const destination = lastSquare.square;
    if (!promo) {
      const afterSquare = tokens[lastSquare.index + lastSquare.width];
      if (promoWords.has(afterSquare)) promo = `=${promoWords.get(afterSquare)}`;
    }
    return appendSuffix(`${destination}${promo}`, hasCheck, hasMate);
  }

  // Fallback for text already close to SAN.
  const fallback = cleaned
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9x+#=o-]/gi, "");
  return fallback || "";
}
