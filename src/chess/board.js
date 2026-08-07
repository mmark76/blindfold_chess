import { Chess } from "chess.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function squaresFromFen(fen) {
  const rows = String(fen || "").split(" ")[0].split("/");
  if (rows.length !== 8) return [];

  const squares = [];

  rows.forEach((row, rowIndex) => {
    let fileIndex = 0;

    for (const token of row) {
      const emptyCount = Number(token);

      if (Number.isInteger(emptyCount) && emptyCount > 0) {
        for (let index = 0; index < emptyCount; index += 1) {
          squares.push({
            square: `${FILES[fileIndex]}${8 - rowIndex}`,
            piece: "",
            rowIndex,
            fileIndex,
          });
          fileIndex += 1;
        }
        continue;
      }

      squares.push({
        square: `${FILES[fileIndex]}${8 - rowIndex}`,
        piece: token,
        rowIndex,
        fileIndex,
      });
      fileIndex += 1;
    }
  });

  return squares.length === 64 ? squares : [];
}

export function moveFromSquares(fen, from, to) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }

  const piece = chess.get(from);
  if (!piece) return null;

  const promotion = piece.type === "p" && (to.endsWith("8") || to.endsWith("1"))
    ? "q"
    : undefined;

  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}
