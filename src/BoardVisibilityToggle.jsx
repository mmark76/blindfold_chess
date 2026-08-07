import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";
import "./board-visibility.css";

const STORAGE_KEY = "blindfold-show-board";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECES = Object.freeze({
  K: "♚\uFE0E",
  Q: "♛\uFE0E",
  R: "♜\uFE0E",
  B: "♝\uFE0E",
  N: "♞\uFE0E",
  P: "♟\uFE0E",
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

function getMoveFormElements() {
  const input = document.querySelector('.move-form input[type="text"]');
  const form = input?.closest("form") || null;
  return { form, input };
}

function submitSanThroughMoveForm(san) {
  const { form, input } = getMoveFormElements();
  if (!form || !input || input.disabled) return false;

  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  if (valueSetter) {
    valueSetter.call(input, san);
  } else {
    input.value = san;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  window.setTimeout(() => {
    if (!input.disabled) form.requestSubmit();
  }, 0);

  return true;
}

function moveFromSquares(fen, from, to) {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return null;

  const promotion = piece.type === "p" && (to.endsWith("8") || to.endsWith("1"))
    ? "q"
    : undefined;

  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

function setPieceDragImage(event) {
  const pieceElement = event.currentTarget.querySelector(".chessboard-piece");
  if (!pieceElement || !event.dataTransfer) return;

  const dragImage = pieceElement.cloneNode(true);
  dragImage.setAttribute("aria-hidden", "true");
  Object.assign(dragImage.style, {
    position: "fixed",
    left: "-9999px",
    top: "-9999px",
    display: "block",
    width: "auto",
    height: "auto",
    margin: "0",
    padding: "0",
    border: "0",
    background: "transparent",
    boxShadow: "none",
    pointerEvents: "none",
    zIndex: "2147483647",
  });

  document.body.appendChild(dragImage);
  const rect = dragImage.getBoundingClientRect();
  event.dataTransfer.setDragImage(
    dragImage,
    Math.max(1, rect.width / 2),
    Math.max(1, rect.height / 2),
  );
  window.setTimeout(() => dragImage.remove(), 0);
}

export default function BoardVisibilityToggle() {
  const [showBoard, setShowBoard] = useState(getInitialVisibility);
  const [selectedSquare, setSelectedSquare] = useState("");
  const [interactionMessage, setInteractionMessage] = useState("");
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
          movesPanel.insertAdjacentElement("beforebegin", host);
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
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Set();

    const chess = new Chess(fen);
    try {
      return new Set(
        chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to),
      );
    } catch {
      return new Set();
    }
  }, [fen, selectedSquare]);

  useEffect(() => {
    setSelectedSquare("");
    setInteractionMessage("");
  }, [fen]);

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
  const defaultInteractionText = isGreek
    ? "Κάνε κλικ σε λευκό κομμάτι και μετά στο τετράγωνο προορισμού ή σύρε το με το ποντίκι."
    : "Click a white piece and then its destination, or drag it with the mouse.";

  const blockedMessage = isGreek
    ? "Περίμενε να ολοκληρώσει την κίνησή του το Stockfish."
    : "Wait for Stockfish to finish its move.";
  const chooseWhiteMessage = isGreek
    ? "Επίλεξε ένα λευκό κομμάτι."
    : "Select a white piece.";
  const illegalMessage = isGreek ? "Μη νόμιμη κίνηση." : "Illegal move.";

  const canUseBoardInput = () => {
    const { input } = getMoveFormElements();
    return Boolean(input && !input.disabled && turn === "w");
  };

  const attemptMove = (from, to) => {
    if (!canUseBoardInput()) {
      setInteractionMessage(blockedMessage);
      return;
    }

    const move = moveFromSquares(fen, from, to);
    if (!move) {
      setInteractionMessage(illegalMessage);
      return;
    }

    if (!submitSanThroughMoveForm(move.san)) {
      setInteractionMessage(blockedMessage);
      return;
    }

    setSelectedSquare("");
    setInteractionMessage(
      isGreek ? `Υποβλήθηκε η κίνηση ${move.san}.` : `Move ${move.san} submitted.`,
    );
  };

  const handleSquareClick = (square) => {
    if (!canUseBoardInput()) {
      setInteractionMessage(blockedMessage);
      return;
    }

    const chess = new Chess(fen);
    const clickedPiece = chess.get(square);

    if (!selectedSquare) {
      if (!clickedPiece || clickedPiece.color !== "w") {
        setInteractionMessage(chooseWhiteMessage);
        return;
      }

      setSelectedSquare(square);
      setInteractionMessage(
        isGreek ? `Επιλέχθηκε ${square}. Διάλεξε προορισμό.` : `${square} selected. Choose a destination.`,
      );
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare("");
      setInteractionMessage("");
      return;
    }

    if (clickedPiece?.color === "w") {
      setSelectedSquare(square);
      setInteractionMessage(
        isGreek ? `Επιλέχθηκε ${square}. Διάλεξε προορισμό.` : `${square} selected. Choose a destination.`,
      );
      return;
    }

    attemptMove(selectedSquare, square);
  };

  const handleDragStart = (event, square) => {
    const chess = new Chess(fen);
    const piece = chess.get(square);

    if (!canUseBoardInput() || !piece || piece.color !== "w") {
      event.preventDefault();
      setInteractionMessage(canUseBoardInput() ? chooseWhiteMessage : blockedMessage);
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", square);
    setPieceDragImage(event);
    setSelectedSquare(square);
    setInteractionMessage(
      isGreek ? `Μετακίνησε το ${square} σε νόμιμο τετράγωνο.` : `Drag ${square} to a legal square.`,
    );
  };

  const handleDrop = (event, to) => {
    event.preventDefault();
    const from = event.dataTransfer.getData("text/plain") || selectedSquare;
    if (from) attemptMove(from, to);
  };

  return createPortal(
    <>
      <div className="board-visibility-toolbar">
        <button
          aria-controls="current-chessboard"
          aria-expanded={showBoard}
          onClick={() => {
            setShowBoard((current) => !current);
            setSelectedSquare("");
            setInteractionMessage("");
          }}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>

      {showBoard ? (
        <div className="board-visibility-content">
          <p className="board-turn-label">{turnLabel}</p>
          <p className="board-interaction-help" aria-live="polite">
            {interactionMessage || defaultInteractionText}
          </p>
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
              const isSelected = selectedSquare === square;
              const isLegalTarget = legalTargets.has(square);
              const squareClassName = [
                "chessboard-square",
                isLight ? "is-light" : "is-dark",
                piece ? "has-piece" : "",
                isSelected ? "is-selected" : "",
                isLegalTarget ? "is-legal-target" : "",
              ].filter(Boolean).join(" ");

              return (
                <button
                  aria-label={pieceName ? `${square}: ${pieceName}` : square}
                  aria-pressed={isSelected}
                  className={squareClassName}
                  draggable={Boolean(piece && piece === piece.toUpperCase() && turn === "w")}
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  onDragOver={(event) => {
                    if (selectedSquare) event.preventDefault();
                  }}
                  onDragStart={(event) => handleDragStart(event, square)}
                  onDrop={(event) => handleDrop(event, square)}
                  role="gridcell"
                  title={pieceName ? `${square}: ${pieceName}` : square}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`chessboard-piece ${pieceColorClass}`.trim()}
                  >
                    {PIECES[piece] || ""}
                  </span>
                  {fileIndex === 0 ? <small className="rank-label" aria-hidden="true">{8 - rowIndex}</small> : null}
                  {rowIndex === 7 ? <small className="file-label" aria-hidden="true">{FILES[fileIndex]}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>,
    state.host,
  );
}
