import assert from "node:assert/strict";
import test from "node:test";

import { EvaluationStockfishController } from "../src/engine/EvaluationStockfishController.js";
import {
  GameplayStockfishController,
  parseBestMove,
} from "../src/engine/GameplayStockfishController.js";
import {
  formatEvaluationScore,
  parseEvaluationLine,
  pvToSan,
} from "../src/engine/evaluationParsing.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

class MockWorker {
  constructor() {
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
  }

  postMessage(message) {
    this.messages.push(message);
  }

  emit(message) {
    this.onmessage?.({ data: message });
  }

  fail(message = "worker failed") {
    this.onerror?.({ message, preventDefault() {} });
  }

  terminate() {
    this.terminated = true;
  }
}

function bootGameplay(callbacks = {}, options = {}) {
  const worker = new MockWorker();
  const controller = new GameplayStockfishController(worker, callbacks, options);
  controller.start();
  assert.deepEqual(worker.messages, ["uci"]);
  worker.emit("uciok");
  assert.deepEqual(worker.messages.slice(-2), ["setoption name MultiPV value 1", "isready"]);
  worker.emit("readyok");
  return { controller, worker };
}

function bootEvaluation(callbacks = {}) {
  const worker = new MockWorker();
  const controller = new EvaluationStockfishController(worker, callbacks);
  controller.start();
  assert.deepEqual(worker.messages, ["uci"]);
  worker.emit("uciok");
  assert.deepEqual(worker.messages.slice(-4), [
    "setoption name UCI_LimitStrength value false",
    "setoption name Skill Level value 20",
    "setoption name MultiPV value 3",
    "isready",
  ]);
  worker.emit("readyok");
  return { controller, worker };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("bestmove parsing accepts legal UCI moves and rejects malformed output", () => {
  assert.equal(parseBestMove("bestmove e7e8q ponder a2a1n"), "e7e8q");
  assert.equal(parseBestMove("bestmove (none)"), "(none)");
  assert.equal(parseBestMove("bestmove e9e4"), null);
  assert.equal(parseBestMove("info depth 1"), null);
});

test("gameplay initialization waits for uciok and readyok before searching", () => {
  const ready = [];
  const worker = new MockWorker();
  const controller = new GameplayStockfishController(worker, { onReady: (value) => ready.push(value) });
  controller.start();
  controller.search({ elo: 1800, fen: AFTER_E4_FEN });

  assert.deepEqual(worker.messages, ["uci"]);
  worker.emit("uciok");
  assert.equal(worker.messages.includes(`position fen ${AFTER_E4_FEN}`), false);
  worker.emit("readyok");

  assert.deepEqual(ready, [true]);
  assert.deepEqual(worker.messages.slice(-4), [
    "setoption name UCI_LimitStrength value true",
    "setoption name UCI_Elo value 1800",
    "setoption name MultiPV value 1",
    "isready",
  ]);
  assert.equal(worker.messages.includes(`position fen ${AFTER_E4_FEN}`), false);

  worker.emit("readyok");
  assert.deepEqual(worker.messages.slice(-2), [
    `position fen ${AFTER_E4_FEN}`,
    "go movetime 1000",
  ]);
});

test("gameplay controller uses Stockfish max Elo for the 2900+ request", () => {
  const { controller, worker } = bootGameplay();
  controller.search({ elo: 9999, fen: AFTER_E4_FEN });
  assert.equal(worker.messages.at(-3), "setoption name UCI_Elo value 3190");
});

test("gameplay controller drains a stopped search before starting the replacement", () => {
  const completed = [];
  const { controller, worker } = bootGameplay({
    onBestMove: (uci, request) => completed.push([uci, request.fen]),
  });

  controller.search({ elo: 1800, fen: AFTER_E4_FEN });
  worker.emit("readyok");
  assert.equal(worker.messages.at(-1), "go movetime 1000");

  controller.search({ elo: 2000, fen: START_FEN });
  assert.equal(worker.messages.at(-1), "stop");
  assert.equal(worker.messages.includes(`position fen ${START_FEN}`), false);

  worker.emit("bestmove e7e5");
  assert.deepEqual(completed, []);
  assert.deepEqual(worker.messages.slice(-4), [
    "setoption name UCI_LimitStrength value true",
    "setoption name UCI_Elo value 2000",
    "setoption name MultiPV value 1",
    "isready",
  ]);

  worker.emit("readyok");
  worker.emit("bestmove e2e4");
  assert.deepEqual(completed, [["e2e4", START_FEN]]);
});

test("new game waits for stopped bestmove, resets UCI state, and ignores stale replies", () => {
  const completed = [];
  const { controller, worker } = bootGameplay({ onBestMove: (uci) => completed.push(uci) });
  controller.search({ elo: 1800, fen: AFTER_E4_FEN });
  worker.emit("readyok");

  controller.cancel({ newGame: true });
  assert.equal(worker.messages.at(-1), "stop");
  assert.equal(worker.messages.includes("ucinewgame"), false);

  worker.emit("bestmove e7e5");
  assert.deepEqual(completed, []);
  assert.deepEqual(worker.messages.slice(-2), ["ucinewgame", "isready"]);

  worker.emit("bestmove d7d5");
  assert.deepEqual(completed, []);
  worker.emit("readyok");
  assert.equal(controller.phase, "idle");
});

test("resign cancellation ignores the in-flight bestmove", () => {
  const completed = [];
  const { controller, worker } = bootGameplay({ onBestMove: (uci) => completed.push(uci) });
  controller.search({ elo: 1800, fen: AFTER_E4_FEN });
  worker.emit("readyok");
  controller.cancel();
  worker.emit("bestmove e7e5");
  assert.deepEqual(completed, []);
  assert.equal(controller.phase, "idle");
});

test("worker failures clear work and notify the caller", () => {
  const errors = [];
  const ready = [];
  const { controller, worker } = bootGameplay({
    onError: (message) => errors.push(message),
    onReady: (value) => ready.push(value),
  });
  worker.fail("wasm unavailable");
  assert.equal(controller.available, false);
  assert.equal(worker.terminated, true);
  assert.deepEqual(ready, [true, false]);
  assert.deepEqual(errors, ["wasm unavailable"]);
});

test("gameplay watchdog reports a stalled UCI handshake", async () => {
  const errors = [];
  const worker = new MockWorker();
  const controller = new GameplayStockfishController(
    worker,
    { onError: (message) => errors.push(message) },
    { responseTimeoutMs: 10 },
  );

  controller.start();
  await delay(30);

  assert.equal(controller.available, false);
  assert.equal(worker.terminated, true);
  assert.deepEqual(errors, ["Stockfish did not complete UCI initialization."]);
});

test("gameplay watchdog reports a stopped search that never drains", async () => {
  const errors = [];
  const { controller, worker } = bootGameplay(
    { onError: (message) => errors.push(message) },
    { responseTimeoutMs: 1000, stopTimeoutMs: 10 },
  );
  controller.search({ elo: 1800, fen: AFTER_E4_FEN });
  worker.emit("readyok");
  controller.cancel();

  await delay(30);

  assert.equal(controller.available, false);
  assert.equal(worker.terminated, true);
  assert.deepEqual(errors, ["Stockfish did not stop the active search."]);
});

test("evaluation watchdog reports a stalled UCI handshake", async () => {
  const errors = [];
  const worker = new MockWorker();
  const controller = new EvaluationStockfishController(
    worker,
    { onError: (message) => errors.push(message) },
    { responseTimeoutMs: 10 },
  );

  controller.start();
  await delay(30);

  assert.equal(controller.available, false);
  assert.equal(worker.terminated, true);
  assert.deepEqual(errors, ["Stockfish evaluation did not complete UCI initialization."]);
});

test("evaluation worker is isolated at full strength with MultiPV 3", () => {
  const { controller, worker } = bootEvaluation();
  controller.analyze({ fen: START_FEN });
  assert.deepEqual(worker.messages.slice(-2), [
    `position fen ${START_FEN}`,
    "go depth 12 nodes 120000",
  ]);
  assert.equal(worker.messages.includes("setoption name UCI_LimitStrength value true"), false);
});

test("evaluation controller ignores old info/bestmove and starts only the latest position", () => {
  const infos = [];
  const completed = [];
  const { controller, worker } = bootEvaluation({
    onComplete: (request) => completed.push(request.fen),
    onInfo: (line, request) => infos.push([line, request.fen]),
  });

  controller.analyze({ fen: START_FEN });
  worker.emit("info depth 1 multipv 1 score cp 10 pv e2e4");
  assert.equal(infos.length, 1);

  controller.analyze({ fen: AFTER_E4_FEN });
  assert.equal(worker.messages.at(-1), "stop");
  worker.emit("info depth 2 multipv 1 score cp 20 pv d2d4");
  assert.equal(infos.length, 1);

  worker.emit("bestmove e2e4");
  assert.deepEqual(completed, []);
  assert.deepEqual(worker.messages.slice(-2), [
    `position fen ${AFTER_E4_FEN}`,
    "go depth 12 nodes 120000",
  ]);

  worker.emit("info depth 3 multipv 1 score cp -10 pv e7e5");
  worker.emit("bestmove e7e5");
  assert.deepEqual(infos.at(-1), ["info depth 3 multipv 1 score cp -10 pv e7e5", AFTER_E4_FEN]);
  assert.deepEqual(completed, [AFTER_E4_FEN]);
});

test("evaluation scores are normalized to White and legal UCI PVs become SAN", () => {
  const white = parseEvaluationLine(
    "info depth 8 multipv 1 score cp 34 pv e2e4 e7e5 g1f3",
    START_FEN,
  );
  assert.deepEqual(white, {
    depth: 8,
    multiPv: 1,
    scoreType: "cp",
    whiteScore: 34,
    pvSan: "e4 e5 Nf3",
  });
  assert.equal(formatEvaluationScore(white), "+0.34");

  const black = parseEvaluationLine(
    "info depth 9 multipv 2 score mate 3 pv c7c5 g1f3",
    AFTER_E4_FEN,
  );
  assert.equal(black.whiteScore, -3);
  assert.equal(black.pvSan, "c5 Nf3");
  assert.equal(formatEvaluationScore(black), "-M3");

  assert.equal(pvToSan(START_FEN, ["e2e4", "not-a-move", "e7e5"]), "e4");
  assert.equal(parseEvaluationLine("info depth 1 score string unknown pv e2e4", START_FEN), null);
});
