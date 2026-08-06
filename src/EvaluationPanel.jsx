import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import "./evaluation-panel.css";

const STORAGE_KEY = "blindfold-show-evaluation";
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";
const EMPTY_MOVE_TEXTS = new Set(["", "No moves yet.", "Δεν υπάρχουν κινήσεις ακόμη."]);

function sanMovesFromText(text) {
  const normalized = (text || "").trim();
  if (EMPTY_MOVE_TEXTS.has(normalized)) return [];

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+\.$/.test(token));
}

function gameFromSanText(text) {
  const chess = new Chess();

  for (const san of sanMovesFromText(text)) {
    try {
      const move = chess.move(san, { sloppy: true });
      if (!move) break;
    } catch {
      break;
    }
  }

  return chess;
}

function uciToSan(fen, uci) {
  if (!uci || uci === "(none)") return "";

  const chess = new Chess(fen);
  try {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length >= 5 ? uci[4] : undefined,
    });
    return move?.san || uci;
  } catch {
    return uci;
  }
}

function parseEvaluationLine(line, fen) {
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
  const whiteScore = sideToMove === "w" ? rawScore : -rawScore;
  const uci = tokens[pvIndex + 1];

  return {
    depth: depthIndex >= 0 ? Number(tokens[depthIndex + 1]) || 0 : 0,
    multiPv: multiPvIndex >= 0 ? Number(tokens[multiPvIndex + 1]) || 1 : 1,
    scoreType,
    whiteScore,
    san: uciToSan(fen, uci),
  };
}

function formatScore(item) {
  if (item.scoreType === "mate") {
    if (item.whiteScore === 0) return "M0";
    return `${item.whiteScore > 0 ? "" : "-"}M${Math.abs(item.whiteScore)}`;
  }

  const pawns = item.whiteScore / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

function getInitialVisibility() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export default function EvaluationPanel() {
  const workerRef = useRef(null);
  const workerReadyRef = useRef(false);
  const currentFenRef = useRef(new Chess().fen());
  const candidatesRef = useRef(new Map());
  const analysisTimerRef = useRef(0);
  const searchActiveRef = useRef(false);

  const [showEvaluation, setShowEvaluation] = useState(getInitialVisibility);
  const [lines, setLines] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [state, setState] = useState({
    host: null,
    language: "en",
    sanText: "",
  });

  const moveCount = useMemo(() => sanMovesFromText(state.sanText).length, [state.sanText]);
  const fen = useMemo(() => gameFromSanText(state.sanText).fen(), [state.sanText]);

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const statusPanel = document.querySelector(".status-panel");
        const movesList = document.querySelector(".moves-panel pre");
        const language = document.documentElement.lang === "el" ? "el" : "en";
        const sanText = movesList?.textContent || "";

        if (!statusPanel) {
          setState({ host: null, language, sanText });
          return;
        }

        let host = document.querySelector("[data-evaluation-panel-host]");
        if (!host) {
          host = document.createElement("section");
          host.dataset.evaluationPanelHost = "true";
          host.className = "evaluation-panel-host";
          statusPanel.insertAdjacentElement("afterend", host);
        }

        setState((previous) => {
          if (
            previous.host === host &&
            previous.language === language &&
            previous.sanText === sanText
          ) {
            return previous;
          }

          return { host, language, sanText };
        });
      });
    };

    sync();

    const rootObserver = new MutationObserver(sync);
    rootObserver.observe(document.getElementById("root") || document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const languageObserver = new MutationObserver(sync);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    return () => {
      rootObserver.disconnect();
      languageObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(STOCKFISH_WORKER_URL);
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = typeof event.data === "string" ? event.data : "";
      if (!message) return;

      for (const rawLine of message.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line === "readyok") {
          workerReadyRef.current = true;
          continue;
        }

        if (line.startsWith("bestmove")) {
          if (searchActiveRef.current) setAnalyzing(false);
          searchActiveRef.current = false;
          continue;
        }

        if (!searchActiveRef.current) continue;

        const parsed = parseEvaluationLine(line, currentFenRef.current);
        if (!parsed || parsed.multiPv > 3) continue;

        const previous = candidatesRef.current.get(parsed.multiPv);
        if (!previous || parsed.depth >= previous.depth) {
          candidatesRef.current.set(parsed.multiPv, parsed);
          setLines(
            [...candidatesRef.current.values()]
              .sort((a, b) => a.multiPv - b.multiPv)
              .slice(0, 3),
          );
        }
      }
    };

    worker.postMessage("uci");
    worker.postMessage("setoption name UCI_LimitStrength value false");
    worker.postMessage("setoption name Skill Level value 20");
    worker.postMessage("setoption name MultiPV value 3");
    worker.postMessage("isready");

    return () => {
      window.clearTimeout(analysisTimerRef.current);
      searchActiveRef.current = false;
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showEvaluation));

    const worker = workerRef.current;
    currentFenRef.current = fen;
    candidatesRef.current.clear();
    setLines([]);
    window.clearTimeout(analysisTimerRef.current);

    if (!worker || !showEvaluation || moveCount === 0) {
      searchActiveRef.current = false;
      setAnalyzing(false);
      worker?.postMessage("stop");
      return;
    }

    setAnalyzing(true);
    searchActiveRef.current = false;
    worker.postMessage("stop");

    analysisTimerRef.current = window.setTimeout(() => {
      if (!workerReadyRef.current || !showEvaluation) {
        setAnalyzing(false);
        return;
      }

      candidatesRef.current.clear();
      searchActiveRef.current = true;
      worker.postMessage("setoption name MultiPV value 3");
      worker.postMessage(`position fen ${currentFenRef.current}`);
      worker.postMessage("go depth 12 nodes 120000");
    }, 100);
  }, [fen, moveCount, showEvaluation]);

  if (!state.host) return null;

  const isGreek = state.language === "el";
  const toggleLabel = showEvaluation
    ? isGreek ? "Απόκρυψη αξιολόγησης" : "Hide evaluation"
    : isGreek ? "Εμφάνιση αξιολόγησης" : "Show evaluation";
  const heading = isGreek ? "Αξιολόγηση Stockfish" : "Stockfish evaluation";
  const emptyText = isGreek
    ? "Παίξε μία κίνηση για να εμφανιστεί αξιολόγηση."
    : "Play a move to see an evaluation.";
  const analyzingText = isGreek ? "Ανάλυση…" : "Analyzing…";
  const depthLabel = isGreek ? "βάθος" : "depth";

  return createPortal(
    <div className="evaluation-panel">
      <div className="evaluation-toolbar">
        <strong>{heading}</strong>
        <button
          aria-controls="stockfish-evaluation-lines"
          aria-expanded={showEvaluation}
          onClick={() => setShowEvaluation((current) => !current)}
          type="button"
        >
          {toggleLabel}
        </button>
      </div>

      {showEvaluation ? (
        <div className="evaluation-lines" id="stockfish-evaluation-lines" aria-live="polite">
          {moveCount === 0 ? <p>{emptyText}</p> : null}
          {moveCount > 0 && lines.length === 0 ? <p>{analyzingText}</p> : null}
          {lines.slice(0, 3).map((item) => (
            <p key={item.multiPv}>
              <span>{item.multiPv}. {formatScore(item)}</span>
              <span>{item.san || "—"}</span>
              <small>{depthLabel} {item.depth}</small>
            </p>
          ))}
          {analyzing && lines.length > 0 ? <span className="evaluation-progress" aria-label={analyzingText} /> : null}
        </div>
      ) : null}
    </div>,
    state.host,
  );
}
