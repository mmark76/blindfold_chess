import assert from "node:assert/strict";
import test from "node:test";

import { Chess } from "chess.js";
import {
  applySanMove,
  applyUciMove,
  replaySanHistory,
  uciToMove,
} from "../src/chess/moves.js";
import {
  DIFFICULTY_LEVELS,
  STOCKFISH_MAX_ELO,
  STOCKFISH_MIN_ELO,
} from "../src/engine/difficulty.js";

function play(game, moves) {
  return moves.map((san) => {
    const move = applySanMove(game, san);
    assert.ok(move, `Expected ${san} to be legal`);
    return move;
  });
}

test("difficulty labels and internal Elo values match the product scale", () => {
  assert.deepEqual(
    DIFFICULTY_LEVELS.map(({ elo, nameEn, displayElo }) => [elo, displayElo, nameEn]),
    [
      [1320, "1320", "Beginner"],
      [1400, "1400", "Novice"],
      [1500, "1500", "Intermediate"],
      [1650, "1650", "Club Player"],
      [1800, "1800", "Strong Club Player"],
      [2000, "2000", "Expert"],
      [2200, "2200", "Candidate Master (CM) level"],
      [2300, "2300", "FIDE Master (FM) level"],
      [2400, "2400", "International Master (IM) level"],
      [2500, "2500", "Grandmaster (GM) level"],
      [2700, "2700", "Super-GM level"],
      [3190, "2900+", "Engines Level"],
    ],
  );
  assert.equal(STOCKFISH_MIN_ELO, 1320);
  assert.equal(STOCKFISH_MAX_ELO, 3190);
});

test("legal SAN updates the game while illegal SAN leaves the FEN unchanged", () => {
  const game = new Chess();
  const initialFen = game.fen();
  assert.equal(applySanMove(game, "e5"), null);
  assert.equal(game.fen(), initialFen);

  const move = applySanMove(game, "e4");
  assert.equal(move.san, "e4");
  assert.equal(game.turn(), "b");
});

test("castling moves both king and rook and records canonical SAN", () => {
  const game = new Chess();
  const moves = play(game, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
  assert.equal(moves.at(-1).san, "O-O");
  assert.equal(game.get("g1")?.type, "k");
  assert.equal(game.get("f1")?.type, "r");
});

test("captures, check, and checkmate are represented in SAN and end the game", () => {
  const captureGame = new Chess();
  const captureMoves = play(captureGame, ["e4", "d5", "exd5"]);
  assert.equal(captureMoves.at(-1).san, "exd5");
  assert.equal(captureMoves.at(-1).captured, "p");

  const mateGame = new Chess();
  const mateMoves = play(mateGame, ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]);
  assert.equal(mateMoves.at(-1).san, "Qxf7#");
  assert.equal(mateGame.isCheck(), true);
  assert.equal(mateGame.isCheckmate(), true);
  assert.equal(mateGame.isGameOver(), true);
  assert.equal(applySanMove(mateGame, "a6"), null);
});

test("stalemate, repetition, and insufficient material are draws", () => {
  const stalemate = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(stalemate.isStalemate(), true);
  assert.equal(stalemate.isDraw(), true);

  const repetition = new Chess();
  play(repetition, ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
  assert.equal(repetition.isThreefoldRepetition(), true);
  assert.equal(repetition.isDraw(), true);

  const insufficient = new Chess("8/8/8/8/8/8/6k1/4K3 w - - 0 1");
  assert.equal(insufficient.isInsufficientMaterial(), true);
  assert.equal(insufficient.isDraw(), true);

  const fiftyMove = new Chess("8/8/8/8/8/8/6k1/R3K3 w - - 100 1");
  assert.equal(fiftyMove.isDrawByFiftyMoves(), true);
  assert.equal(fiftyMove.isDraw(), true);
});

test("promotion is accepted from SAN and UCI only with a valid promotion piece", () => {
  const sanGame = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  const promotion = applySanMove(sanGame, "a8=Q+");
  assert.equal(promotion.san, "a8=Q+");
  assert.equal(sanGame.get("a8")?.type, "q");

  const uciGame = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  assert.deepEqual(uciToMove("a7a8n"), { from: "a7", to: "a8", promotion: "n" });
  assert.equal(applyUciMove(uciGame, "a7a8n")?.san, "a8=N");
  assert.equal(uciToMove("a7a8k"), null);
  assert.equal(uciToMove("not-a-move"), null);
});

test("replaying SAN history produces the same FEN, including castling and captures", () => {
  const history = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6", "dxc6", "O-O"];
  const live = new Chess();
  play(live, history);

  const replayed = replaySanHistory(history);
  assert.equal(replayed.complete, true);
  assert.equal(replayed.invalidIndex, -1);
  assert.equal(replayed.chess.fen(), live.fen());

  const partial = replaySanHistory(["e4", "definitely-invalid", "e5"]);
  assert.equal(partial.complete, false);
  assert.equal(partial.invalidIndex, 1);
  assert.deepEqual(partial.chess.history(), ["e4"]);
});
