import { normalizeStockfishElo } from "./difficulty.js";

const BEST_MOVE_PATTERN = /^bestmove\s+(\(none\)|[a-h][1-8][a-h][1-8][qrbn]?)(?:\s+ponder\s+[a-h][1-8][a-h][1-8][qrbn]?)?\s*$/;

export function parseBestMove(line) {
  return BEST_MOVE_PATTERN.exec(String(line || "").trim())?.[1] || null;
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

    const request = {
      id: this.nextSearchId,
      fen: normalizedFen,
      elo: normalizeStockfishElo(elo),
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

  handleBestMove(uci) {
    if (!this.activeSearch || (this.phase !== "searching" && this.phase !== "stopping")) {
      return;
    }

    const request = this.activeSearch;
    this.clearWatchdog();
    this.activeSearch = null;
    this.phase = "idle";

    if (!request.cancelled && !this.resetPending) {
      this.onBestMove(uci, request);
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
    this.send("setoption name UCI_LimitStrength value true");
    this.send(`setoption name UCI_Elo value ${request.elo}`);
    this.send("setoption name MultiPV value 1");
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
