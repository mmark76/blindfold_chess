import React, { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import BoardVisibilityToggle from "./BoardVisibilityToggle.jsx";
import ConfirmMoveButton from "./ConfirmMoveButton.jsx";
import EvaluationPanel from "./EvaluationPanel.jsx";
import ModalDialog from "./ModalDialog.jsx";
import MovesVisibilityToggle from "./MovesVisibilityToggle.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import { applySanMove, applyUciMove } from "./chess/moves.js";
import { DIFFICULTY_LEVELS, getDifficultyProfile } from "./engine/difficulty.js";
import { GameplayStockfishController } from "./engine/GameplayStockfishController.js";
import {
  getStoredBoolean,
  getStoredEnum,
  getStoredInteger,
  setStoredValue,
} from "./storage.js";
import { sanFromSpeech } from "./voice/sanFromSpeech.js";
import { interpretConfirmCommand } from "./voice/interpretConfirmCommand.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const STOCKFISH_WORKER_URL = "/stockfish-17.1-lite-single-03e3232.js";
const ENGINE_MOVE_TIME_MS = 1000;
const APP_VERSION = "v1.2.3_20260807";
const DIFFICULTY_IDS = DIFFICULTY_LEVELS.map((level) => level.id);

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
    localNotice: "Language, difficulty, appearance, and panel visibility settings are stored locally in this browser. The game and Stockfish run on your device.",
    learnMore: "Learn more",
    rights: "All rights reserved.",
    license: "License",
    privacy: "Privacy",
    analytics: "Analytics choices",
    copyright: "Copyright protected",
    close: "Close",
    legalInfo: "Legal information",
    language: "Language",
    mainNavigation: "Main navigation",
    utilities: "Utilities",
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
    approximateEngineElo: "Κατά προσέγγιση Elo μηχανής",
    officialLimit: "όριο ισχύος UCI_Elo του Stockfish",
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
    inputHelp: "Χρησιμοποίησε το πληκτρολόγιο για αξιόπιστη εισαγωγή ή τη φωνή όταν υποστηρίζεται από το πρόγραμμα περιήγησης.",
    guideTitle: "Πώς παίζεται",
    guideIntro: "Η εφαρμογή ελέγχει κάθε κίνηση και απαντά με τοπική κίνηση Stockfish.",
    guide1: "Επίλεξε κατά προσέγγιση Elo μηχανής πριν από την πρώτη κίνηση.",
    guide2: "Γράψε νόμιμη κίνηση SAN, όπως e4, Nf3, Bxe6 ή O-O, ή χρησιμοποίησε τη σκακιέρα.",
    guide3: "Άκουσε την απάντηση του Stockfish και κράτησε τη θέση στη μνήμη σου.",
    guide4: "Πάτησε Νέα παρτίδα για επαναφορά και ξεκλείδωμα της δυσκολίας.",
    eloNotice: "Το Elo είναι το Elo μηχανής του Stockfish. Οι χαμηλότερες κατηγορίες είναι ανεπίσημες· οι ενδείξεις CM/FM/IM/GM σημαίνουν αντίστοιχο επίπεδο αξιολόγησης και όχι επίσημο τίτλο.",
    localNotice: "Οι ρυθμίσεις γλώσσας, δυσκολίας, εμφάνισης και ορατότητας πλαισίων αποθηκεύονται τοπικά σε αυτό το πρόγραμμα περιήγησης. Η παρτίδα και το Stockfish εκτελούνται στη συσκευή σου.",
    learnMore: "Μάθε περισσότερα",
    rights: "Με επιφύλαξη παντός δικαιώματος.",
    license: "Άδεια",
    privacy: "Απόρρητο",
    analytics: "Επιλογές αναλυτικών στοιχείων",
    copyright: "Πνευματικά δικαιώματα",
    close: "Κλείσιμο",
    legalInfo: "Νομικές πληροφορίες",
    language: "Γλώσσα",
    mainNavigation: "Κύρια πλοήγηση",
    utilities: "Βοηθητικές ενέργειες",
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
        "Η σκακιστική θέση και οι υπολογισμοί του Stockfish εκτελούνται στο πρόγραμμα περιήγησής σου. Δεν απαιτείται λογαριασμός για τοπικό παιχνίδι.",
        "Η φωνητική αναγνώριση παρέχεται από το πρόγραμμα περιήγησης και μπορεί να επεξεργάζεται σύμφωνα με τους όρους απορρήτου του παρόχου ή της συσκευής.",
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

export default function App() {
  const chessRef = useRef(new Chess());
  const engineControllerRef = useRef(null);
  const finishEngineMoveRef = useRef(null);
  const handleEngineFailureRef = useRef(null);
  const recogRef = useRef(null);
  const recognitionSessionRef = useRef(0);
  const difficultyRef = useRef(5);
  const busyRef = useRef(false);
  const gameEndedRef = useRef(false);

  const [language, setLanguage] = useState(() => (
    getStoredEnum("blindfold-language", ["en", "el"], "en")
  ));
  const [moves, setMoves] = useState([]);
  const [status, setStatus] = useState(() => (
    language === "el"
      ? "Γράψε μια κίνηση SAN ή πάτησε Έναρξη φωνής."
      : "Enter a SAN move or press Start for voice input."
  ));
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [typedSan, setTypedSan] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [pendingSan, setPendingSan] = useState("");
  const [difficulty, setDifficulty] = useState(() => (
    getStoredInteger("blindfold-difficulty", DIFFICULTY_IDS, 5)
  ));
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [gameResultOverride, setGameResultOverride] = useState(null);
  const [legalSection, setLegalSection] = useState(null);
  const [showEvaluation, setShowEvaluation] = useState(() => (
    getStoredBoolean("blindfold-show-evaluation", false)
  ));
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copy = COPY[language] || COPY.en;
  const speechSupported = Boolean(SpeechRecognition);
  const selectedProfile = getDifficultyProfile(difficulty);
  const selectedProfileName = language === "el" ? selectedProfile.nameEl : selectedProfile.nameEn;
  const legalCopy = legalSection ? LEGAL_CONTENT[legalSection]?.[language] : null;

  difficultyRef.current = difficulty;
  finishEngineMoveRef.current = finishEngineMove;
  handleEngineFailureRef.current = handleEngineFailure;

  useEffect(() => {
    setStoredValue("blindfold-language", language);
    document.documentElement.lang = language === "el" ? "el" : "en";
  }, [language]);

  useEffect(() => {
    setStoredValue("blindfold-difficulty", difficulty);
  }, [difficulty]);

  useEffect(() => {
    if (engineFailed) {
      setStatus(language === "el"
        ? "Το Stockfish δεν μπόρεσε να ξεκινήσει. Ανανέωσε τη σελίδα για να προσπαθήσεις ξανά."
        : "Stockfish could not start. Reload the page to try again.");
      return;
    }

    if (busyRef.current) {
      const profile = getDifficultyProfile(difficultyRef.current);
      const profileName = language === "el" ? profile.nameEl : profile.nameEn;
      setStatus(language === "el"
        ? `Το Stockfish σκέφτεται — ${profileName}, περίπου ${profile.displayElo} Elo...`
        : `Engine thinking — ${profileName}, approximately ${profile.displayElo} Elo...`);
      return;
    }

    if (gameEndedRef.current) {
      if (gameResultOverride === "0-1") {
        setStatus(language === "el"
          ? "Παραίτηση. Το Stockfish κερδίζει 0-1. Πάτησε Νέα παρτίδα για να ξαναπαίξεις."
          : "You resigned. Stockfish wins 0-1. Press New game to play again.");
      } else if (chessRef.current.isCheckmate()) {
        setStatus(language === "el" ? "Ματ." : "Checkmate.");
      } else if (chessRef.current.isDraw()) {
        setStatus(language === "el" ? "Ισοπαλία." : "Draw.");
      } else {
        setStatus(language === "el"
          ? "Η παρτίδα τελείωσε. Πάτησε Νέα παρτίδα για να ξαναπαίξεις."
          : "The game is over. Press New game to play again.");
      }
      return;
    }

    if (mode === "CONFIRM" && pendingSan) {
      setStatus(language === "el"
        ? `Επιβεβαίωση: ${pendingSan}. Πες «confirm» ή «cancel».`
        : `Confirm: ${pendingSan}. Say confirm or cancel.`);
      return;
    }

    if (!speechSupported) {
      setStatus(language === "el"
        ? "Η φωνητική εισαγωγή δεν είναι διαθέσιμη. Γράψε μια κίνηση SAN."
        : "Voice input is unavailable. Enter a SAN move below.");
      return;
    }

    setStatus(language === "el"
      ? "Γράψε μια κίνηση SAN ή πάτησε Έναρξη φωνής."
      : "Enter a SAN move or press Start for voice input.");
  }, [engineFailed, language, speechSupported]);

  useEffect(() => {
    let controller = null;

    try {
      const worker = new Worker(STOCKFISH_WORKER_URL);
      controller = new GameplayStockfishController(worker, {
        onBestMove: (uci, request) => finishEngineMoveRef.current?.(uci, request),
        onError: (message) => handleEngineFailureRef.current?.(message),
        onReady: (ready) => setEngineReady(ready),
      }, { moveTimeMs: ENGINE_MOVE_TIME_MS });
      engineControllerRef.current = controller;
      controller.start();
    } catch (error) {
      handleEngineFailureRef.current?.(error instanceof Error ? error.message : String(error));
    }

    return () => {
      if (engineControllerRef.current === controller) engineControllerRef.current = null;
      controller?.destroy();
    };
  }, []);

  useEffect(() => () => {
    recognitionSessionRef.current += 1;
    const recognition = recogRef.current;
    recogRef.current = null;
    if (!recognition) return;

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {}
  }, []);

  function setEngineBusy(nextBusy) {
    busyRef.current = nextBusy;
    setBusy(nextBusy);
  }

  function endGame() {
    gameEndedRef.current = true;
    setGameEnded(true);
    setEngineBusy(false);
  }

  function handleEngineFailure() {
    setEngineReady(false);
    setEngineFailed(true);
    setEngineBusy(false);
    setStatus(language === "el"
      ? "Το Stockfish δεν μπόρεσε να ξεκινήσει. Ανανέωσε τη σελίδα για να προσπαθήσεις ξανά."
      : "Stockfish could not start. Reload the page to try again.");
  }

  function finishEngineMove(uci, request) {
    if (gameEndedRef.current) return;

    const chess = chessRef.current;
    if (request?.fen !== chess.fen() || chess.turn() !== "b") {
      setEngineBusy(false);
      return;
    }

    const move = applyUciMove(chess, uci);
    setEngineBusy(false);

    if (!move) {
      endGame();
      setStatus(language === "el"
        ? "Το Stockfish επέστρεψε μη έγκυρη κίνηση. Πάτησε Νέα παρτίδα για να ξαναπαίξεις."
        : "Stockfish returned an invalid move. Press New game to play again.");
      speak("The engine could not make a move.");
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
    recognitionSessionRef.current += 1;
    const recognition = recogRef.current;
    recogRef.current = null;

    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }

    try {
      recognition?.abort();
    } catch {}
    setListening(false);
  }

  function stopVoiceInput() {
    stopListening();
    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? "Η φωνητική εισαγωγή σταμάτησε. Γράψε κίνηση ή πάτησε Έναρξη φωνής."
      : "Voice input stopped. Enter a move or press Start.");
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

    let recognition;
    try {
      recognition = new SpeechRecognition();
    } catch {
      setStatus(language === "el"
        ? "Η φωνητική εισαγωγή δεν μπόρεσε να ξεκινήσει. Γράψε την κίνηση."
        : "Voice input could not start. Enter the move below.");
      return;
    }

    const session = recognitionSessionRef.current + 1;
    recognitionSessionRef.current = session;
    recogRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const isCurrentSession = () => (
      recognitionSessionRef.current === session && recogRef.current === recognition
    );

    recognition.onstart = () => {
      if (isCurrentSession()) setListening(true);
    };
    recognition.onresult = (event) => {
      if (!isCurrentSession() || gameEndedRef.current) return;
      const raw = event.results?.[0]?.[0]?.transcript || "";
      onResult(raw);
    };
    recognition.onerror = () => {
      if (!isCurrentSession()) return;
      recogRef.current = null;
      setListening(false);
      setStatus(language === "el"
        ? "Σφάλμα φωνής. Γράψε την κίνηση ή προσπάθησε ξανά."
        : "Speech error. Enter the move below or press Start to try again.");
      setMode("MOVE");
      setPendingSan("");
    };
    recognition.onend = () => {
      if (!isCurrentSession()) return;
      recogRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
    } catch {
      if (!isCurrentSession()) return;
      recognitionSessionRef.current += 1;
      recogRef.current = null;
      setListening(false);
      setStatus(language === "el"
        ? "Η φωνητική εισαγωγή δεν μπόρεσε να ξεκινήσει. Γράψε την κίνηση."
        : "Voice input could not start. Enter the move below.");
    }
  }

  function requestEngineMove() {
    if (gameEndedRef.current) return false;

    const controller = engineControllerRef.current;
    if (!controller?.available) {
      setStatus(language === "el"
        ? "Το Stockfish δεν είναι έτοιμο. Προσπάθησε ξανά."
        : "Engine is not ready. Please try again.");
      return false;
    }

    const profile = getDifficultyProfile(difficultyRef.current);
    const profileName = language === "el" ? profile.nameEl : profile.nameEn;

    setEngineBusy(true);
    setStatus(language === "el"
      ? `Το Stockfish σκέφτεται — ${profileName}, περίπου ${profile.displayElo} Elo...`
      : `Engine thinking — ${profileName}, approximately ${profile.displayElo} Elo...`);

    try {
      const searchId = controller.search({
        elo: profile.elo,
        fen: chessRef.current.fen(),
        moveTimeMs: ENGINE_MOVE_TIME_MS,
      });
      if (searchId === null) {
        handleEngineFailure();
        return false;
      }
      return true;
    } catch {
      handleEngineFailure();
      return false;
    }
  }

  function applyPlayerSan(rawSan, source = "keyboard") {
    if (busyRef.current || gameEndedRef.current) return false;

    if (!engineControllerRef.current?.available) {
      setStatus(language === "el"
        ? "Το Stockfish δεν είναι διαθέσιμο. Ανανέωσε τη σελίδα για να προσπαθήσεις ξανά."
        : "Stockfish is unavailable. Reload the page to try again.");
      return false;
    }

    const san = (rawSan || "").trim();
    if (!san) {
      setStatus(language === "el"
        ? "Γράψε κίνηση SAN, για παράδειγμα e4, Nf3 ή O-O."
        : "Enter a move in SAN, for example e4, Nf3 or O-O.");
      return false;
    }

    const chess = chessRef.current;
    if (chess.turn() !== "w") return false;
    const move = applySanMove(chess, san);

    if (!move) {
      setMode("MOVE");
      setPendingSan("");
      setStatus(language === "el"
        ? "Παράνομη κίνηση. Γράψε SAN όπως e4, Nf3 ή O-O."
        : "Illegal move. Enter SAN such as e4, Nf3 or O-O.");
      if (source === "voice") speak("Illegal move. Please try again.");
      return false;
    }

    stopListening();
    setTypedSan("");
    setGameStarted(true);
    setMoves((previous) => [...previous, move.san]);

    if (chess.isCheckmate()) {
      endGame();
      setStatus(language === "el" ? "Ματ." : "Checkmate.");
      speak("Checkmate.");
      return true;
    }

    if (chess.isDraw()) {
      endGame();
      setStatus(language === "el" ? "Ισοπαλία." : "Draw.");
      speak("Draw.");
      return true;
    }

    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? `Έπαιξες ${move.san}. Το Stockfish σκέφτεται...`
      : `You played: ${move.san}. Engine thinking...`);
    speak(`You played: ${move.san}.`);
    requestEngineMove();
    return true;
  }

  function submitTypedMove(event) {
    event.preventDefault();
    applyPlayerSan(typedSan, "keyboard");
  }

  function startListeningForMove() {
    if (busyRef.current || gameEndedRef.current) return;

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
    if (busyRef.current || gameEndedRef.current) return;

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

    const profile = getDifficultyProfile(nextDifficulty);
    if (!profile) return;

    const name = language === "el" ? profile.nameEl : profile.nameEn;
    setStatus(language === "el"
      ? `Επιλέχθηκε ${name} — περίπου ${profile.displayElo} Elo μηχανής.`
      : `Selected ${name} — approximately ${profile.displayElo} engine Elo.`);
  }

  function resignGame() {
    if (!gameStarted || gameEndedRef.current) return;
    if (!window.confirm(copy.resignConfirm)) return;

    stopListening();
    engineControllerRef.current?.cancel();
    endGame();
    setTypedSan("");
    setMode("MOVE");
    setPendingSan("");
    setGameResultOverride("0-1");
    setStatus(language === "el"
      ? "Παραίτηση. Το Stockfish κερδίζει 0-1. Πάτησε Νέα παρτίδα για να ξαναπαίξεις."
      : "You resigned. Stockfish wins 0-1. Press New game to play again.");
    speak("You resigned. Stockfish wins.");
  }

  function newGame() {
    stopListening();
    engineControllerRef.current?.cancel({ newGame: true });

    gameEndedRef.current = false;
    chessRef.current = new Chess();
    setMoves([]);
    setTypedSan("");
    setEngineBusy(false);
    setGameStarted(false);
    setGameEnded(false);
    setGameResultOverride(null);
    setMode("MOVE");
    setPendingSan("");
    setStatus(language === "el"
      ? `Νέα παρτίδα — ${selectedProfileName}, περίπου ${selectedProfile.displayElo} Elo μηχανής. Γράψε κίνηση SAN ή πάτησε Έναρξη φωνής.`
      : `New game — ${selectedProfileName}, approximately ${selectedProfile.displayElo} engine Elo. Enter a SAN move or press Start.`);
    speak("New game. Your move.");
  }

  function openHowToPlay(event) {
    event?.preventDefault();
    setLegalSection(null);
    setShowSettings(false);
    setShowHowToPlay(true);
  }

  function openSettings(event) {
    event.preventDefault();
    setLegalSection(null);
    setShowHowToPlay(false);
    setShowSettings(true);
  }

  function openLegalSection(section) {
    setShowHowToPlay(false);
    setShowSettings(false);
    setLegalSection(section);
  }

  function openEvaluationPanel() {
    setShowEvaluation(true);
    window.requestAnimationFrame(() => {
      document.getElementById("stockfish-evaluation-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  const currentFen = chessRef.current.fen();
  const sanText = formatMovesSan(moves, copy.noMoves);

  return (
    <div className="app-shell" id="home">
      <header className="app-header">
        <div className="app-header-top">
          <div className="brand-block">
            <p className="eyebrow">{copy.privateSpace}</p>
            <h1>{copy.appName}</h1>
          </div>

          <div className="utility-actions" aria-label={copy.utilities}>
            <button
              aria-controls="stockfish-evaluation-panel"
              className="assistant-launch-button"
              onClick={openEvaluationPanel}
              title={engineReady ? copy.engineReady : copy.engineChecking}
              type="button"
            >
              <span className="assistant-avatar-wrap" aria-hidden="true">
                <span className="assistant-avatar">♞</span>
                <span className={`engine-dot ${engineReady ? "is-ready" : "is-checking"}`} />
              </span>
              <span>{copy.stockfishAssistant}</span>
            </button>

            <div className="language-switch" aria-label={copy.language}>
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

            <a
              aria-controls="appearance-settings-dialog"
              aria-expanded={showSettings}
              aria-haspopup="dialog"
              href="#appearance-settings-dialog"
              onClick={openSettings}
            >
              {copy.settings}
            </a>
            <a href="mailto:markellos.markides@gmail.com?subject=Blindfold%20Chess%20Feedback">{copy.feedback}</a>
            <a className="ecosystem-link" href="https://markellosecosystem.com/" rel="noopener noreferrer" target="_blank">
              {copy.back}
            </a>
          </div>
        </div>

        <div className="navigation-row">
          <nav className="main-nav" aria-label={copy.mainNavigation}>
            <a className="active" href="#home">{copy.home}</a>
            <a href="#play">{copy.play}</a>
            <a href="#difficulty">{copy.difficultyNav}</a>
            <a href="#move-input">{copy.inputNav}</a>
            <a
              aria-controls="how-to-play-dialog"
              aria-expanded={showHowToPlay}
              aria-haspopup="dialog"
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
            <button className="primary-button" onClick={newGame}>{copy.newGame}</button>
            <button className="danger-button" disabled={!gameStarted || gameEnded} onClick={resignGame}>{copy.resign}</button>
            <button disabled={busy || engineFailed || gameEnded || listening || !speechSupported} onClick={startListeningForMove}>{copy.startVoice}</button>
            <button disabled={!listening} onClick={stopVoiceInput}>{copy.stop}</button>
          </div>

          <section className="control-section" id="move-input">
            <h3>{copy.inputHeading}</h3>
            <p className="field-help input-help">{copy.inputHelp}</p>
            <form className="move-form" onSubmit={submitTypedMove}>
              <input
                aria-label={copy.placeholder}
                autoCapitalize="characters"
                autoComplete="off"
                disabled={busy || engineFailed || gameEnded}
                onChange={(event) => setTypedSan(event.target.value)}
                placeholder={copy.placeholder}
                spellCheck="false"
                type="text"
                value={typedSan}
              />
              <button className="primary-button" disabled={busy || engineFailed || gameEnded || !typedSan.trim()} type="submit">
                {copy.playMove}
              </button>
            </form>
          </section>

          <BoardVisibilityToggle
            fen={currentFen}
            inputDisabled={busy || engineFailed || gameEnded}
            language={language}
            onSubmitMove={(san) => applyPlayerSan(san, "board")}
          />

          <section className="moves-panel" aria-live="polite">
            <h3>{copy.moves}</h3>
            <MovesVisibilityToggle
              gameResult={gameResultOverride}
              language={language}
              sanText={sanText}
            />
          </section>

          <section className="status-panel" aria-live="polite">
            <strong>{copy.status}:</strong> {status} {listening ? ` (${copy.listening})` : ""}{" "}
            {mode === "CONFIRM" && pendingSan ? ` | ${copy.pending}: ${pendingSan}` : ""}
            <ConfirmMoveButton
              disabled={busy || engineFailed || gameEnded}
              language={language}
              onConfirm={(san) => applyPlayerSan(san, "keyboard")}
              pendingSan={mode === "CONFIRM" ? pendingSan : ""}
            />
          </section>

          <EvaluationPanel
            fen={currentFen}
            gameplayBusy={busy}
            language={language}
            moveCount={moves.length}
            onVisibilityChange={setShowEvaluation}
            showEvaluation={showEvaluation}
          />
        </section>
      </main>

      <div className="local-storage-notice">
        <span aria-hidden="true">ⓘ</span>
        <span>{copy.localNotice}</span>
        <a
          aria-controls="how-to-play-dialog"
          aria-expanded={showHowToPlay}
          aria-haspopup="dialog"
          href="#how-to-play"
          onClick={openHowToPlay}
        >
          {copy.learnMore}
        </a>
      </div>

      <footer className="app-footer">
        <p>© 2026 Markellos Markides. {copy.rights}</p>
        <nav className="footer-meta" aria-label={copy.legalInfo}>
          <button onClick={() => openLegalSection("license")} type="button">{copy.license}</button>
          <button onClick={() => openLegalSection("privacy")} type="button">{copy.privacy}</button>
          <button onClick={() => openLegalSection("analytics")} type="button">{copy.analytics}</button>
          <button onClick={() => openLegalSection("copyright")} type="button">{copy.copyright}</button>
        </nav>
        <small className="build-version">{APP_VERSION}</small>
      </footer>

      {showHowToPlay ? (
        <ModalDialog
          describedBy="how-to-play-dialog-intro"
          dialogClassName="legal-dialog"
          id="how-to-play-dialog"
          labelId="how-to-play-dialog-title"
          onClose={() => setShowHowToPlay(false)}
        >
            <p className="eyebrow">{copy.guideNav}</p>
            <h2 id="how-to-play-dialog-title">{copy.guideTitle}</h2>
            <p id="how-to-play-dialog-intro">{copy.guideIntro}</p>
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
        </ModalDialog>
      ) : null}

      {legalCopy ? (
        <ModalDialog
          dialogClassName="legal-dialog"
          labelId="legal-dialog-title"
          onClose={() => setLegalSection(null)}
        >
            <h2 id="legal-dialog-title">{legalCopy.title}</h2>
            {legalCopy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => setLegalSection(null)} type="button">{copy.close}</button>
            </div>
        </ModalDialog>
      ) : null}

      <SettingsPanel
        isOpen={showSettings}
        language={language}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
