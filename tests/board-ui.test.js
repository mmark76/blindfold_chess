import assert from "node:assert/strict";
import test from "node:test";
import { Chess } from "chess.js";
import { moveFromSquares, squaresFromFen } from "../src/chess/board.js";

test("board projection produces every named square and piece", () => {
  const squares = squaresFromFen(new Chess().fen());

  assert.equal(squares.length, 64);
  assert.deepEqual(squares[0], { square: "a8", piece: "r", rowIndex: 0, fileIndex: 0 });
  assert.deepEqual(squares[63], { square: "h1", piece: "R", rowIndex: 7, fileIndex: 7 });
});

test("mouse square moves use chess legality and SAN", () => {
  const fen = new Chess().fen();

  assert.equal(moveFromSquares(fen, "e2", "e4")?.san, "e4");
  assert.equal(moveFromSquares(fen, "e2", "e5"), null);
  assert.equal(moveFromSquares(fen, "e7", "e5"), null, "black cannot move on White's turn");
});

test("mouse promotions default to a queen", () => {
  const move = moveFromSquares("8/P7/8/8/8/8/7k/4K3 w - - 0 1", "a7", "a8");

  assert.equal(move?.promotion, "q");
  assert.match(move?.san || "", /^a8=Q/);
});

test("malformed FEN is rejected instead of crashing board rendering", () => {
  assert.deepEqual(squaresFromFen("not-a-fen"), []);
  assert.equal(moveFromSquares("not-a-fen", "e2", "e4"), null);
});
