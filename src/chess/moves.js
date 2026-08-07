import { Chess } from "chess.js";

const UCI_MOVE_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function uciToMove(uci) {
  if (uci === "(none)") return null;

  const match = UCI_MOVE_PATTERN.exec(String(uci || "").trim());
  if (!match) return null;

  return {
    from: match[1],
    to: match[2],
    promotion: match[3],
  };
}

export function applySanMove(chess, rawSan) {
  const san = String(rawSan || "").trim();
  if (!san) return null;

  try {
    return chess.move(san, { strict: false });
  } catch {
    return null;
  }
}

export function applyUciMove(chess, uci) {
  const move = uciToMove(uci);
  if (!move) return null;

  try {
    return chess.move(move);
  } catch {
    return null;
  }
}

export function replaySanHistory(sanMoves) {
  const chess = new Chess();

  for (let index = 0; index < sanMoves.length; index += 1) {
    if (!applySanMove(chess, sanMoves[index])) {
      return { chess, complete: false, invalidIndex: index };
    }
  }

  return { chess, complete: true, invalidIndex: -1 };
}
