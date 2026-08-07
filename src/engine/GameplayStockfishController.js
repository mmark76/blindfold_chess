import { normalizeStockfishElo } from "./difficulty.js";

const BEST_MOVE_PATTERN = /^bestmove\s+(\(none\)|[a-h][1-8][a-h][1-8][qrbn]?)(?:\s+ponder\s+[a-h][1-8][a-h][1-8][qrbn]?)?\s*$/;
const MULTIPV_MOVE_PATTERN = /\bmultipv\s+(\d+)\b.*\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)\b/;

// Stockfish's UCI_Elo bottoms out around its internal 1320-strength setting.
// The first six app levels therefore use a wider MultiPV search and deliberately
// choose among good-but-not-best candidates. Higher levels keep Stockfish's
// native UCI_LimitStrength/UCI_Elo behaviour.
const TRAINING_PRESETS = Object.freeze([
  { maxElo: 1320, multiPv: 12, bestMoveProbability: 0.08, alternativeBias: 0 },
  { maxElo: 1400, multiPv: 10, bestMoveProbability: 0.15, alternativeBias: 0.25 },
  { maxElo: 1500, multiPv: 8, bestMoveProbability: 0.28, alternativeBias: 0.6 },
  { maxElo: 1650, multiPv: 6, bestMoveProbability: 0.45, alternativeBias: 1 },
  { maxElo: 1800, multiPv: 5, bestMoveProbability: 0.62, alternativeBias: 1.5 },
  { maxElo: 2000, multiPv: 4, bestMoveProbability: 0.78, alternativeBias: 2.2 },
]);

function getStrengthPreset(elo) {
  const trainingPreset = TRAINING_PRESETS.find((preset) => elo <= preset.maxElo);
  if (trainingPreset) {
    return {
      mode: "training",
      ...trainingPreset,
    };
  }

  return {
    mode: "uci-elo",
    multiPv: 1,
    bestMoveProbability: 1,
    alternativeBias: 0,
  };
}

export function parseBestMove(line) {
  return BEST_MOVE_PATTERN.exec(String(line || "").trim())?.[1] || null;
}

export function parseMultiPvMove(line) {
  const match = MULTIPV_MOVE_PATTERN.exec(String(line || "").trim());
  if (!match) return null;
  return {
    rank: Number(match[1]),
    uci: match[2],
  };
}

export class GameplayStockfishController {
  constructor(worker, callbacks = {}, options = {}) {
    if (!worker || typeof worker.postMessage !== "function") {
      throw new TypeError("A Stockfish worker is required.");
    }

    this.worker = worker;
    this.onReady = callbacks.onReady || (() => {});
    this.onBestMove = callbacks.onBestMove || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.defaultMoveTimeMs = Math.max(1, Math.round(options.moveTimeMs || 1000));
    this.responseTimeoutMs = Math.max(1, Math.round(options.responseTimeoutMs || 30000));
    this.stopTimeoutMs = Math.max(1, Math.round(options.stopTimeoutMs || 10000));
    this.random = typeof options.random === "function" ? options.random : Math.random;

    this.phase = "created";
    this.pendingSearch = null;
    this.preparingSearch = null;
    this.activeSearch = null;
    this.resetPending = false;
    this.nextSearchId = 1;
    this.watchdogId = null;

    this.worker.onmessage = (event) => this.handleMessage(event?.data);
    this.worker.onerror = (event) => {
      event?.preventDefault?.();
      this.fail(event?.message || "Stockfish worker failed to load.");
    };
  }

  get available() {
    return this.phase !== "failed" && this.phase !== "destroyed";
  }

  start() {
    if (this.phase !== "created") return;
    this.phase = "awaiting-uci";
    this.send("uci");
    this.armWatchdog("Stockfish did not complete UCI initialization.");
  }

  search({ fen, elo, moveTimeMs = this.defaultMoveTimeMs }) {
    if (!this.available) return null;

    const normalizedFen = String(fen || "").trim();
    if (!normalizedFen || /[\r\n]/.test(normalizedFen)) {
      throw new TypeError("A valid single-line FEN is required.");
    }

    const normalizedElo = normalizeStockfishElo(elo);
    const request = {
      id: this.nextSearchId,
      fen: normalizedFen,
      elo: normalizedElo,
      strength: getStrengthPreset(normalizedElo),
      candidates: new Map(),
      moveTimeMs: Math.max(1, Math.round(Number(moveTimeMs) || this.defaultMoveTimeMs)),
      cancelled: false,
    };
    this.nextSearchId += 1;

    this.pendingSearch = request;

    if (this.preparingSearch) this.preparingSearch.cancelled = true;
    if (this.activeSearch) {
      this.activeSearch.cancelled = true;
      this.stopActiveSearch();
    }

    this.pump();
    return request.id;
  }

  cancel({ newGame = false } = {}) {
    this.pendingSearch = null;
    if (this.preparingSearch) this.preparingSearch.cancelled = true;

    if (newGame && this.phase !== "resetting") this.resetPending = true;

    if (this.activeSearch) {
      this.activeSearch.cancelled = true;
      this.stopActiveSearch();
    }

    this.pump();
  }

  handleMessage(message) {
    if (!this.available || typeof message !== "string") return;

    for (const rawLine of message.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      this.handleLine(line);
    }
  }

  handleLine(line) {
    if (line === "uciok" && this.phase === "awaiting-uci") {
      this.clearWatchdog();
      this.phase = "initializing";
      this.send("setoption name MultiPV value 1");
      this.send("isready");
      this.armWatchdog("Stockfish did not become ready.");
      return;
    }

    if (line === "readyok") {
      this.handleReady();
      return;
    }

    if (line.startsWith("info ") && this.activeSearch?.strength.mode === "training") {
      const candidate = parseMultiPvMove(line);
      if (candidate && candidate.rank <= this.activeSearch.strength.multiPv) {
        this.activeSearch.candidates.set(candidate.rank, candidate.uci);
      }
      return;
    }

    if (line.startsWith("bestmove")) {
      const uci = parseBestMove(line);
      if (!uci) {
        this.fail("Stockfish returned a malformed bestmove response.");
        return;
      }
      this.handleBestMove(uci);
    }
  }

  handleReady() {
    if (this.phase === "initializing") {
      this.clearWatchdog();
      this.phase = "idle";
      this.onReady(true);
      this.pump();
      return;
    }

    if (this.phase === "preparing") {
      this.clearWatchdog();
      const request = this.preparingSearch;
      this.preparingSearch = null;
      this.phase = "idle";

      if (request && !request.cancelled && !this.resetPending && !this.pendingSearch) {
        request.candidates.clear();
        this.activeSearch = request;
        this.phase = "searching";
        this.send(`position fen ${request.fen}`);
        this.send(`go movetime ${request.moveTimeMs}`);
        this.armWatchdog(
          "Stockfish did not finish its move search.",
          Math.max(this.responseTimeoutMs, request.moveTimeMs + this.stopTimeoutMs),
        );
      } else {
        this.pump();
      }
      return;
    }

    if (this.phase === "resetting") {
      this.clearWatchdog();
      this.phase = "idle";
      this.pump();
    }
  }

  selectTrainingMove(request, bestMove) {
    if (request.strength.mode !== "training") return bestMove;

    const rankedMoves = [...request.candidates.entries()]
      .sort(([rankA], [rankB]) => rankA - rankB)
      .map(([, uci]) => uci);

    const uniqueMoves = [];
    const seen = new Set();
    for (const uci of [bestMove, ...rankedMoves]) {
      if (!uci || uci === "(none)" || seen.has(uci)) continue;
      seen.add(uci);
      uniqueMoves.push(uci);
    }

    if (uniqueMoves.length <= 1) return bestMove;
    if (this.random() < request.strength.bestMoveProbability) return uniqueMoves[0];

    const alternatives = uniqueMoves.slice(1);
    const bias = request.strength.alternativeBias;
    const weights = alternatives.map((_, index) => (
      bias === 0 ? 1 : 1 / Math.pow(index + 1, bias)
    ));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let pick = this.random() * totalWeight;

    for (let index = 0; index < alternatives.length; index += 1) {
      pick -= weights[index];
      if (pick <= 0) return alternatives[index];
    }

    return alternatives[alternatives.length - 1] || bestMove;
  }

  handleBestMove(uci) {
    if (!this.activeSearch || (this.phase !== "searching" && this.phase !== "stopping")) {
      return;
    }

    const request = this.activeSearch;
    const selectedUci = this.selectTrainingMove(request, uci);
    this.clearWatchdog();
    this.activeSearch = null;
    this.phase = "idle";

    if (!request.cancelled && !this.resetPending) {
      this.onBestMove(selectedUci, request);
    }

    this.pump();
  }

  stopActiveSearch() {
    if (this.phase !== "searching") return;
    this.phase = "stopping";
    this.send("stop");
    this.armWatchdog("Stockfish did not stop the active search.", this.stopTimeoutMs);
  }

  pump() {
    if (this.phase !== "idle") return;

    if (this.resetPending) {
      this.resetPending = false;
      this.phase = "resetting";
      this.send("ucinewgame");
      this.send("isready");
      this.armWatchdog("Stockfish did not reset for the new game.");
      return;
    }

    if (!this.pendingSearch) return;

    const request = this.pendingSearch;
    this.pendingSearch = null;
    this.preparingSearch = request;
    this.phase = "preparing";

    if (request.strength.mode === "training") {
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name Skill Level value 20");
      this.send(`setoption name MultiPV value ${request.strength.multiPv}`);
    } else {
      this.send("setoption name Skill Level value 20");
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${request.elo}`);
      this.send("setoption name MultiPV value 1");
    }

    this.send("isready");
    this.armWatchdog("Stockfish did not apply the requested strength.");
  }

  armWatchdog(message, timeoutMs = this.responseTimeoutMs) {
    this.clearWatchdog();
    if (!this.available) return;

    this.watchdogId = setTimeout(() => {
      this.watchdogId = null;
      this.fail(message);
    }, timeoutMs);
    this.watchdogId?.unref?.();
  }

  clearWatchdog() {
    if (this.watchdogId === null) return;
    clearTimeout(this.watchdogId);
    this.watchdogId = null;
  }

  send(command) {
    if (!this.available) return;

    try {
      this.worker.postMessage(command);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  fail(message) {
    if (!this.available) return;
    this.clearWatchdog();
    this.phase = "failed";
    this.pendingSearch = null;
    this.preparingSearch = null;
    this.activeSearch = null;
    this.resetPending = false;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate?.();
    this.onReady(false);
    this.onError(message);
  }

  destroy() {
    if (this.phase === "destroyed") return;
    this.clearWatchdog();
    this.phase = "destroyed";
    this.pendingSearch = null;
    this.preparingSearch = null;
    this.activeSearch = null;
    this.resetPending = false;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate?.();
  }
}
