import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { sanFromSpeech } from "./voice/sanFromSpeech.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";
const MATE_SCORE = 100000;

const DIFFICULTY_LEVELS = [
  { id: 1, name: "Αρχάριος", skill: 0, depth: 5, nodes: 800, multiPv: 8, maxLoss: 500, bestChance: 0.2, temperature: 500 },
  { id: 2, name: "Πολύ εύκολο", skill: 2, depth: 6, nodes: 1500, multiPv: 8, maxLoss: 400, bestChance: 0.3, temperature: 420 },
  { id: 3, name: "Εύκολο", skill: 4, depth: 7, nodes: 3000, multiPv: 8, maxLoss: 300, bestChance: 0.4, temperature: 340 },
  { id: 4, name: "Χαλαρό", skill: 6, depth: 8, nodes: 6000, multiPv: 7, maxLoss: 220, bestChance: 0.5, temperature: 260 },
  { id: 5, name: "Μέτριο", skill: 8, depth: 9, nodes: 12000, multiPv: 6, maxLoss: 160, bestChance: 0.62, temperature: 190 },
  { id: 6, name: "Προχωρημένο", skill: 10, depth: 10, nodes: 25000, multiPv: 5, maxLoss: 120, bestChance: 0.72, temperature: 140 },
  { id: 7, name: "Δύσκολο", skill: 12, depth: 11, nodes: 50000, multiPv: 4, maxLoss: 80, bestChance: 0.82, temperature: 100 },
  { id: 8, name: "Πολύ δύσκολο", skill: 15, depth: 13, nodes: 100000, multiPv: 3, maxLoss: 50, bestChance: 0.9, temperature: 70 },
  { id: 9, name: "Ειδικός", skill: 18, depth: 15, nodes: 200000, multiPv: 2, maxLoss: 25, bestChance: 0.96, temperature: 35 },
  { id: 10, name: "Μέγιστο", skill: 20, depth: 18, nodes: 400000, multiPv: 1, maxLoss: 0, bestChance: 1, temperature: 1 },
];

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function uciToMove(uci) {
  if (!uci || uci === "(none)") return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length >= 5 ? uci[4] : undefined,
  };
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
  const text = (raw || "").toLowerCase();
  const yes = ["confirm", "yes", "yeah", "yep", "ok", "okay", "go", "do it", "accept"];
  const no = ["cancel", "no", "nope", "stop", "reject", "discard"];
  const repeat = ["repeat", "say again", "again", "what", "pardon"];

  if (yes.some((word) => text.includes(word))) return "CONFIRM";
  if (no.some((word) => text.includes(word))) return "CANCEL";
  if (repeat.some((word) => text.includes(word))) return "REPEAT";
  return "UNKNOWN";
}

function parseEngineInfo(line) {
  if (!line.startsWith("info ") || !line.includes(" pv ") || !line.includes(" score ")) return null;

  const tokens = line.trim().split(/\s+/);
  const depthIndex = tokens.indexOf("depth");
  const multiPvIndex = tokens.indexOf("multipv");
  const scoreIndex = tokens.indexOf("score");
  const pvIndex = tokens.indexOf("pv");

  if (scoreIndex < 0 || pvIndex < 0 || !tokens[pvIndex + 1]) return null;

  const depth = depthIndex >= 0 ? Number(tokens[depthIndex + 1]) || 0 : 0;
  const multiPv = multiPvIndex >= 0 ? Number(tokens[multiPvIndex + 1]) || 1 : 1;
  const scoreType = tokens[scoreIndex + 1];
  const rawScore = Number(tokens[scoreIndex + 2]);

  if (!Number.isFinite(rawScore)) return null;

  let score;
  if (scoreType === "cp") {
    score = rawScore;
  } else if (scoreType === "mate") {
    const sign = rawScore >= 0 ? 1 : -1;
    score = sign * (MATE_SCORE - Math.min(Math.abs(rawScore), 999) * 100);
  } else {
    return null;
  }

  return {
    depth,
    multiPv,
    score,
    isMate: scoreType === "mate",
    uci: tokens[pvIndex + 1],
  };
}

function weightedChoice(items, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return items[0];

  let target = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    target -= weights[i];
    if (target <= 0) return items[i];
  }
  return items[items.length - 1];
}

function chooseEngineMove(candidates, profile, fallbackUci) {
  const unique = new Map();
  candidates
    .sort((a, b) => a.multiPv - b.multiPv)
    .forEach((candidate) => {
      if (!unique.has(candidate.uci)) unique.set(candidate.uci, candidate);
    });

  const ranked = [...unique.values()];
  if (ranked.length === 0) return fallbackUci;

  const best = ranked[0];
  if (profile.id === 10 || ranked.length === 1) return best.uci;

  // At the stronger levels, never deliberately ignore a forced mating line.
  if (profile.id >= 7 && best.isMate && best.score > 0) return best.uci;

  const eligible = ranked.filter((candidate, index) => {
    if (index === 0) return true;
    return Math.max(0, best.score - candidate.score) <= profile.maxLoss;
  });

  if (eligible.length === 1 || Math.random() < profile.bestChance) return best.uci;

  const alternatives = eligible.slice(1);
  const weights = alternatives.map((candidate, index) => {
    const loss = Math.max(0, best.score - candidate.score);
    const qualityWeight = Math.exp(-loss / profile.temperature);
    const rankWeight = 1 / Math.sqrt(index + 1);
    return qualityWeight * rankWeight;
  });

  return weightedChoice(alternatives, weights)?.uci || best.uci;
}

export default function App() {
  const chessRef = useRef(new Chess());
  const engineRef = useRef(null);
  const recogRef = useRef(null);
  const difficultyRef = useRef(5);
  const engineSearchRef = useRef({ profile: DIFFICULTY_LEVELS[4], candidates: new Map() });

  const [moves, setMoves] = useState([]);
  const [status, setStatus] = useState("Enter a SAN move or press Start for voice input.");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [typedSan, setTypedSan] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [pendingSan, setPendingSan] = useState("");
  const [difficulty, setDifficulty] = useState(5);
  const [gameStarted, setGameStarted] = useState(false);

  const speechSupported = Boolean(SpeechRecognition);
  const selectedProfile = DIFFICULTY_LEVELS.find((level) => level.id === difficulty) || DIFFICULTY_LEVELS[4];

  useEffect(() => {
    if (!speechSupported) {
      setStatus("Voice input is unavailable. Enter a SAN move below.");
    }

    const worker = new Worker(STOCKFISH_WORKER_URL);
    engineRef.current = worker;

    worker.onmessage = (event) => {
      const text = typeof event.data === "string" ? event.data : "";
      if (!text) return;

      for (const rawLine of text.split(/\r?\n/)) {
        handleEngineLine(rawLine.trim());
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");

    return () => worker.terminate();
  }, [speechSupported]);

  function handleEngineLine(line) {
    if (!line || line.includes("uciok")) return;

    const info = parseEngineInfo(line);
    if (info) {
      const candidates = engineSearchRef.current.candidates;
      const previous = candidates.get(info.multiPv);
      if (!previous || info.depth >= previous.depth) {
        candidates.set(info.multiPv, info);
      }
      return;
    }

    if (!line.startsWith("bestmove")) return;

    const parts = line.split(/\s+/);
    const fallbackUci = parts[1] || "(none)";
    const search = engineSearchRef.current;
    const selectedUci = chooseEngineMove([...search.candidates.values()], search.profile, fallbackUci);
    finishEngineMove(selectedUci, fallbackUci);
  }

  function finishEngineMove(selectedUci, fallbackUci) {
    const chess = chessRef.current;
    const attempts = [selectedUci, fallbackUci].filter((uci, index, all) => uci && all.indexOf(uci) === index);
    let move = null;

    for (const uci of attempts) {
      const moveObject = uciToMove(uci);
      if (!moveObject) continue;
      try {
        move = chess.move(moveObject);
      } catch {
        move = null;
      }
      if (move) break;
    }

    engineSearchRef.current.candidates.clear();
    setBusy(false);

    if (!move) {
      setStatus("Engine has no legal move.");
      speak("I have no legal move.");
      return;
    }

    setMoves((previous) => [...previous, move.san]);
    setStatus(`My move: ${move.san}. Enter your move or press Start.`);
    speak(`My move: ${move.san}. Your move.`);

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

    const recognition = new SpeechRecognition();
    recogRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const raw = event.results?.[0]?.[0]?.transcript || "";
      onResult(raw);
    };
    recognition.onerror = () => {
      setListening(false);
      setStatus("Speech error. Enter the move below or press Start to try again.");
      setMode("MOVE");
      setPendingSan("");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  function requestEngineMove() {
    const engine = engineRef.current;
    if (!engine) {
      setStatus("Engine is not ready. Please try again.");
      return;
    }

    const profile = DIFFICULTY_LEVELS.find((level) => level.id === difficultyRef.current) || DIFFICULTY_LEVELS[4];
    engineSearchRef.current = { profile, candidates: new Map() };

    setBusy(true);
    setStatus(`Engine thinking — level ${profile.id}: ${profile.name}...`);

    engine.postMessage("stop");
    engine.postMessage("setoption name UCI_LimitStrength value false");
    engine.postMessage(`setoption name Skill Level value ${profile.skill}`);
    engine.postMessage(`setoption name MultiPV value ${profile.multiPv}`);
    engine.postMessage(`position fen ${chessRef.current.fen()}`);
    engine.postMessage(`go depth ${profile.depth} nodes ${profile.nodes}`);
  }

  function applyPlayerSan(rawSan, source = "keyboard") {
    if (busy) return;

    const san = (rawSan || "").trim();
    if (!san) {
      setStatus("Enter a move in SAN, for example e4, Nf3 or O-O.");
      return;
    }

    const chess = chessRef.current;
    let move = null;
    try {
      move = chess.move(san, { sloppy: true });
    } catch {
      move = null;
    }

    if (!move) {
      setMode("MOVE");
      setPendingSan("");
      setStatus("Illegal move. Enter SAN such as e4, Nf3 or O-O.");
      if (source === "voice") speak("Illegal move. Please try again.");
      return;
    }

    stopListening();
    setTypedSan("");
    setGameStarted(true);
    setMoves((previous) => [...previous, move.san]);

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
    setStatus(`You played: ${move.san}. Engine thinking...`);
    speak(`You played: ${move.san}.`);
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
      const command = interpretConfirmCommand(raw);

      if (command === "CONFIRM") {
        applyPlayerSan(sanToConfirm, "voice");
        return;
      }

      if (command === "CANCEL") {
        stopListening();
        setMode("MOVE");
        setPendingSan("");
        setStatus("Canceled. Enter a move or press Start.");
        speak("Canceled.");
        return;
      }

      if (command === "REPEAT") {
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

  function changeDifficulty(event) {
    const nextDifficulty = Number(event.target.value);
    difficultyRef.current = nextDifficulty;
    setDifficulty(nextDifficulty);
    const profile = DIFFICULTY_LEVELS.find((level) => level.id === nextDifficulty);
    if (profile) setStatus(`Selected level ${profile.id}: ${profile.name}.`);
  }

  function newGame() {
    stopListening();
    engineRef.current?.postMessage("stop");
    engineRef.current?.postMessage("ucinewgame");
    engineRef.current?.postMessage("isready");
    engineSearchRef.current.candidates.clear();

    chessRef.current = new Chess();
    setMoves([]);
    setTypedSan("");
    setBusy(false);
    setGameStarted(false);
    setMode("MOVE");
    setPendingSan("");
    setStatus(`New game — level ${selectedProfile.id}: ${selectedProfile.name}. Enter a SAN move or press Start.`);
    speak("New game. Your move.");
  }

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h2 style={{ marginBottom: 8 }}>Play Blindfold Chess (Voice or Keyboard)</h2>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="difficulty" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
          Δυσκολία Stockfish
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={changeDifficulty}
          disabled={gameStarted || busy}
          style={{ width: "100%", padding: "10px 12px", fontSize: 16, border: "1px solid #bbb", borderRadius: 8 }}
        >
          {DIFFICULTY_LEVELS.map((level) => (
            <option key={level.id} value={level.id}>
              {level.id}. {level.name}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 5, fontSize: 13, color: "#555" }}>
          Skill {selectedProfile.skill}/20 · βάθος έως {selectedProfile.depth} · {selectedProfile.nodes.toLocaleString("el-GR")} κόμβοι
          {gameStarted ? " · Κλειδωμένο για αυτή την παρτίδα" : ""}
        </div>
      </div>

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
