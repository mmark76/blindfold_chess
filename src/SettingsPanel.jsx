import React, { useEffect, useRef, useState } from "react";
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
    close: "Close",
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
    close: "Κλείσιμο",
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
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [settings, setSettings] = useState(readSettings);
  const [language, setLanguage] = useState(
    document.documentElement.lang === "el" ? "el" : "en",
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const syncLanguageAndLink = () => {
      setLanguage(document.documentElement.lang === "el" ? "el" : "en");
      const settingsLink = document.querySelector(
        '.utility-actions > a[href="#difficulty"], .utility-actions > a[data-settings-link]',
      );

      if (settingsLink) {
        settingsLink.dataset.settingsLink = "true";
        settingsLink.setAttribute("href", "#appearance-settings-dialog");
        settingsLink.setAttribute("aria-haspopup", "dialog");
        settingsLink.setAttribute("aria-controls", "appearance-settings-dialog");
      }
    };

    const handleSettingsClick = (event) => {
      const trigger = event.target.closest?.(
        '.utility-actions > a[data-settings-link], .utility-actions > a[href="#difficulty"]',
      );
      if (!trigger) return;

      event.preventDefault();
      previousFocusRef.current = trigger;
      setIsOpen(true);
    };

    syncLanguageAndLink();

    const rootObserver = new MutationObserver(syncLanguageAndLink);
    rootObserver.observe(document.getElementById("root") || document.body, {
      childList: true,
      subtree: true,
    });

    const languageObserver = new MutationObserver(syncLanguageAndLink);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    document.addEventListener("click", handleSettingsClick, true);

    return () => {
      rootObserver.disconnect();
      languageObserver.disconnect();
      document.removeEventListener("click", handleSettingsClick, true);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeDialog = () => {
      setIsOpen(false);
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDialog();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const copy = LABELS[language] || LABELS.en;
  const updateSetting = (key) => (event) => {
    const value = event.target.value;
    if (!ALLOWED_VALUES[key].has(value)) return;
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS });
  const closeSettings = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="settings-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="appearance-settings-title"
        aria-modal="true"
        className="settings-dialog"
        id="appearance-settings-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="settings-heading">
          <div>
            <h2 id="appearance-settings-title">{copy.heading}</h2>
            <p>{copy.intro}</p>
          </div>
          <button aria-label={copy.close} onClick={closeSettings} type="button">×</button>
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

        <div className="settings-dialog-actions">
          <button onClick={resetSettings} type="button">{copy.reset}</button>
          <button className="primary-button" onClick={closeSettings} type="button">{copy.close}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
