import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { sanFromSpeech } from "./voice/sanFromSpeech.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";
const ENGINE_MOVE_TIME_MS = 1000;
const APP_VERSION = "v1.2.3_20260807";

const DIFFICULTY_LEVELS = [
  { id: 1, nameEn: "Beginner", nameEl: "Αρχάριος", elo: 1320, displayElo: "1320" },
  { id: 2, nameEn: "Novice", nameEl: "Νέος παίκτης", elo: 1400, displayElo: "1400" },
  { id: 3, nameEn: "Intermediate", nameEl: "Μέτριος", elo: 1500, displayElo: "1500" },
  { id: 4, nameEn: "Club Player", nameEl: "Παίκτης συλλόγου", elo: 1650, displayElo: "1650" },
  { id: 5, nameEn: "Strong Club Player", nameEl: "Ισχυρός παίκτης συλλόγου", elo: 1800, displayElo: "1800" },
  { id: 6, nameEn: "Expert", nameEl: "Expert", elo: 2000, displayElo: "2000" },
  { id: 7, nameEn: "Candidate Master (CM) level", nameEl: "Επίπεδο Candidate Master (CM)", elo: 2200, displayElo: "2200" },
  { id: 8, nameEn: "FIDE Master (FM) level", nameEl: "Επίπεδο FIDE Master (FM)", elo: 2300, displayElo: "2300" },
  { id: 9, nameEn: "International Master (IM) level", nameEl: "Επίπεδο International Master (IM)", elo: 2400, displayElo: "2400" },
  { id: 10, nameEn: "Grandmaster (GM) level", nameEl: "Επίπεδο Grandmaster (GM)", elo: 2500, displayElo: "2500" },
  { id: 11, nameEn: "Super-GM level", nameEl: "Επίπεδο Super-GM", elo: 2700, displayElo: "2700" },
  { id: 12, nameEn: "Engines Level", nameEl: "Επίπεδο μηχανών", elo: 3190, displayElo: "2900+" },
];

const COPY = {
  en: {
    privateSpace: "Your private chess training space",
    appName: "Blindfold Chess",
    stockfishAssistant: "Stockfish Assistant",
    engineReady: "Stockfish is ready",
    engineChecking: "Stockfish is starting",
    settings: "Settings",
    feedback: "Feedback",
    back: "Back to markellosecosystem",
    home: "Home",
    play: "Play",
    difficultyNav: "Difficulty",
    inputNav: "Voice & Keyboard",
    guideNav: "How to play",
    trainingEyebrow: "Blindfold training",
    playTitle: "Play Blindfold Chess",
    playIntro: "Enter moves in SAN, use voice input, or play directly on the optional board.",
    difficulty: "Stockfish difficulty",
    approximateEngineElo: "Approximate engine Elo",
    officialLimit: "Stockfish UCI_Elo strength limit",
    locked: "Locked for this game",
    newGame: "New game",
    resign: "Resign",
    resignConfirm: "Resign this game? Stockfish will win.",
    startVoice: "Start voice",
    stop: "Stop",
    placeholder: "Enter SAN: e4, Nf3, Bxe6, O-O",
    playMove: "Play move",
    moves: "Moves (SAN)",
    noMoves: "No moves yet.",
    status: "Status",
    listening: "Listening",
    pending: "Pending",
    inputHeading: "Move input",
    inputHelp: "Use the keyboard for reliable entry, or voice input when your browser supports it.",
    guideTitle: "How to play",
    guideIntro: "The app validates every move and replies with a local Stockfish move.",
    guide1: "Choose an approximate engine Elo before the first move.",
    guide2: "Enter a legal SAN move, such as e4, Nf3, Bxe6 or O-O, or use the visible board.",
    guide3: "Listen to the Stockfish reply and keep the position in your memory.",
    guide4: "Press New game to reset the position and unlock the difficulty selection.",
    eloNotice: "The Elo is Stockfish engine Elo. The lower labels are informal strength categories; CM/FM/IM/GM labels mean comparable rating level only, not an official title.",
    localNotice: "Language and difficulty settings are stored locally in this browser. The game and Stockfish run on your device.",
    learnMore: "Learn more",
    rights: "All rights reserved.",
    license: "License",
    privacy: "Privacy",
    analytics: "Analytics choices",
    copyright: "Copyright protected",
    close: "Close",
    legalInfo: "Legal information",
  },
  el: {
    privateSpace: "Ο προσωπικός σου χώρος σκακιστικής εξάσκησης",
    appName: "Blindfold Chess",
    stockfishAssistant: "Βοηθός Stockfish",
    engineReady: "Το Stockfish είναι έτοιμο",
    engineChecking: "Το Stockfish ξεκινά",
    settings: "Ρυθμίσεις",
    feedback: "Σχόλια",
    back: "Πίσω στο markellosecosystem",
    home: "Αρχική",
    play: "Παιχνίδι",
    difficultyNav: "Δυσκολία",
    inputNav: "Φωνή & Πληκτρολόγιο",
    guideNav: "Οδηγίες",
    trainingEyebrow: "Εξάσκηση στα τυφλά",
    playTitle: "Παίξε Blindfold Chess",
    playIntro: "Γράψε κινήσεις SAN, χρησιμοποίησε φωνητική εισαγωγή ή παίξε στην προαιρετική σκακιέρα.",
    difficulty: "Δυσκολία Stockfish",
    approximateEngineElo: "Κατά προσέγγιση engine Elo",
    officialLimit: "περιορισμός δύναμης Stockfish UCI_Elo",
    locked: "Κλειδωμένο για αυτή την παρτίδα",
    newGame: "Νέα παρτίδα",
    resign: "Παραίτηση",
    resignConfirm: "Να εγκαταλείψεις αυτή την παρτίδα; Το Stockfish θα κερδίσει.",
    startVoice: "Έναρξη φωνής",
    stop: "Διακοπή",
    placeholder: "Κίνηση SAN: e4, Nf3, Bxe6, O-O",
    playMove: "Παίξε κίνηση",
    moves: "Κινήσεις (SAN)",
    noMoves: "Δεν υπάρχουν κινήσεις ακόμη.",
    status: "Κατάσταση",
    listening: "Ακρόαση",
    pending: "Αναμονή",
    inputHeading: "Εισαγωγή κίνησης",
    inputHelp: "Χρησιμοποίησε το πληκτρολόγιο για αξιόπιστη εισαγωγή ή τη φωνή όταν υποστηρίζεται από τον browser.",
    guideTitle: "Πώς παίζεται",
    guideIntro: "Η εφαρμογή ελέγχει κάθε κίνηση και απαντά με τοπική κίνηση Stockfish.",
    guide1: "Επίλεξε κατά προσέγγιση engine Elo πριν από την πρώτη κίνηση.",
    guide2: "Γράψε νόμιμη κίνηση SAN, όπως e4, Nf3, Bxe6 ή O-O, ή χρησιμοποίησε τη σκακιέρα.",
    guide3: "Άκουσε την απάντηση του Stockfish και κράτησε τη θέση στη μνήμη σου.",
    guide4: "Πάτησε Νέα παρτίδα για επαναφορά και ξεκλείδωμα της δυσκολίας.",
    eloNotice: "Το Elo είναι engine Elo του Stockfish. Οι χαμηλότερες κατηγορίες είναι ανεπίσημες· οι ενδείξεις CM/FM/IM/GM σημαίνουν αντίστοιχο επίπεδο rating και όχι επίσημο τίτλο.",
    localNotice: "Οι ρυθμίσεις γλώσσας και δυσκολίας αποθηκεύονται τοπικά σε αυτόν τον browser. Η παρτίδα και το Stockfish εκτελούνται στη συσκευή σου.",
    learnMore: "Μάθε περισσότερα",
    rights: "Με επιφύλαξη παντός δικαιώματος.",
    license: "Άδεια",
    privacy: "Απόρρητο",
    analytics: "Επιλογές αναλυτικών στοιχείων",
    copyright: "Πνευματικά δικαιώματα",
    close: "Κλείσιμο",
    legalInfo: "Νομικές πληροφορίες",
  },
};

const LEGAL_CONTENT = {
  license: {
    en: {
      title: "License",
      paragraphs: [
        "This application includes the Stockfish chess engine. Stockfish is free software distributed under the GNU General Public License version 3.",
        "Application interface, branding and original content remain protected unless a separate license is provided.",
      ],
    },
    el: {
      title: "Άδεια",
      paragraphs: [
        "Η εφαρμογή περιλαμβάνει τη σκακιστική μηχανή Stockfish. Το Stockfish είναι ελεύθερο λογισμικό που διανέμεται με την GNU General Public License έκδοση 3.",
        "Η διεπαφή, η επωνυμία και το πρωτότυπο περιεχόμενο της εφαρμογής παραμένουν προστατευμένα, εκτός αν παρέχεται διαφορετική άδεια.",
      ],
    },
  },
  privacy: {
    en: {
      title: "Privacy",
      paragraphs: [
        "The chess position and Stockfish calculations run in your browser. No account is required for local play.",
        "Voice recognition is provided by your browser and may be processed according to the browser or device provider's privacy terms.",
      ],
    },
    el: {
      title: "Απόρρητο",
      paragraphs: [
        "Η σκακιστική θέση και οι υπολογισμοί του Stockfish εκτελούνται στον browser σου. Δεν απαιτείται λογαριασμός για τοπικό παιχνίδι.",
        "Η φωνητική αναγνώριση παρέχεται από τον browser και μπορεί να επεξεργάζεται σύμφωνα με τους όρους απορρήτου του παρόχου του browser ή της συσκευής.",
      ],
    },
  },
  analytics: {
    en: {
      title: "Analytics choices",
      paragraphs: [
        "This version does not provide in-app analytics preference controls.",
        "The hosting provider may still process essential technical logs required to deliver and secure the website.",
      ],
    },
    el: {
      title: "Επιλογές αναλυτικών στοιχείων",
      paragraphs: [
        "Αυτή η έκδοση δεν παρέχει ρυθμίσεις αναλυτικών στοιχείων μέσα στην εφαρμογή.",
        "Ο πάροχος φιλοξενίας μπορεί να επεξεργάζεται απαραίτητα τεχνικά αρχεία για την παράδοση και την ασφάλεια του ιστοτόπου.",
      ],
    },
  },
  copyright: {
    en: {
      title: "Copyright protected",
      paragraphs: [
        "© 2026 Markellos Markides. All rights reserved for the application interface, branding and original content.",
        "Third-party software remains subject to its own license terms.",
      ],
    },
    el: {
      title: "Πνευματικά δικαιώματα",
      paragraphs: [
        "© 2026 Markellos Markides. Με επιφύλαξη παντός δικαιώματος για τη διεπαφή, την επωνυμία και το πρωτότυπο περιεχόμενο της εφαρμογής.",
        "Το λογισμικό τρίτων διέπεται από τους δικούς του όρους άδειας.",
      ],
    },
  },
};

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

function formatMovesSan(moves, emptyText) {
  if (moves.length === 0) return emptyText;

  let output = "";
  for (let index = 0; index < moves.length; index += 1) {
    const moveNumber = Math.floor(index / 2) + 1;
    if (index % 2 === 0) output += `${moveNumber}. `;
    output += moves[index];
    output += index % 2 === 1 ? "\n" : " ";
  }
  return output.trimEnd();
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

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function AppV2() {
  const chessRef = useRef(new Chess());
  const engineRef = useRef(null);
  const recogRef = useRef(null);
  const difficultyRef = useRef(5);
  const gameEndedRef = useRef(false);

  const [language, setLanguage] = useState(() => localStorage.getItem("blindfold-language") || "en");
  const [moves, setMoves] = useState([]);
  const [status, setStatus] = useState("Enter a SAN move or press Start for voice input.");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [typedSan, setTypedSan] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [pendingSan, setPendingSan] = useState("");
  const [difficulty, setDifficulty] = useState(() => {
    const saved = Number(localStorage.getItem("blindfold-difficulty"));
    return saved >= 1 && saved <= 12 ? saved : 5;
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [legalSection, setLegalSection] = useState(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const copy = COPY[language] || COPY.en;
  const speechSupported = Boolean(SpeechRecognition);
  const selectedProfile = DIFFICULTY_LEVELS.find((level) => level.id === difficulty) || DIFFICULTY_LEVELS[4];
  const selectedProfileName = language === "el" ? selectedProfile.nameEl : selectedProfile.nameEn;
  const legalCopy = legalSection ? LEGAL_CONTENT[legalSection]?.[language] : null;

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem("blindfold-language", language);
    document.documentElement.lang = language === "el" ? "el" : "en";
  }, [language]);

  useEffect(() => {
    localStorage.setItem("blindfold-difficulty", String(difficulty));
  }, [difficulty]);

  useEffect(() => {
    if (!speechSupported) {
      setStatus(language === "el"
        ? "Η φωνητική εισαγωγή δεν είναι διαθέσιμη. Γράψε μια κίνηση SAN."
        : "Voice input is unavailable. Enter a SAN move below.");
    }
  }, [language, speechSupported]);

  useEffect(() => {
    if (!showHowToPlay && !legalSection) return undefined;

    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowHowToPlay(false);
      setLegalSection(null);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showHowToPlay, legalSection]);

  useEffect(() => {
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
  }, []);

  function endGame() {
    gameEndedRef.current = true;
    setGameEnded(true);
    setBusy(false);
  }

  function handleEngineLine(line) {
    if (!line) return;

    if (line === "readyok") {
      setEngineReady(true);
      return;
    }

    if (line.includes("uciok") || gameEndedRef.current || !line.startsWith("bestmove")) return;

    const uci = line.split(/\s+/)[1] || "(none)";
    finishEngineMove(uci);
  }

  function finishEngineMove(uci) {
    if (gameEndedRef.current) return;

    const chess = chessRef.current;
    const moveObject = uciToMove(uci);
    let move = null;

    if (moveObject) {
      try {
        move = chess.move(moveObject);
      } catch {
        move = null;
      }
    }

    setBusy(false);

    if (!move) {
      endGame();
      setStatus(language === "el" ? "Το Stockfish δεν έχει νόμιμη κίνηση." : "Engine has no legal move.");
      speak("I have no legal move.");
      return;
    }

    setMoves((previous) => [...previous, move.san]);
    setStatus(language === "el"
      ? `Κίνηση Stockfish: ${move.san}. Η σειρά σου.`
      : `My move: ${move.san}. Enter your move or press Start.`);
    speak(`My move: ${move.san}. Your move.`);

    if (chess.isCheckmate()) {
      endGame();
      setStatus(language === "el" ? "Ματ." : "Checkmate.");
      speak("Checkmate.");
      return;
    }

    if (chess.isDraw()) {
      endGame();
      setStatus(language === "el" ? "Ισοπαλία." : "Draw.");
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
    if (gameEndedRef.current) return;

    if (!SpeechRecognition) {
      setStatus(language === "el"
        ? "Η φωνητική εισαγωγή δεν είναι διαθέσιμη. Γράψε μια κίνηση SAN."
        : "Voice input is unavailable. Enter a SAN move below.");
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
      setStatus(language === "el"
        ? "Σφάλμα φωνής. Γράψε την κίνηση ή προσπάθησε ξανά."
        : "Speech error. Enter the move below or press Start to try again.");
      setMode("MOVE");
      setPendingSan("");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  function requestEngineMove() {
    if (gameEndedRef.current) return;

    const engine = engineRef.current;
    if (!engine) {
      setStatus(language === "el"
        ? "Το Stockfish δεν είναι έτοιμο. Προσπάθησε ξανά."
        : "Engine is not ready. Please try again.");
      return;
    }

    const profile = DIFFICULTY_LEVELS.find((level) => level.id === difficultyRef.current) || DIFFICULTY_LEVELS[4];
    const profileName = language === "el" ? profile.nameEl : profile.nameEn;

    setBusy(true);
    setStatus(language === "el"
      ? `Το Stockfish σκέφτεται — ${profileName}, περίπου ${profile.displayElo} Elo...`
      : `Engine thinking — ${profileName}, approximately ${profile.displayElo} Elo...`);

    engine.postMessage("stop");
    engine.postMessage("setoption name UCI_LimitStrength value true");
    engine.postMessage(`setoption name UCI_Elo value ${profile.elo}`);
    engine.postMessage("setoption name MultiPV value 1");
    engine.postMessage(`position fen ${chessRef.current.fen()}`);
    engine.postMessage(`go movetime ${ENGINE_MOVE_TIME_MS}`);
  }

  function applyPlayerSan(rawSan, source = "keyboard") {
    if (busy || gameEndedRef.current) return;

    const san = (rawSan || "").trim();
    if (!san) {
      setStatus(language === "el"
        ? "Γράψε κίνηση SAN, για παράδειγμα e4, Nf3 ή O-O."
        : "Enter a move in SAN, for example e4, Nf3 or O-O.");
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
      setStatus(language === "el"
        ? "Παράνομη κίνηση. Γράψε SAN όπως e4, Nf3 ή O-O."
        : "Illegal move. Enter SAN such as e4, Nf3 or O-O.");
      if (source === "voice") speak("Illegal move. Please try again.");
      return;
    }

    stopListening();
    setTypedSan("");
    setGameStarted(true);
    setMoves((previous) => [...previous, move.san]);

    if (chess.isCheckmate()) {
      endGame();
      setStatus(language === "el" ? "Ματ." : "Checkmate.");
      speak("Checkmate.");
      return;
    }

    if (chess.isDraw()) {
      endGame();
      setStatus(language === "el" ? "Ισοπαλία." : "Draw.");
      speak("Draw.");
      return;
    }

    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? `Έπαιξες ${move.san}. Το Stockfish σκέφτεται...`
      : `You played: ${move.san}. Engine thinking...`);
    speak(`You played: ${move.san}.`);
    requestEngineMove();
  }

  function submitTypedMove(event) {
    event.preventDefault();
    applyPlayerSan(typedSan, "keyboard");
  }

  function startListeningForMove() {
    if (busy || gameEndedRef.current) return;

    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? "Ακρόαση... Πες την κίνησή σου στα αγγλικά."
      : "Listening... Say your move.");

    startListeningInternal((raw) => {
      const san = sanFromSpeech(raw);

      if (!san) {
        setStatus(language === "el"
          ? `Ακούστηκε: «${raw}». Γράψε την κίνηση ή προσπάθησε ξανά.`
          : `Heard: "${raw}". Enter the move below or press Start to try again.`);
        speak("I did not catch that. Please try again.");
        return;
      }

      setMode("CONFIRM");
      setPendingSan(san);
      setStatus(language === "el"
        ? `Ακούστηκε: «${raw}» → ${san}. Πες confirm ή cancel.`
        : `Heard: "${raw}" → ${san}. Say confirm or cancel.`);
      speak(`I heard ${san}. Confirm or cancel.`);
      startListeningForConfirm(san);
    });
  }

  function startListeningForConfirm(sanToConfirm) {
    if (busy || gameEndedRef.current) return;

    setStatus(language === "el"
      ? `Επιβεβαίωση: ${sanToConfirm}. Πες confirm ή cancel.`
      : `Confirm: ${sanToConfirm}. Say confirm or cancel.`);

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
        setStatus(language === "el"
          ? "Ακυρώθηκε. Γράψε κίνηση ή πάτησε Έναρξη φωνής."
          : "Canceled. Enter a move or press Start.");
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
        setStatus(language === "el"
          ? `Ακούστηκε νέα κίνηση: ${maybeSan}. Πες confirm ή cancel.`
          : `Heard a new move: ${maybeSan}. Say confirm or cancel.`);
        speak(`I heard ${maybeSan}. Confirm or cancel.`);
        startListeningForConfirm(maybeSan);
        return;
      }

      setStatus(language === "el"
        ? `Δεν επιβεβαιώθηκε το ${sanToConfirm}. Γράψε την κίνηση ή προσπάθησε ξανά.`
        : `Could not confirm ${sanToConfirm}. Enter the move below or press Start.`);
      speak("Please say confirm or cancel.");
    });
  }

  function changeDifficulty(event) {
    const nextDifficulty = Number(event.target.value);
    difficultyRef.current = nextDifficulty;
    setDifficulty(nextDifficulty);

    const profile = DIFFICULTY_LEVELS.find((level) => level.id === nextDifficulty);
    if (!profile) return;

    const name = language === "el" ? profile.nameEl : profile.nameEn;
    setStatus(language === "el"
      ? `Επιλέχθηκε ${name} — περίπου ${profile.displayElo} engine Elo.`
      : `Selected ${name} — approximately ${profile.displayElo} engine Elo.`);
  }

  function resignGame() {
    if (!gameStarted || gameEndedRef.current) return;
    if (!window.confirm(copy.resignConfirm)) return;

    stopListening();
    engineRef.current?.postMessage("stop");
    endGame();
    setTypedSan("");
    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? "Παραίτηση. Το Stockfish κερδίζει 0-1. Πάτησε Νέα παρτίδα για να ξαναπαίξεις."
      : "You resigned. Stockfish wins 0-1. Press New game to play again.");
    speak("You resigned. Stockfish wins.");
  }

  function newGame() {
    stopListening();
    engineRef.current?.postMessage("stop");
    engineRef.current?.postMessage("ucinewgame");
    engineRef.current?.postMessage("isready");

    gameEndedRef.current = false;
    chessRef.current = new Chess();
    setMoves([]);
    setTypedSan("");
    setBusy(false);
    setGameStarted(false);
    setGameEnded(false);
    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? `Νέα παρτίδα — ${selectedProfileName}, περίπου ${selectedProfile.displayElo} engine Elo. Γράψε κίνηση SAN ή πάτησε Έναρξη φωνής.`
      : `New game — ${selectedProfileName}, approximately ${selectedProfile.displayElo} engine Elo. Enter a SAN move or press Start.`);
    speak("New game. Your move.");
  }

  function openHowToPlay(event) {
    event?.preventDefault();
    setShowHowToPlay(true);
  }

  return (
    <div className="app-shell" id="home">
      <header className="app-header">
        <div className="app-header-top">
          <div className="brand-block">
            <p className="eyebrow">{copy.privateSpace}</p>
            <h1>{copy.appName}</h1>
          </div>

          <div className="utility-actions" aria-label={copy.settings}>
            <button
              className="assistant-launch-button"
              onClick={() => scrollToSection("difficulty")}
              title={engineReady ? copy.engineReady : copy.engineChecking}
              type="button"
            >
              <span className="assistant-avatar-wrap" aria-hidden="true">
                <span className="assistant-avatar">♞</span>
                <span className={`engine-dot ${engineReady ? "is-ready" : "is-checking"}`} />
              </span>
              <span>{copy.stockfishAssistant}</span>
            </button>

            <div className="language-switch" aria-label="Language">
              <button
                aria-pressed={language === "el"}
                className={language === "el" ? "active" : ""}
                onClick={() => setLanguage("el")}
                type="button"
              >
                GR
              </button>
              <button
                aria-pressed={language === "en"}
                className={language === "en" ? "active" : ""}
                onClick={() => setLanguage("en")}
                type="button"
              >
                EN
              </button>
            </div>

            <a href="#difficulty">{copy.settings}</a>
            <a href="mailto:markellos.markides@gmail.com?subject=Blindfold%20Chess%20Feedback">{copy.feedback}</a>
            <a className="ecosystem-link" href="https://markellosecosystem.com/" rel="noopener noreferrer" target="_blank">
              {copy.back}
            </a>
          </div>
        </div>

        <div className="navigation-row">
          <nav className="main-nav" aria-label="Main navigation">
            <a className="active" href="#home">{copy.home}</a>
            <a href="#play">{copy.play}</a>
            <a href="#difficulty">{copy.difficultyNav}</a>
            <a href="#move-input">{copy.inputNav}</a>
            <a
              aria-controls="how-to-play-dialog"
              aria-expanded={showHowToPlay}
              href="#how-to-play"
              onClick={openHowToPlay}
            >
              {copy.guideNav}
            </a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <section className="game-panel" id="play">
          <div className="page-heading">
            <p className="eyebrow">{copy.trainingEyebrow}</p>
            <h2>{copy.playTitle}</h2>
            <p>{copy.playIntro}</p>
          </div>

          <section className="control-section" id="difficulty">
            <label htmlFor="difficulty-select">{copy.difficulty}</label>
            <select
              disabled={gameStarted || busy}
              id="difficulty-select"
              onChange={changeDifficulty}
              value={difficulty}
            >
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {language === "el" ? level.nameEl : level.nameEn} — ≈{level.displayElo} Elo
                </option>
              ))}
            </select>
            <div className="field-help">
              {copy.approximateEngineElo}: ≈{selectedProfile.displayElo} · {copy.officialLimit}
              {gameStarted ? ` · ${copy.locked}` : ""}
            </div>
          </section>

          <div className="game-actions">
            <button className="primary-button" disabled={busy} onClick={newGame}>{copy.newGame}</button>
            <button className="danger-button" disabled={!gameStarted || gameEnded} onClick={resignGame}>{copy.resign}</button>
            <button disabled={busy || gameEnded || listening || !speechSupported} onClick={startListeningForMove}>{copy.startVoice}</button>
            <button disabled={!listening} onClick={stopListening}>{copy.stop}</button>
          </div>

          <section className="control-section" id="move-input">
            <h3>{copy.inputHeading}</h3>
            <p className="field-help input-help">{copy.inputHelp}</p>
            <form className="move-form" onSubmit={submitTypedMove}>
              <input
                aria-label={copy.placeholder}
                autoCapitalize="characters"
                autoComplete="off"
                disabled={busy || gameEnded}
                onChange={(event) => setTypedSan(event.target.value)}
                placeholder={copy.placeholder}
                spellCheck="false"
                type="text"
                value={typedSan}
              />
              <button className="primary-button" disabled={busy || gameEnded || !typedSan.trim()} type="submit">
                {copy.playMove}
              </button>
            </form>
          </section>

          <section className="moves-panel" aria-live="polite">
            <h3>{copy.moves}</h3>
            <pre>{formatMovesSan(moves, copy.noMoves)}</pre>
          </section>

          <section className="status-panel" aria-live="polite">
            <strong>{copy.status}:</strong> {status} {listening ? ` (${copy.listening})` : ""}{" "}
            {mode === "CONFIRM" && pendingSan ? ` | ${copy.pending}: ${pendingSan}` : ""}
          </section>
        </section>
      </main>

      <div className="local-storage-notice">
        <span aria-hidden="true">ⓘ</span>
        <span>{copy.localNotice}</span>
        <a href="#how-to-play" onClick={openHowToPlay}>{copy.learnMore}</a>
      </div>

      <footer className="app-footer">
        <p>© 2026 Markellos Markides. {copy.rights}</p>
        <nav className="footer-meta" aria-label={copy.legalInfo}>
          <button onClick={() => setLegalSection("license")} type="button">{copy.license}</button>
          <button onClick={() => setLegalSection("privacy")} type="button">{copy.privacy}</button>
          <button onClick={() => setLegalSection("analytics")} type="button">{copy.analytics}</button>
          <button onClick={() => setLegalSection("copyright")} type="button">{copy.copyright}</button>
        </nav>
        <small className="build-version">{APP_VERSION}</small>
      </footer>

      {showHowToPlay ? (
        <div className="modal-backdrop" onClick={() => setShowHowToPlay(false)} role="presentation">
          <section
            aria-labelledby="how-to-play-dialog-title"
            aria-modal="true"
            className="legal-dialog"
            id="how-to-play-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p className="eyebrow">{copy.guideNav}</p>
            <h2 id="how-to-play-dialog-title">{copy.guideTitle}</h2>
            <p>{copy.guideIntro}</p>
            <ol>
              <li>{copy.guide1}</li>
              <li>{copy.guide2}</li>
              <li>{copy.guide3}</li>
              <li>{copy.guide4}</li>
            </ol>
            <p className="field-help">{copy.eloNotice}</p>
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => setShowHowToPlay(false)} type="button">
                {copy.close}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {legalCopy ? (
        <div className="modal-backdrop" onClick={() => setLegalSection(null)} role="presentation">
          <section
            aria-labelledby="legal-dialog-title"
            aria-modal="true"
            className="legal-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2 id="legal-dialog-title">{legalCopy.title}</h2>
            {legalCopy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => setLegalSection(null)} type="button">{copy.close}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
