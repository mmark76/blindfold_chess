import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Chess } from "chess.js";

const STORAGE_KEY = "blindfold-show-moves";
const EMPTY_MOVE_TEXTS = new Set(["", "No moves yet.", "Δεν υπάρχουν κινήσεις ακόμη."]);

function getInitialVisibility() {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

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

function gameResult(chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" : "1-0";
  if (chess.isDraw()) return "1/2-1/2";
  return "*";
}

function cyprusDateParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function createPgn(sanText) {
  const moves = sanMovesFromText(sanText);
  if (moves.length === 0) return null;

  const chess = gameFromSanText(sanText);
  const result = gameResult(chess);
  const date = cyprusDateParts();
  const moveLines = [];

  for (let index = 0; index < moves.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const whiteMove = moves[index];
    const blackMove = moves[index + 1];
    moveLines.push(`${moveNumber}. ${whiteMove}${blackMove ? ` ${blackMove}` : ""}`);
  }

  const headers = [
    '[Event "Blindfold Chess"]',
    '[Site "https://blindfoldchess.markellosecosystem.com/"]',
    `[Date "${date.year}.${date.month}.${date.day}"]`,
    '[Round "-"]',
    '[White "Player"]',
    '[Black "Stockfish"]',
    `[Result "${result}"]`,
  ];

  return `${headers.join("\n")}\n\n${moveLines.join("\n")} ${result}\n`;
}

function downloadPgn(sanText) {
  const pgn = createPgn(sanText);
  if (!pgn) return;

  const date = cyprusDateParts();
  const filename = `blindfold-chess_${date.year}${date.month}${date.day}_${date.hour}${date.minute}.pgn`;
  const blob = new Blob([pgn], { type: "application/x-chess-pgn;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MovesVisibilityToggle() {
  const [showMoves, setShowMoves] = useState(getInitialVisibility);
  const [state, setState] = useState({
    host: null,
    movesList: null,
    language: "en",
    sanText: "",
  });

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const panel = document.querySelector(".moves-panel");
        const movesList = panel?.querySelector("pre") || null;
        const language = document.documentElement.lang === "el" ? "el" : "en";
        const sanText = movesList?.textContent || "";

        if (!panel || !movesList) {
          setState({ host: null, movesList: null, language, sanText });
          return;
        }

        movesList.id = "moves-san-list";

        let host = panel.querySelector("[data-moves-visibility-host]");
        if (!host) {
          host = document.createElement("div");
          host.dataset.movesVisibilityHost = "true";
          host.style.display = "flex";
          host.style.flexWrap = "wrap";
          host.style.justifyContent = "flex-end";
          host.style.gap = "0.5rem";
          host.style.marginBottom = "0.65rem";
          panel.insertBefore(host, movesList);
        }

        setState((previous) => {
          if (
            previous.host === host &&
            previous.movesList === movesList &&
            previous.language === language &&
            previous.sanText === sanText
          ) {
            return previous;
          }

          return { host, movesList, language, sanText };
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
    localStorage.setItem(STORAGE_KEY, String(showMoves));

    if (state.movesList) {
      state.movesList.hidden = !showMoves;
    }
  }, [showMoves, state.movesList]);

  if (!state.host) return null;

  const isGreek = state.language === "el";
  const visibilityLabel = showMoves
    ? isGreek ? "Απόκρυψη κινήσεων" : "Hide moves"
    : isGreek ? "Εμφάνιση κινήσεων" : "Show moves";
  const downloadLabel = isGreek ? "Λήψη παρτίδας" : "Download game";
  const printPreviewLabel = isGreek ? "Προεπισκόπηση εκτύπωσης" : "Print Preview";
  const hasMoves = sanMovesFromText(state.sanText).length > 0;

  return createPortal(
    <>
      <button
        aria-controls="moves-san-list"
        aria-expanded={showMoves}
        onClick={() => setShowMoves((current) => !current)}
        style={{
          minHeight: 36,
          padding: "0.45rem 0.75rem",
        }}
        type="button"
      >
        {visibilityLabel} (SAN)
      </button>
      <button
        disabled={!hasMoves}
        onClick={() => downloadPgn(state.sanText)}
        style={{
          minHeight: 36,
          padding: "0.45rem 0.75rem",
        }}
        type="button"
      >
        {downloadLabel} (PGN)
      </button>
      <button
        disabled={!hasMoves}
        onClick={() => window.print()}
        style={{
          minHeight: 36,
          padding: "0.45rem 0.75rem",
        }}
        type="button"
      >
        {printPreviewLabel}
      </button>
    </>,
    state.host,
  );
}
