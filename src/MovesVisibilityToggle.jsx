import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { getStoredBoolean, setStoredValue } from "./storage.js";

const STORAGE_KEY = "blindfold-show-moves";
const EMPTY_MOVE_TEXTS = new Set(["", "No moves yet.", "Δεν υπάρχουν κινήσεις ακόμη."]);

function getInitialVisibility() {
  return getStoredBoolean(STORAGE_KEY, true);
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

function moveLinesFromMoves(moves) {
  const moveLines = [];

  for (let index = 0; index < moves.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const whiteMove = moves[index];
    const blackMove = moves[index + 1];
    moveLines.push(`${moveNumber}. ${whiteMove}${blackMove ? ` ${blackMove}` : ""}`);
  }

  return moveLines;
}

function createPgn(sanText, explicitResult) {
  const moves = sanMovesFromText(sanText);
  if (moves.length === 0) return null;

  const chess = gameFromSanText(sanText);
  const result = explicitResult || gameResult(chess);
  const date = cyprusDateParts();
  const moveLines = moveLinesFromMoves(moves);
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

function downloadPgn(sanText, explicitResult) {
  const pgn = createPgn(sanText, explicitResult);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openPrintableGame(sanText, language, autoPrint = false, explicitResult = null) {
  const moves = sanMovesFromText(sanText);
  if (moves.length === 0) return;

  const chess = gameFromSanText(sanText);
  const result = explicitResult || gameResult(chess);
  const date = cyprusDateParts();
  const isGreek = language === "el";
  const labels = isGreek
    ? {
        title: "Blindfold Chess — Παρτίδα",
        date: "Ημερομηνία",
        white: "Λευκά",
        black: "Μαύρα",
        result: "Αποτέλεσμα",
        moves: "Κινήσεις (SAN)",
        finalFen: "Τελικό FEN",
        player: "Παίκτης",
        stockfish: "Stockfish",
        print: "Εκτύπωση",
        close: "Κλείσιμο",
      }
    : {
        title: "Blindfold Chess — Game",
        date: "Date",
        white: "White",
        black: "Black",
        result: "Result",
        moves: "Moves (SAN)",
        finalFen: "Final FEN",
        player: "Player",
        stockfish: "Stockfish",
        print: "Print",
        close: "Close",
      };
  const moveLines = moveLinesFromMoves(moves);
  const printableWindow = window.open("", "_blank");

  if (!printableWindow) return;
  printableWindow.opener = null;

  const formattedDate = `${date.year}-${date.month}-${date.day} ${date.hour}:${date.minute}`;
  const moveMarkup = moveLines
    .map((line) => `<li>${escapeHtml(line.replace(/^\d+\.\s*/, ""))}</li>`)
    .join("");

  printableWindow.document.open();
  printableWindow.document.write(`<!doctype html>
<html lang="${isGreek ? "el" : "en"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(labels.title)}</title>
  <style>
    :root { font-family: Georgia, "Times New Roman", serif; color: #201b16; background: #f5efe5; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 2rem; }
    main { width: min(760px, 100%); margin: 0 auto; background: #fff; border: 1px solid #cdbb9f; border-radius: 14px; padding: 2rem; }
    h1 { margin: 0 0 1.5rem; font-size: clamp(1.7rem, 4vw, 2.5rem); }
    h2 { margin-top: 2rem; font-size: 1.15rem; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; margin: 0; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    ol { columns: 2; column-gap: 2.5rem; padding-left: 1.5rem; }
    li { break-inside: avoid; margin-bottom: 0.35rem; }
    code { display: block; overflow-wrap: anywhere; padding: 0.8rem; background: #f3eee6; border-radius: 8px; }
    .actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-bottom: 1.5rem; }
    button { min-height: 40px; padding: 0.55rem 0.9rem; border: 1px solid #8b6b3f; border-radius: 8px; background: #fff; font: inherit; cursor: pointer; }
    button:first-child { background: #8b6b3f; color: #fff; }
    @media (max-width: 560px) { body { padding: 0.75rem; } main { padding: 1.15rem; } ol { columns: 1; } }
    @media print {
      :root { background: #fff; }
      body { padding: 0; }
      main { width: 100%; border: 0; border-radius: 0; padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <div class="actions">
      <button type="button" onclick="window.print()">${escapeHtml(labels.print)}</button>
      <button type="button" onclick="window.close()">${escapeHtml(labels.close)}</button>
    </div>
    <h1>${escapeHtml(labels.title)}</h1>
    <dl>
      <dt>${escapeHtml(labels.date)}</dt><dd>${escapeHtml(formattedDate)} (Europe/Nicosia)</dd>
      <dt>${escapeHtml(labels.white)}</dt><dd>${escapeHtml(labels.player)}</dd>
      <dt>${escapeHtml(labels.black)}</dt><dd>${escapeHtml(labels.stockfish)}</dd>
      <dt>${escapeHtml(labels.result)}</dt><dd>${escapeHtml(result)}</dd>
    </dl>
    <h2>${escapeHtml(labels.moves)}</h2>
    <ol>${moveMarkup}</ol>
    <h2>${escapeHtml(labels.finalFen)}</h2>
    <code>${escapeHtml(chess.fen())}</code>
  </main>
</body>
</html>`);
  printableWindow.document.close();

  if (autoPrint) {
    let printRequested = false;
    const requestPrint = () => {
      if (printRequested || printableWindow.closed) return;
      printRequested = true;
      printableWindow.print();
    };

    printableWindow.addEventListener("load", requestPrint, { once: true });
    window.setTimeout(requestPrint, 300);
  }
}

export default function MovesVisibilityToggle({ gameResult: explicitResult, language, sanText }) {
  const [showMoves, setShowMoves] = useState(getInitialVisibility);

  useEffect(() => {
    setStoredValue(STORAGE_KEY, showMoves);
  }, [showMoves]);

  const isGreek = language === "el";
  const visibilityLabel = showMoves
    ? isGreek ? "Απόκρυψη κινήσεων" : "Hide moves"
    : isGreek ? "Εμφάνιση κινήσεων" : "Show moves";
  const downloadLabel = isGreek ? "Λήψη παρτίδας" : "Download game";
  const printPreviewLabel = isGreek ? "Προεπισκόπηση εκτύπωσης" : "Print Preview";
  const printLabel = isGreek ? "Εκτύπωση" : "Print";
  const hasMoves = sanMovesFromText(sanText).length > 0;

  return (
    <>
      <div
        data-moves-visibility-host="true"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: "0.5rem",
          marginBottom: "0.65rem",
        }}
      >
        <button
          aria-controls="moves-san-list"
          aria-expanded={showMoves}
          onClick={() => setShowMoves((current) => !current)}
          style={{ minHeight: 36, padding: "0.45rem 0.75rem" }}
          type="button"
        >
          {visibilityLabel} (SAN)
        </button>
        <button
          disabled={!hasMoves}
          onClick={() => downloadPgn(sanText, explicitResult)}
          style={{ minHeight: 36, padding: "0.45rem 0.75rem" }}
          type="button"
        >
          {downloadLabel} (PGN)
        </button>
        <button
          disabled={!hasMoves}
          onClick={() => openPrintableGame(sanText, language, false, explicitResult)}
          style={{ minHeight: 36, padding: "0.45rem 0.75rem" }}
          type="button"
        >
          {printPreviewLabel}
        </button>
        <button
          disabled={!hasMoves}
          onClick={() => openPrintableGame(sanText, language, true, explicitResult)}
          style={{ minHeight: 36, padding: "0.45rem 0.75rem" }}
          type="button"
        >
          {printLabel}
        </button>
      </div>
      <pre hidden={!showMoves} id="moves-san-list">{sanText}</pre>
    </>
  );
}
