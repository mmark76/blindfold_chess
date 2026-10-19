import React from "react";

const COPY = {
  en: {
    title: "Cookie-less analytics",
    text: "No analytics cookies are used. Only aggregate visit counts by UTC hour, domain, and country are recorded solely so the administrator can understand overall traffic. No identifiers, page paths, referrers, device data, or in-app actions are collected.",
    close: "Close analytics information",
  },
  el: {
    title: "Analytics χωρίς cookies",
    text: "Δεν χρησιμοποιούνται cookies analytics. Καταγράφονται μόνο συγκεντρωτικοί αριθμοί επισκέψεων ανά ώρα UTC, domain και χώρα, αποκλειστικά για να κατανοεί ο διαχειριστής τη συνολική επισκεψιμότητα. Δεν συλλέγονται αναγνωριστικά, διαδρομές σελίδων, referrers, δεδομένα συσκευής ή ενέργειες μέσα στην εφαρμογή.",
    close: "Κλείσιμο πληροφοριών analytics",
  },
};

export default function AnalyticsConsentBanner({
  forceOpen = false,
  language = "en",
  onClose,
}) {
  if (!forceOpen) return null;

  const copy = COPY[language] || COPY.en;

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
        <button
          aria-label={copy.close}
          className="analytics-consent-close"
          onClick={() => onClose?.()}
          title={copy.close}
          type="button"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
