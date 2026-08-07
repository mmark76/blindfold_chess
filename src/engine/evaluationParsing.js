import { Chess } from "chess.js";
import { applyUciMove } from "../chess/moves.js";

const PV_MOVE_LIMIT = 7;

export function pvToSan(fen, uciMoves, moveLimit = PV_MOVE_LIMIT) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return "";
  }

  const sanMoves = [];
  for (const uci of uciMoves.slice(0, moveLimit)) {
    if (!uci || uci === "(none)") break;
    const move = applyUciMove(chess, uci);
    if (!move) break;
    sanMoves.push(move.san);
  }
  return sanMoves.join(" ");
}

export function parseEvaluationLine(line, fen) {
  if (!line.startsWith("info ") || !line.includes(" score ") || !line.includes(" pv ")) {
    return null;
  }

  const tokens = line.trim().split(/\s+/);
  const depthIndex = tokens.indexOf("depth");
  const multiPvIndex = tokens.indexOf("multipv");
  const scoreIndex = tokens.indexOf("score");
  const pvIndex = tokens.indexOf("pv");
  if (scoreIndex < 0 || pvIndex < 0 || !tokens[pvIndex + 1]) return null;

  const scoreType = tokens[scoreIndex + 1];
  const rawScore = Number(tokens[scoreIndex + 2]);
  if (!Number.isFinite(rawScore) || (scoreType !== "cp" && scoreType !== "mate")) return null;

  const sideToMove = fen.split(" ")[1];
  if (sideToMove !== "w" && sideToMove !== "b") return null;

  return {
    depth: depthIndex >= 0 ? Number(tokens[depthIndex + 1]) || 0 : 0,
    multiPv: multiPvIndex >= 0 ? Number(tokens[multiPvIndex + 1]) || 1 : 1,
    scoreType,
    whiteScore: sideToMove === "w" ? rawScore : -rawScore,
    pvSan: pvToSan(fen, tokens.slice(pvIndex + 1, pvIndex + 1 + PV_MOVE_LIMIT)),
  };
}

export function formatEvaluationScore(item) {
  if (item.scoreType === "mate") {
    if (item.whiteScore === 0) return "M0";
    return `${item.whiteScore > 0 ? "" : "-"}M${Math.abs(item.whiteScore)}`;
  }

  const pawns = item.whiteScore / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}
