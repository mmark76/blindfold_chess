import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./settings-panel.css";

const DEFAULT_SETTINGS = Object.freeze({
  theme: "classic",
  accent: "brown",
  textSize: "normal",
  font: "system",
  boardSize: "medium",
});

const STORAGE_KEYS = Object.freeze({
  theme: "blindfold-ui-theme",
  accent: "blindfold-ui-accent",
  textSize: "blindfold-ui-text-size",
  font: "blindfold-ui-font",
  boardSize: "blindfold-ui-board-size",
});

const ALLOWED_VALUES = Object.freeze({
  theme: new Set(["classic", "light", "dark"]),
  accent: new Set(["brown", "blue", "green", "burgundy"]),
  textSize: new Set(["small", "normal", "large", "xlarge"]),
  font: new Set(["system", "serif", "sans", "mono"]),
  boardSize: new Set(["small", "medium", "large"]),
});

const LABELS = Object.freeze({
  en: {
    heading: "Settings",
    intro: "Personalize the appearance of Blindfold Chess.",
    theme: "Theme",
    accent: "Accent color",
    textSize: "Text size",
    font: "Font",
    boardSize: "Board size",
    reset: "Reset settings",
    saved: "Appearance settings are stored locally in this browser.",
    themes: { classic: "Classic", light: "Light", dark: "Dark" },
    accents: { brown: "Brown", blue: "Blue", green: "Green", burgundy: "Burgundy" },
    textSizes: { small: "Small", normal: "Normal", large: "Large", xlarge: "Extra large" },
    fonts: { system: "System", serif: "Serif", sans: "Sans-serif", mono: "Monospace" },
    boardSizes: { small: "Small", medium: "Medium", large: "Large" },
  },
  el: {
    heading: "Ρυθμίσεις",
    intro: "Προσάρμοσε την εμφάνιση του Blindfold Chess.",
    theme: "Θέμα",
    accent: "Χρώμα έμφασης",
    textSize: "Μέγεθος κειμένου",
    font: "Γραμματοσειρά",
    boardSize: "Μέγεθος σκακιέρας",
    reset: "Επαναφορά ρυθμίσεων",
    saved: "Οι ρυθμίσεις εμφάνισης αποθηκεύονται τοπικά σε αυτόν τον browser.",
    themes: { classic: "Κλασικό", light: "Φωτεινό", dark: "Σκούρο" },
    accents: { brown: "Καφέ", blue: "Μπλε", green: "Πράσινο", burgundy: "Μπορντό" },
    textSizes: { small: "Μικρό", normal: "Κανονικό", large: "Μεγάλο", xlarge: "Πολύ μεγάλο" },
    fonts: { system: "Συστήματος", serif: "Serif", sans: "Sans-serif", mono: "Monospace" },
    boardSizes: { small: "Μικρή", medium: "Μεσαία", large: "Μεγάλη" },
  },
});

function readSettings() {
  const saved = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = localStorage.getItem(STORAGE_KEYS[key]);
    if (value && ALLOWED_VALUES[key].has(value)) saved[key] = value;
  }

  return saved;
}

function applySettings(settings) {
  const root = document.documentElement;
  root.dataset.uiTheme = settings.theme;
  root.dataset.uiAccent = settings.accent;
  root.dataset.uiTextSize = settings.textSize;
  root.dataset.uiFont = settings.font;
  root.dataset.uiBoardSize = settings.boardSize;
}

function saveSettings(settings) {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS[key], settings[key]);
  }
}

function SettingsSelect({ id, label, value, options, onChange }) {
  return (
    <label className="settings-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} onChange={onChange} value={value}>
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState(readSettings);
  const [state, setState] = useState({ host: null, language: "en" });

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const difficultySection = document.getElementById("difficulty");
        const language = document.documentElement.lang === "el" ? "el" : "en";
        const settingsLink = document.querySelector('.utility-actions > a[href="#difficulty"], .utility-actions > a[data-settings-link]');

        if (settingsLink) {
          settingsLink.dataset.settingsLink = "true";
          settingsLink.setAttribute("href", "#appearance-settings");
        }

        if (!difficultySection) {
          setState({ host: null, language });
          return;
        }

        let host = document.getElementById("appearance-settings");
        if (!host) {
          host = document.createElement("section");
          host.id = "appearance-settings";
          host.className = "settings-panel-host";
          difficultySection.insertAdjacentElement("beforebegin", host);
        }

        setState((previous) => {
          if (previous.host === host && previous.language === language) return previous;
          return { host, language };
        });
      });
    };

    sync();

    const rootObserver = new MutationObserver(sync);
    rootObserver.observe(document.getElementById("root") || document.body, {
      childList: true,
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

  if (!state.host) return null;

  const copy = LABELS[state.language] || LABELS.en;
  const updateSetting = (key) => (event) => {
    const value = event.target.value;
    if (!ALLOWED_VALUES[key].has(value)) return;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS });

  return createPortal(
    <div className="settings-panel">
      <div className="settings-heading">
        <div>
          <h3>{copy.heading}</h3>
          <p>{copy.intro}</p>
        </div>
        <button onClick={resetSettings} type="button">{copy.reset}</button>
      </div>

      <div className="settings-grid">
        <SettingsSelect
          id="ui-theme-select"
          label={copy.theme}
          onChange={updateSetting("theme")}
          options={copy.themes}
          value={settings.theme}
        />
        <SettingsSelect
          id="ui-accent-select"
          label={copy.accent}
          onChange={updateSetting("accent")}
          options={copy.accents}
          value={settings.accent}
        />
        <SettingsSelect
          id="ui-text-size-select"
          label={copy.textSize}
          onChange={updateSetting("textSize")}
          options={copy.textSizes}
          value={settings.textSize}
        />
        <SettingsSelect
          id="ui-font-select"
          label={copy.font}
          onChange={updateSetting("font")}
          options={copy.fonts}
          value={settings.font}
        />
        <SettingsSelect
          id="ui-board-size-select"
          label={copy.boardSize}
          onChange={updateSetting("boardSize")}
          options={copy.boardSizes}
          value={settings.boardSize}
        />
      </div>

      <p className="settings-storage-note">{copy.saved}</p>
    </div>,
    state.host,
  );
}
