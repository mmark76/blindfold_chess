import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import "./board-visibility.css";

const STORAGE_KEY = "blindfold-show-board";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECES = Object.freeze({
  K: "♔\uFE0E",
  Q: "♕\uFE0E",
  R: "♖\uFE0E",
  B: "♗\uFE0E",
  N: "♘\uFE0E",
  P: "♙\uFE0E",
  k: "♚\uFE0E",
  q: "♛\uFE0E",
  r: "♜\uFE0E",
  b: "♝\uFE0E",
  n: "♞\uFE0E",
  p: "♟\uFE0E",
});

const PIECE_NAMES = Object.freeze({
  en: {
    K: "white king",
    Q: "white queen",
    R: "white rook",
    B: "white bishop",
    N: "white knight",
    P: "white pawn",
    k: "black king",
    q: "black queen",
    r: "black rook",
    b: "black bishop",
    n: "black knight",
    p: "black pawn",
  },
  el: {
    K: "λευκός βασιλιάς",
    Q: "λευκή βασίλισσα",
    R: "λευκός πύργος",
    B: "λευκός αξιωματικός",
    N: "λευκός ίππος",
    P: "λευκό πιόνι",
    k: "μαύρος βασιλιάς",
    q: "μαύρη βασίλισσα",
    r: "μαύρος πύργος",
    b: "μαύρος αξιωματικός",
    n: "μαύρος ίππος",
    p: "μαύρο πιόνι",
  },
});

function readSanText() {
  return document.querySelector(".moves-panel pre")?.textContent?.trim() || "";
}

function sanMovesFromText(text) {
  if (!text || text === "No moves yet." || text === "Δεν υπάρχουν κινήσεις ακόμη.") {
    return [];
  }

  return text
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+\.$/.test(token));
}

function positionFromSanText(text) {
  const chess = new Chess();

  for (const san of sanMovesFromText(text)) {
    try {
      const move = chess.move(san, { sloppy: true });
      if (!move) break;
    } catch {
      break;
    }
  }

  return chess.fen();
}

function squaresFromFen(fen) {
  const rows = fen.split(" ")[0].split("/");
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

  return squares;
}

function getInitialVisibility() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getPieceColorClass(piece) {
  if (!piece) return "";
  return piece === piece.toUpperCase() ? "is-white-piece" : "is-black-piece";
}

export default function BoardVisibilityToggle() {
  const [showBoard, setShowBoard] = useState(getInitialVisibility);
  const [state, setState] = useState({
    host: null,
    language: "en",
    sanText: "",
  });

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const movesPanel = document.querySelector(".moves-panel");
        const language = document.documentElement.lang === "el" ? "el" : "en";
        const sanText = readSanText();

        if (!movesPanel) {
          setState({ host: null, language, sanText });
          return;
        }

        let host = document.querySelector("[data-board-visibility-host]");
        if (!host) {
          host = document.createElement("section");
          host.dataset.boardVisibilityHost = "true";
          host.className = "board-visibility-panel";
          movesPanel.insertAdjacentElement("afterend", host);
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
    localStorage.setItem(STORAGE_KEY, String(showBoard));
  }, [showBoard]);

  const fen = useMemo(() => positionFromSanText(state.sanText), [state.sanText]);
  const squares = useMemo(() => squaresFromFen(fen), [fen]);

  if (!state.host) return null;

  const isGreek = state.language === "el";
  const buttonLabel = showBoard
    ? isGreek ? "Απόκρυψη σκακιέρας" : "Hide board"
    : isGreek ? "Εμφάνιση σκακιέρας" : "Show board";
  const turn = fen.split(" ")[1];
  const turnLabel = isGreek
    ? turn === "w" ? "Παίζουν τα λευκά" : "Παίζουν τα μαύρα"
    : turn === "w" ? "White to move" : "Black to move";
  const boardLabel = isGreek ? "Τρέχουσα σκακιστική θέση" : "Current chess position";
  const pieceNames = PIECE_NAMES[state.language] || PIECE_NAMES.en;

  return createPortal(
    <>
      <div className="board-visibility-toolbar">
        <button
          aria-controls="current-chessboard"
          aria-expanded={showBoard}
          onClick={() => setShowBoard((current) => !current)}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>

      {showBoard ? (
        <div className="board-visibility-content">
          <p className="board-turn-label">{turnLabel}</p>
          <div
            aria-label={`${boardLabel}. ${turnLabel}. FEN: ${fen}`}
            className="chessboard"
            id="current-chessboard"
            role="grid"
          >
            {squares.map(({ square, piece, rowIndex, fileIndex }) => {
              const isLight = (rowIndex + fileIndex) % 2 === 0;
              const pieceName = piece ? pieceNames[piece] : "";
              const pieceColorClass = getPieceColorClass(piece);

              return (
                <span
                  aria-label={pieceName ? `${square}: ${pieceName}` : square}
                  className={`chessboard-square ${isLight ? "is-light" : "is-dark"}`}
                  key={square}
                  role="gridcell"
                  title={pieceName ? `${square}: ${pieceName}` : square}
                >
                  <span
                    aria-hidden="true"
                    className={`chessboard-piece ${pieceColorClass}`.trim()}
                  >
                    {PIECES[piece] || ""}
                  </span>
                  {fileIndex === 0 ? <small className="rank-label" aria-hidden="true">{8 - rowIndex}</small> : null}
                  {rowIndex === 7 ? <small className="file-label" aria-hidden="true">{FILES[fileIndex]}</small> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </>,
    state.host,
  );
}
