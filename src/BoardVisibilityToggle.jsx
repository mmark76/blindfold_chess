import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { moveFromSquares, squaresFromFen } from "./chess/board.js";
import { getStoredBoolean, setStoredValue } from "./storage.js";
import "./board-visibility.css";

const STORAGE_KEY = "blindfold-show-board";
const INITIAL_FEN = new Chess().fen();
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

function getInitialVisibility() {
  return getStoredBoolean(STORAGE_KEY, false);
}

function getPieceColorClass(piece) {
  if (!piece) return "";
  return piece === piece.toUpperCase() ? "is-white-piece" : "is-black-piece";
}

function setPieceDragImage(event) {
  const pieceElement = event.currentTarget;
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

export default function BoardVisibilityToggle({
  fen = INITIAL_FEN,
  inputDisabled = false,
  language = "en",
  onSubmitMove = () => false,
}) {
  const boardRef = useRef(null);
  const squareRefs = useRef(new Map());
  const [showBoard, setShowBoard] = useState(getInitialVisibility);
  const [selectedSquare, setSelectedSquare] = useState("");
  const [focusedSquare, setFocusedSquare] = useState("a8");
  const [interactionMessage, setInteractionMessage] = useState("");
  useEffect(() => {
    setStoredValue(STORAGE_KEY, showBoard);
  }, [showBoard]);

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

  const isGreek = language === "el";
  const buttonLabel = showBoard
    ? isGreek ? "Απόκρυψη σκακιέρας" : "Hide board"
    : isGreek ? "Εμφάνιση σκακιέρας" : "Show board";
  const turn = fen.split(" ")[1];
  const turnLabel = isGreek
    ? turn === "w" ? "Παίζουν τα λευκά" : "Παίζουν τα μαύρα"
    : turn === "w" ? "White to move" : "Black to move";
  const boardLabel = isGreek ? "Τρέχουσα σκακιστική θέση" : "Current chess position";
  const pieceNames = PIECE_NAMES[language] || PIECE_NAMES.en;
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

  const canUseBoardInput = () => !inputDisabled && turn === "w";

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

    if (onSubmitMove(move.san) === false) {
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

  const handleSquareKeyDown = (event, square) => {
    const fileIndex = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    let nextFileIndex = fileIndex;
    let nextRank = rank;

    switch (event.key) {
      case "ArrowUp":
        nextRank = Math.min(8, rank + 1);
        break;
      case "ArrowDown":
        nextRank = Math.max(1, rank - 1);
        break;
      case "ArrowLeft":
        nextFileIndex = Math.max(0, fileIndex - 1);
        break;
      case "ArrowRight":
        nextFileIndex = Math.min(7, fileIndex + 1);
        break;
      case "Home":
        nextFileIndex = 0;
        break;
      case "End":
        nextFileIndex = 7;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextSquare = `${FILES[nextFileIndex]}${nextRank}`;
    setFocusedSquare(nextSquare);
    squareRefs.current.get(nextSquare)?.focus();
  };

  return (
    <section className="board-visibility-panel" data-board-visibility-host="true">
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
            aria-colcount={8}
            aria-disabled={inputDisabled || turn !== "w"}
            aria-label={`${boardLabel}. ${turnLabel}. FEN: ${fen}`}
            aria-rowcount={8}
            className="chessboard"
            id="current-chessboard"
            ref={boardRef}
            role="grid"
          >
            {Array.from({ length: 8 }, (_, boardRowIndex) => (
              <div className="chessboard-row" key={boardRowIndex} role="row">
                {squares
                  .slice(boardRowIndex * 8, boardRowIndex * 8 + 8)
                  .map(({ square, piece, rowIndex, fileIndex }) => {
                    const isLight = (rowIndex + fileIndex) % 2 === 0;
                    const pieceName = piece ? pieceNames[piece] : "";
                    const pieceColorClass = getPieceColorClass(piece);
                    const isSelected = selectedSquare === square;
                    const isLegalTarget = legalTargets.has(square);
                    const isDraggable = Boolean(
                      piece && piece === piece.toUpperCase() && turn === "w" && !inputDisabled,
                    );
                    const squareClassName = [
                      "chessboard-square",
                      isLight ? "is-light" : "is-dark",
                      piece ? "has-piece" : "",
                      isSelected ? "is-selected" : "",
                      isLegalTarget ? "is-legal-target" : "",
                    ].filter(Boolean).join(" ");

                    return (
                      <button
                        aria-colindex={fileIndex + 1}
                        aria-label={pieceName ? `${square}: ${pieceName}` : square}
                        aria-rowindex={rowIndex + 1}
                        aria-selected={isSelected}
                        className={squareClassName}
                        data-square={square}
                        key={square}
                        onClick={() => handleSquareClick(square)}
                        onDragOver={(event) => {
                          if (selectedSquare) event.preventDefault();
                        }}
                        onDrop={(event) => handleDrop(event, square)}
                        onFocus={() => setFocusedSquare(square)}
                        onKeyDown={(event) => handleSquareKeyDown(event, square)}
                        ref={(element) => {
                          if (element) squareRefs.current.set(square, element);
                          else squareRefs.current.delete(square);
                        }}
                        role="gridcell"
                        tabIndex={focusedSquare === square ? 0 : -1}
                        title={pieceName ? `${square}: ${pieceName}` : square}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={`chessboard-piece ${pieceColorClass}`.trim()}
                          draggable={isDraggable}
                          onDragEnd={() => setSelectedSquare("")}
                          onDragStart={(event) => handleDragStart(event, square)}
                        >
                          {PIECES[piece] || ""}
                        </span>
                        {fileIndex === 0 ? <small className="rank-label" aria-hidden="true">{8 - rowIndex}</small> : null}
                        {rowIndex === 7 ? <small className="file-label" aria-hidden="true">{FILES[fileIndex]}</small> : null}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
