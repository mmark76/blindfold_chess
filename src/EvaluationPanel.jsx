import React, { useEffect, useRef, useState } from "react";
import { EvaluationStockfishController } from "./engine/EvaluationStockfishController.js";
import { formatEvaluationScore, parseEvaluationLine } from "./engine/evaluationParsing.js";
import { setStoredValue } from "./storage.js";
import "./evaluation-panel.css";

const STORAGE_KEY = "blindfold-show-evaluation";
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";
export default function EvaluationPanel({
  fen,
  gameplayBusy = false,
  language = "en",
  moveCount = 0,
  onVisibilityChange = () => {},
  showEvaluation = false,
}) {
  const controllerRef = useRef(null);
  const candidatesRef = useRef(new Map());
  const analysisTimerRef = useRef(0);

  const [lines, setLines] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineError, setEngineError] = useState(false);

  useEffect(() => {
    if (!showEvaluation) return undefined;

    let controller = null;
    setEngineError(false);

    try {
      const worker = new Worker(STOCKFISH_WORKER_URL);
      controller = new EvaluationStockfishController(worker, {
        onComplete: () => setAnalyzing(false),
        onError: () => {
          setAnalyzing(false);
          setEngineError(true);
        },
        onInfo: (line, request) => {
          const parsed = parseEvaluationLine(line, request.fen);
          if (!parsed || parsed.multiPv > 3) return;

          const previous = candidatesRef.current.get(parsed.multiPv);
          if (!previous || parsed.depth >= previous.depth) {
            candidatesRef.current.set(parsed.multiPv, parsed);
            setLines(
              [...candidatesRef.current.values()]
                .sort((a, b) => a.multiPv - b.multiPv)
                .slice(0, 3),
            );
          }
        },
      });
      controllerRef.current = controller;
      controller.start();
    } catch {
      setAnalyzing(false);
      setEngineError(true);
    }

    return () => {
      window.clearTimeout(analysisTimerRef.current);
      if (controllerRef.current === controller) controllerRef.current = null;
      controller?.destroy();
    };
  }, [showEvaluation]);

  useEffect(() => {
    setStoredValue(STORAGE_KEY, showEvaluation);

    const controller = controllerRef.current;
    candidatesRef.current.clear();
    setLines([]);
    window.clearTimeout(analysisTimerRef.current);
    controller?.cancel();

    if (!controller || !showEvaluation || moveCount === 0 || gameplayBusy) {
      setAnalyzing(false);
      return;
    }

    setEngineError(false);
    setAnalyzing(true);

    analysisTimerRef.current = window.setTimeout(() => {
      const analysisId = controller.analyze({ depth: 12, fen, nodes: 120000 });
      if (analysisId === null) {
        setAnalyzing(false);
        setEngineError(true);
      }
    }, 100);

    return () => window.clearTimeout(analysisTimerRef.current);
  }, [fen, gameplayBusy, moveCount, showEvaluation]);

  const isGreek = language === "el";
  const toggleLabel = showEvaluation
    ? isGreek ? "Απόκρυψη αξιολόγησης" : "Hide evaluation"
    : isGreek ? "Εμφάνιση αξιολόγησης" : "Show evaluation";
  const heading = isGreek ? "Αξιολόγηση Stockfish" : "Stockfish evaluation";
  const engineVersion = isGreek
    ? "Μηχανή: Stockfish 17.1 Lite · μονό νήμα"
    : "Engine: Stockfish 17.1 Lite · single-thread";
  const emptyText = isGreek
    ? "Παίξε μία κίνηση για να εμφανιστεί αξιολόγηση."
    : "Play a move to see an evaluation.";
  const analyzingText = isGreek ? "Ανάλυση…" : "Analyzing…";
  const engineErrorText = isGreek ? "Η αξιολόγηση δεν είναι διαθέσιμη." : "Evaluation is unavailable.";
  const depthLabel = isGreek ? "βάθος" : "depth";

  return (
    <section
      className="evaluation-panel-host"
      data-evaluation-panel-host="true"
      id="stockfish-evaluation-panel"
    >
      <div className="evaluation-panel">
      <div className="evaluation-toolbar">
        <div className="evaluation-title">
          <strong>{heading}</strong>
          <small>{engineVersion}</small>
        </div>
        <button
          aria-controls="stockfish-evaluation-lines"
          aria-expanded={showEvaluation}
          onClick={() => onVisibilityChange(!showEvaluation)}
          type="button"
        >
          {toggleLabel}
        </button>
      </div>

      {showEvaluation ? (
        <div className="evaluation-lines" id="stockfish-evaluation-lines" aria-live="polite">
          {moveCount === 0 ? <p>{emptyText}</p> : null}
          {moveCount > 0 && engineError ? <p>{engineErrorText}</p> : null}
          {moveCount > 0 && !engineError && lines.length === 0 ? <p>{analyzingText}</p> : null}
          {lines.slice(0, 3).map((item) => (
            <p key={item.multiPv}>
              <span>{item.multiPv}. {formatEvaluationScore(item)}</span>
              <span>{item.pvSan || "—"}</span>
              <small>{depthLabel} {item.depth}</small>
            </p>
          ))}
          {analyzing && lines.length > 0 ? <span className="evaluation-progress" aria-label={analyzingText} /> : null}
        </div>
      ) : null}
      </div>
    </section>
  );
}
