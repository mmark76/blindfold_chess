import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { sanFromSpeech } from "./voice/sanFromSpeech.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";

function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function uciToMove(uci) {
  if (!uci || uci === "(none)") return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length >= 5 ? uci[4] : undefined;
  return { from, to, promotion };
}

function formatMovesSan(moves) {
  if (moves.length === 0) return "No moves yet.";
  let out = "";
  for (let i = 0; i < moves.length; i++) {
    const moveNo = Math.floor(i / 2) + 1;
    if (i % 2 === 0) out += `${moveNo}. `;
    out += moves[i];
    out += i % 2 === 1 ? "\n" : " ";
  }
  return out.trimEnd();
}

function interpretConfirmCommand(raw) {
  const t = (raw || "").toLowerCase();

  const yes = ["confirm", "yes", "yeah", "yep", "ok", "okay", "go", "do it", "accept"];
  const no = ["cancel", "no", "nope", "stop", "reject", "discard"];
  const rep = ["repeat", "say again", "again", "what", "pardon"];

  if (yes.some((w) => t.includes(w))) return "CONFIRM";
  if (no.some((w) => t.includes(w))) return "CANCEL";
  if (rep.some((w) => t.includes(w))) return "REPEAT";
  return "UNKNOWN";
}

export default function App() {
  const chessRef = useRef(new Chess());
  const engineRef = useRef(null);
  const recogRef = useRef(null);

  const [moves, setMoves] = useState([]);
  const [status, setStatus] = useState("Enter a SAN move or press Start for voice input.");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [typedSan, setTypedSan] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [pendingSan, setPendingSan] = useState("");

  const speechSupported = Boolean(SpeechRecognition);

  useEffect(() => {
    if (!speechSupported) {
      setStatus("Voice input is unavailable. Enter a SAN move below.");
    }

    const w = new Worker(STOCKFISH_WORKER_URL);
    engineRef.current = w;

    w.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : "";
      if (!line || line.includes("uciok")) return;

      if (line.startsWith("bestmove")) {
        const parts = line.trim().split(/\s+/);
        const uci = parts[1] || "(none)";
        const chess = chessRef.current;
        const moveObj = uciToMove(uci);

        if (!moveObj) {
          setBusy(false);
          setStatus("Engine has no moves.");
          speak("I have no moves.");
          return;
        }

        const m = chess.move(moveObj);
        if (m) {
          setMoves((prev) => [...prev, m.san]);
          setStatus(`My move: ${m.san}. Enter your move or press Start.`);
          speak(`My move: ${m.san}. Your move.`);
        }

        setBusy(false);

        if (chess.isCheckmate()) {
          setStatus("Checkmate.");
          speak("Checkmate.");
          return;
        }
        if (chess.isDraw()) {
          setStatus("Draw.");
          speak("Draw.");
        }
      }
    };

    w.postMessage("uci");
    w.postMessage("isready");

    return () => w.terminate();
  }, [speechSupported]);

  function stopListening() {
    try {
      recogRef.current?.stop();
    } catch {}
    setListening(false);
  }

  function startListeningInternal(onResult) {
    if (!SpeechRecognition) {
      setStatus("Voice input is unavailable. Enter a SAN move below.");
      return;
    }

    stopListening();

    const r = new SpeechRecognition();
    recogRef.current = r;
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => setListening(true);
    r.onresult = (ev) => {
      const raw = ev.results?.[0]?.[0]?.transcript || "";
      onResult(raw);
    };
    r.onerror = () => {
      setListening(false);
      setStatus("Speech error. Enter the move below or press Start to try again.");
      setMode("MOVE");
      setPendingSan("");
    };
    r.onend = () => setListening(false);
    r.start();
  }

  function requestEngineMove() {
    const chess = chessRef.current;
    setBusy(true);
    setStatus("Engine thinking...");

    engineRef.current?.postMessage(`position fen ${chess.fen()}`);
    engineRef.current?.postMessage("go depth 8");
  }

  function applyPlayerSan(rawSan, source = "keyboard") {
    if (busy) return;

    const san = (rawSan || "").trim();
    if (!san) {
      setStatus("Enter a move in SAN, for example e4, Nf3 or O-O.");
      return;
    }

    const chess = chessRef.current;
    const m = chess.move(san, { sloppy: true });

    if (!m) {
      setMode("MOVE");
      setPendingSan("");
      setStatus("Illegal move. Enter SAN such as e4, Nf3 or O-O.");
      if (source === "voice") speak("Illegal move. Please try again.");
      return;
    }

    stopListening();
    setTypedSan("");
    setMoves((prev) => [...prev, m.san]);

    if (chess.isCheckmate()) {
      setStatus("Checkmate.");
      speak("Checkmate.");
      return;
    }
    if (chess.isDraw()) {
      setStatus("Draw.");
      speak("Draw.");
      return;
    }

    setMode("MOVE");
    setPendingSan("");
    setStatus(`You played: ${m.san}. Engine thinking...`);
    speak(`You played: ${m.san}.`);
    requestEngineMove();
  }

  function submitTypedMove(event) {
    event.preventDefault();
    applyPlayerSan(typedSan, "keyboard");
  }

  function startListeningForMove() {
    if (busy) return;

    setMode("MOVE");
    setPendingSan("");
    setStatus("Listening... Say your move.");

    startListeningInternal((raw) => {
      const san = sanFromSpeech(raw);

      if (!san) {
        setStatus(`Heard: "${raw}". Enter the move below or press Start to try again.`);
        speak("I did not catch that. Please try again.");
        return;
      }

      setMode("CONFIRM");
      setPendingSan(san);
      setStatus(`Heard: "${raw}" → ${san}. Say confirm or cancel.`);
      speak(`I heard ${san}. Confirm or cancel.`);
      startListeningForConfirm(san);
    });
  }

  function startListeningForConfirm(sanToConfirm) {
    if (busy) return;

    setStatus(`Confirm: ${sanToConfirm}. Say confirm or cancel.`);
    startListeningInternal((raw) => {
      const cmd = interpretConfirmCommand(raw);

      if (cmd === "CONFIRM") {
        applyPlayerSan(sanToConfirm, "voice");
        return;
      }

      if (cmd === "CANCEL") {
        stopListening();
        setMode("MOVE");
        setPendingSan("");
        setStatus("Canceled. Enter a move or press Start.");
        speak("Canceled.");
        return;
      }

      if (cmd === "REPEAT") {
        speak(`I heard ${sanToConfirm}. Confirm or cancel.`);
        startListeningForConfirm(sanToConfirm);
        return;
      }

      const maybeSan = sanFromSpeech(raw);
      if (maybeSan) {
        setPendingSan(maybeSan);
        setStatus(`Heard a new move: ${maybeSan}. Say confirm or cancel.`);
        speak(`I heard ${maybeSan}. Confirm or cancel.`);
        startListeningForConfirm(maybeSan);
        return;
      }

      setStatus(`Could not confirm ${sanToConfirm}. Enter the move below or press Start.`);
      speak("Please say confirm or cancel.");
    });
  }

  function newGame() {
    stopListening();
    chessRef.current = new Chess();
    setMoves([]);
    setTypedSan("");
    setBusy(false);
    setMode("MOVE");
    setPendingSan("");
    setStatus("New game. Enter a SAN move or press Start for voice input.");
    speak("New game. Your move.");
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ marginBottom: 8 }}>Play Blindfold Chess (Voice or Keyboard)</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button onClick={newGame} disabled={busy}>New game</button>
        <button onClick={startListeningForMove} disabled={busy || listening || !speechSupported}>Start voice</button>
        <button onClick={stopListening} disabled={!listening}>Stop</button>
      </div>

      <form onSubmit={submitTypedMove} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={typedSan}
          onChange={(event) => setTypedSan(event.target.value)}
          placeholder="Enter SAN: e4, Nf3, Bxe6, O-O"
          aria-label="Enter chess move in SAN"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          disabled={busy}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", fontSize: 16, border: "1px solid #bbb", borderRadius: 8 }}
        />
        <button type="submit" disabled={busy || !typedSan.trim()}>Play move</button>
      </form>

      <div style={{ padding: 12, border: "1px solid #ccc", borderRadius: 10, minHeight: 140 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Moves (SAN)</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {formatMovesSan(moves)}
        </pre>
      </div>

      <div style={{ marginTop: 12, padding: 10, background: "#f6f6f6", borderRadius: 10 }}>
        <strong>Status:</strong> {status} {listening ? " (Listening)" : ""}{" "}
        {mode === "CONFIRM" && pendingSan ? ` | Pending: ${pendingSan}` : ""}
      </div>
    </div>
  );
}
