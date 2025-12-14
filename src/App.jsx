import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { sanFromSpeech } from "./voice/sanFromSpeech.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Must match the filename you place in /public
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
  const [status, setStatus] = useState("Say your move (SAN).");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);

  const [mode, setMode] = useState("MOVE"); // MOVE | CONFIRM
  const [pendingSan, setPendingSan] = useState("");

  useEffect(() => {
    if (!SpeechRecognition) {
      setStatus("SpeechRecognition is not supported in this browser.");
      return;
    }

    // Create Stockfish as a worker directly (most robust)
    const w = new Worker(STOCKFISH_WORKER_URL);
    engineRef.current = w;

    w.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : "";
      if (!line) return;

      if (line.includes("uciok")) return;
      if (line.startsWith("bestmove")) {
        const parts = line.trim().split(/\s+/);
        const uci = parts[1] || "(none)";

        const chess = chessRef.current;
        const moveObj = uciToMove(uci);

        if (!moveObj) {
          setBusy(false);
          setStatus("Engine has no moves.");
          speak("I have no moves.");
          startListeningForMove();
          return;
        }

        const m = chess.move(moveObj);
        if (m) {
          setMoves((prev) => [...prev, m.san]);
          setStatus(`My move: ${m.san}. Your move.`);
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
          return;
        }

        startListeningForMove();
      }
    };

    // Init UCI
    w.postMessage("uci");
    w.postMessage("isready");

    return () => w.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopListening() {
    try {
      recogRef.current?.stop();
    } catch {}
    setListening(false);
  }

  function startListeningInternal(onResult) {
    if (!SpeechRecognition) return;

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
      setStatus("Speech error. Click Start.");
      speak("Speech error. Please click Start.");
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

    const fen = chess.fen();

    // UCI commands to Stockfish worker
    engineRef.current?.postMessage(`position fen ${fen}`);
    engineRef.current?.postMessage("go depth 8");
  }

  function applyPlayerSan(san) {
    if (busy) return;

    const chess = chessRef.current;
    const m = chess.move(san, { sloppy: true });

    if (!m) {
      setMode("MOVE");
      setPendingSan("");
      setStatus("Illegal move. Say a SAN move like: e4, Nf3, O-O.");
      speak("Illegal move. Please try again.");
      startListeningForMove();
      return;
    }

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

  function startListeningForMove() {
    if (busy) return;

    setMode("MOVE");
    setPendingSan("");
    setStatus("Listening... Say your move.");
    startListeningInternal((raw) => {
      const san = sanFromSpeech(raw);

      if (!san) {
        setStatus(`Heard: "${raw}" → (empty). Try again.`);
        speak("I did not catch that. Please repeat.");
        startListeningForMove();
        return;
      }

      setMode("CONFIRM");
      setPendingSan(san);
      setStatus(`Heard: "${raw}" → ${san}. Say confirm or cancel.`);
      speak(`I heard ${san}. Confirm or cancel.`);
      startListeningForConfirm();
    });
  }

  function startListeningForConfirm() {
    if (busy) return;

    setStatus(`Confirm: ${pendingSan}. Say confirm or cancel.`);
    startListeningInternal((raw) => {
      const cmd = interpretConfirmCommand(raw);

      if (cmd === "CONFIRM") {
        stopListening();
        applyPlayerSan(pendingSan);
        return;
      }

      if (cmd === "CANCEL") {
        stopListening();
        setMode("MOVE");
        setPendingSan("");
        setStatus("Canceled. Say your move.");
        speak("Canceled. Say your move.");
        startListeningForMove();
        return;
      }

      if (cmd === "REPEAT") {
        speak(`I heard ${pendingSan}. Confirm or cancel.`);
        startListeningForConfirm();
        return;
      }

      // If user says another move, treat as new pending move
      const maybeSan = sanFromSpeech(raw);
      if (maybeSan) {
        setPendingSan(maybeSan);
        setStatus(`Heard a new move: ${maybeSan}. Say confirm or cancel.`);
        speak(`I heard ${maybeSan}. Confirm or cancel.`);
        startListeningForConfirm();
        return;
      }

      speak("Please say confirm or cancel.");
      startListeningForConfirm();
    });
  }

  function newGame() {
    stopListening();
    chessRef.current = new Chess();
    setMoves([]);
    setBusy(false);
    setMode("MOVE");
    setPendingSan("");
    setStatus("New game. Say your move.");
    speak("New game. Your move.");
    startListeningForMove();
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ marginBottom: 8 }}>Play Blindfold Chess (Voice + Confirm)</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={newGame} disabled={busy}>New game</button>
        <button onClick={startListeningForMove} disabled={busy || listening}>Start</button>
        <button onClick={stopListening} disabled={!listening}>Stop</button>
      </div>

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
