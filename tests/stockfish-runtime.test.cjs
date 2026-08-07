const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const STOCKFISH_JS = path.join(REPOSITORY_ROOT, "public", "stockfish-17.1-lite-single-03e3232.js");
const STOCKFISH_WASM = path.join(REPOSITORY_ROOT, "public", "stockfish-17.1-lite-single-03e3232.wasm");

async function loadStockfish(listener) {
  // The application is ESM, but the vendored Node wrapper is CommonJS. Compiling
  // it explicitly lets this smoke test exercise the exact browser engine assets.
  const compiled = new Module(STOCKFISH_JS, module);
  compiled.filename = STOCKFISH_JS;
  compiled.paths = Module._nodeModulePaths(path.dirname(STOCKFISH_JS));
  compiled._compile(fs.readFileSync(STOCKFISH_JS, "utf8"), STOCKFISH_JS);

  const createStockfish = compiled.exports();
  return createStockfish({
    listener,
    locateFile: () => STOCKFISH_WASM,
  });
}

function waitForLine(lines, predicate, startIndex = 0, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const inspect = () => {
      const match = lines.slice(startIndex).find(predicate);
      if (match) {
        resolve(match);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for Stockfish output. Last lines: ${lines.slice(-5).join(" | ")}`));
        return;
      }
      setTimeout(inspect, 10);
    };

    inspect();
  });
}

test("bundled Stockfish completes UCI init, exposes the expected options, searches, and stops", { timeout: 20000 }, async () => {
  const lines = [];
  const engine = await loadStockfish((line) => lines.push(String(line)));
  const command = (value) => engine.ccall(
    "command",
    null,
    ["string"],
    [value],
    { async: /^go\b/.test(value) },
  );

  command("uci");
  await waitForLine(lines, (line) => line === "uciok");
  assert.ok(lines.some((line) => line === "option name UCI_LimitStrength type check default false"));
  assert.ok(lines.some((line) => line === "option name UCI_Elo type spin default 1320 min 1320 max 3190"));
  assert.ok(lines.some((line) => line === "option name MultiPV type spin default 1 min 1 max 256"));

  const readyStart = lines.length;
  command("setoption name UCI_LimitStrength value true");
  command("setoption name UCI_Elo value 3190");
  command("setoption name MultiPV value 1");
  command("isready");
  await waitForLine(lines, (line) => line === "readyok", readyStart);

  const searchStart = lines.length;
  command("position startpos");
  const searchPromise = command("go movetime 5000");
  await waitForLine(lines, (line) => line.startsWith("info "), searchStart);
  const stopStartedAt = Date.now();
  command("stop");
  const bestMove = await waitForLine(lines, (line) => line.startsWith("bestmove "), searchStart, 3000);
  await searchPromise;

  assert.match(bestMove, /^bestmove [a-h][1-8][a-h][1-8][qrbn]?(?: ponder [a-h][1-8][a-h][1-8][qrbn]?)?$/);
  assert.ok(Date.now() - stopStartedAt < 3000, "stop should terminate the active search promptly");

  const multiPvReadyStart = lines.length;
  command("setoption name UCI_LimitStrength value false");
  command("setoption name MultiPV value 3");
  command("isready");
  await waitForLine(lines, (line) => line === "readyok", multiPvReadyStart);

  const multiPvSearchStart = lines.length;
  command("position startpos");
  const multiPvPromise = command("go depth 3");
  await waitForLine(lines, (line) => line.startsWith("bestmove "), multiPvSearchStart);
  await multiPvPromise;
  assert.ok(
    lines.slice(multiPvSearchStart).some((line) => /\bmultipv 3\b/.test(line)),
    "MultiPV 3 should produce a third principal variation in the evaluation worker configuration",
  );
});
