import React, { useEffect, useState } from "react";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "./analytics.js";

const COPY = {
  en: {
    title: "Analytics choices",
    text: "Google Analytics helps measure visits and page use. Analytics storage stays disabled unless you allow it. Advertising features remain disabled.",
    necessary: "Necessary only",
    allow: "Allow analytics",
    close: "Close analytics choices",
  },
  el: {
    title: "Επιλογές αναλυτικών στοιχείων",
    text: "Το Google Analytics βοηθά στη μέτρηση επισκέψεων και χρήσης των σελίδων. Η αποθήκευση analytics παραμένει απενεργοποιημένη εκτός αν την επιτρέψεις. Οι διαφημιστικές λειτουργίες παραμένουν απενεργοποιημένες.",
    necessary: "Μόνο απαραίτητα",
    allow: "Επιτρέπω analytics",
    close: "Κλείσιμο επιλογών analytics",
  },
};

export default function AnalyticsConsentBanner({
  forceOpen = false,
  language = "en",
  onClose,
}) {
  const [consent, setConsent] = useState(() => getAnalyticsConsent());

  useEffect(() => {
    if (forceOpen) setConsent(getAnalyticsConsent());
  }, [forceOpen]);

  const copy = COPY[language] || COPY.en;
  const visible = forceOpen || consent === null;

  function choose(nextConsent) {
    setAnalyticsConsent(nextConsent);
    setConsent(nextConsent);
    onClose?.();
  }

  if (!visible) return null;

  return (
    <aside
      aria-labelledby="analytics-consent-title"
      className="analytics-consent"
      role="dialog"
    >
      <div>
        <h2 id="analytics-consent-title">{copy.title}</h2>
        <p>{copy.text}</p>
      </div>

      <div className="analytics-consent-actions">
        <button onClick={() => choose("denied")} type="button">
          {copy.necessary}
        </button>
        <button
          className="analytics-consent-allow"
          onClick={() => choose("granted")}
          type="button"
        >
          {copy.allow}
        </button>
        {consent !== null ? (
          <button
            aria-label={copy.close}
            className="analytics-consent-close"
            onClick={() => onClose?.()}
            title={copy.close}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
    </aside>
  );
}
