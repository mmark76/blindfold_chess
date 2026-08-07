import React, { useEffect, useState } from "react";
import ModalDialog from "./ModalDialog.jsx";
import { getStoredValue, setStoredValue } from "./storage.js";
import "./settings-panel.css";

const DEFAULT_SETTINGS = Object.freeze({
  theme: "classic",
  accent: "brown",
  textSize: "normal",
  font: "system",
});

const STORAGE_KEYS = Object.freeze({
  theme: "blindfold-ui-theme",
  accent: "blindfold-ui-accent",
  textSize: "blindfold-ui-text-size",
  font: "blindfold-ui-font",
});

const ALLOWED_VALUES = Object.freeze({
  theme: new Set(["classic", "light", "dark"]),
  accent: new Set(["brown", "blue", "green", "burgundy"]),
  textSize: new Set(["small", "normal", "large", "xlarge"]),
  font: new Set(["system", "serif", "sans", "mono"]),
});

const LABELS = Object.freeze({
  en: {
    heading: "Settings",
    intro: "Personalize the appearance of Blindfold Chess.",
    theme: "Theme",
    accent: "Accent color",
    textSize: "Text size",
    font: "Font",
    reset: "Reset settings",
    close: "Close",
    saved: "Appearance settings are stored locally in this browser.",
    themes: { classic: "Classic", light: "Light", dark: "Dark" },
    accents: { brown: "Brown", blue: "Blue", green: "Green", burgundy: "Burgundy" },
    textSizes: { small: "Small", normal: "Normal", large: "Large", xlarge: "Extra large" },
    fonts: { system: "System", serif: "Serif", sans: "Sans-serif", mono: "Monospace" },
  },
  el: {
    heading: "Ρυθμίσεις",
    intro: "Προσάρμοσε την εμφάνιση του Blindfold Chess.",
    theme: "Θέμα",
    accent: "Χρώμα έμφασης",
    textSize: "Μέγεθος κειμένου",
    font: "Γραμματοσειρά",
    reset: "Επαναφορά ρυθμίσεων",
    close: "Κλείσιμο",
    saved: "Οι ρυθμίσεις εμφάνισης αποθηκεύονται τοπικά σε αυτό το πρόγραμμα περιήγησης.",
    themes: { classic: "Κλασικό", light: "Φωτεινό", dark: "Σκούρο" },
    accents: { brown: "Καφέ", blue: "Μπλε", green: "Πράσινο", burgundy: "Μπορντό" },
    textSizes: { small: "Μικρό", normal: "Κανονικό", large: "Μεγάλο", xlarge: "Πολύ μεγάλο" },
    fonts: { system: "Συστήματος", serif: "Με πατούρες", sans: "Χωρίς πατούρες", mono: "Σταθερού πλάτους" },
  },
});

function readSettings() {
  const saved = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = getStoredValue(STORAGE_KEYS[key]);
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
  root.dataset.uiBoardSize = "medium";
}

function saveSettings(settings) {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    setStoredValue(STORAGE_KEYS[key], settings[key]);
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

export default function SettingsPanel({ isOpen, language, onClose }) {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const copy = LABELS[language] || LABELS.en;
  const updateSetting = (key) => (event) => {
    const value = event.target.value;
    if (!ALLOWED_VALUES[key].has(value)) return;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS });
  if (!isOpen) return null;

  return (
    <ModalDialog
      backdropClassName="settings-modal-backdrop"
      describedBy="appearance-settings-intro"
      dialogClassName="settings-dialog"
      id="appearance-settings-dialog"
      labelId="appearance-settings-title"
      onClose={onClose}
    >
        <div className="settings-heading">
          <div>
            <h2 id="appearance-settings-title">{copy.heading}</h2>
            <p id="appearance-settings-intro">{copy.intro}</p>
          </div>
          <button aria-label={copy.close} onClick={onClose} type="button">×</button>
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
        </div>

        <p className="settings-storage-note">{copy.saved}</p>

        <div className="settings-dialog-actions">
          <button onClick={resetSettings} type="button">{copy.reset}</button>
          <button className="primary-button" onClick={onClose} type="button">{copy.close}</button>
        </div>
    </ModalDialog>
  );
}
