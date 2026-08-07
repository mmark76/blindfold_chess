import { parseBestMove } from "./GameplayStockfishController.js";

export class EvaluationStockfishController {
  constructor(worker, callbacks = {}, options = {}) {
    if (!worker || typeof worker.postMessage !== "function") {
      throw new TypeError("A Stockfish worker is required.");
    }

    this.worker = worker;
    this.onReady = callbacks.onReady || (() => {});
    this.onInfo = callbacks.onInfo || (() => {});
    this.onComplete = callbacks.onComplete || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.responseTimeoutMs = Math.max(1, Math.round(options.responseTimeoutMs || 30000));
    this.analysisTimeoutMs = Math.max(1, Math.round(options.analysisTimeoutMs || 60000));
    this.stopTimeoutMs = Math.max(1, Math.round(options.stopTimeoutMs || 10000));

    this.phase = "created";
    this.pendingAnalysis = null;
    this.activeAnalysis = null;
    this.nextAnalysisId = 1;
    this.watchdogId = null;

    this.worker.onmessage = (event) => this.handleMessage(event?.data);
    this.worker.onerror = (event) => {
      event?.preventDefault?.();
      this.fail(event?.message || "Stockfish evaluation worker failed to load.");
    };
  }

  get available() {
    return this.phase !== "failed" && this.phase !== "destroyed";
  }

  start() {
    if (this.phase !== "created") return;
    this.phase = "awaiting-uci";
    this.send("uci");
    this.armWatchdog("Stockfish evaluation did not complete UCI initialization.");
  }

  analyze({ fen, depth = 12, nodes = 120000 }) {
    if (!this.available) return null;

    const normalizedFen = String(fen || "").trim();
    if (!normalizedFen || /[\r\n]/.test(normalizedFen)) {
      throw new TypeError("A valid single-line FEN is required.");
    }

    const request = {
      id: this.nextAnalysisId,
      fen: normalizedFen,
      depth: Math.max(1, Math.round(Number(depth) || 12)),
      nodes: Math.max(1, Math.round(Number(nodes) || 120000)),
      cancelled: false,
    };
    this.nextAnalysisId += 1;
    this.pendingAnalysis = request;

    if (this.activeAnalysis) {
      this.activeAnalysis.cancelled = true;
      this.stopActiveAnalysis();
    }

    this.pump();
    return request.id;
  }

  cancel() {
    this.pendingAnalysis = null;
    if (this.activeAnalysis) {
      this.activeAnalysis.cancelled = true;
      this.stopActiveAnalysis();
    }
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
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name Skill Level value 20");
      this.send("setoption name MultiPV value 3");
      this.send("isready");
      this.armWatchdog("Stockfish evaluation did not become ready.");
      return;
    }

    if (line === "readyok" && this.phase === "initializing") {
      this.clearWatchdog();
      this.phase = "idle";
      this.onReady(true);
      this.pump();
      return;
    }

    if (line.startsWith("bestmove")) {
      const uci = parseBestMove(line);
      if (!uci) {
        this.fail("Stockfish returned a malformed bestmove response.");
        return;
      }
      this.handleBestMove();
      return;
    }

    if (line.startsWith("info ") && this.phase === "searching" && this.activeAnalysis && !this.activeAnalysis.cancelled) {
      this.onInfo(line, this.activeAnalysis);
    }
  }

  handleBestMove() {
    if (!this.activeAnalysis || (this.phase !== "searching" && this.phase !== "stopping")) {
      return;
    }

    const request = this.activeAnalysis;
    this.clearWatchdog();
    this.activeAnalysis = null;
    this.phase = "idle";

    if (!request.cancelled) this.onComplete(request);
    this.pump();
  }

  stopActiveAnalysis() {
    if (this.phase !== "searching") return;
    this.phase = "stopping";
    this.send("stop");
    this.armWatchdog("Stockfish evaluation did not stop the active analysis.", this.stopTimeoutMs);
  }

  pump() {
    if (this.phase !== "idle" || !this.pendingAnalysis) return;

    const request = this.pendingAnalysis;
    this.pendingAnalysis = null;
    this.activeAnalysis = request;
    this.phase = "searching";
    this.send(`position fen ${request.fen}`);
    this.send(`go depth ${request.depth} nodes ${request.nodes}`);
    this.armWatchdog("Stockfish evaluation did not finish the analysis.", this.analysisTimeoutMs);
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
    this.pendingAnalysis = null;
    this.activeAnalysis = null;
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
    this.pendingAnalysis = null;
    this.activeAnalysis = null;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate?.();
  }
}
