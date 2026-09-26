import { getStoredEnum, setStoredValue } from "./storage.js";

export const GA4_MEASUREMENT_ID = "G-DK5WN8TH3Z";
export const ANALYTICS_CONSENT_KEY = "blindfold-analytics-consent-v1";

const GOOGLE_TAG_SCRIPT_ID = "blindfold-google-tag";
const DENIED_CONSENT = Object.freeze({
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
});

let configured = false;

function getGtag() {
  globalThis.dataLayer = globalThis.dataLayer || [];

  if (typeof globalThis.gtag !== "function") {
    globalThis.gtag = function gtag() {
      globalThis.dataLayer.push(arguments);
    };
  }

  return globalThis.gtag;
}

export function getAnalyticsConsent() {
  return getStoredEnum(
    ANALYTICS_CONSENT_KEY,
    ["granted", "denied"],
    null,
  );
}

function applyConsent(consent) {
  getGtag()("consent", "update", {
    ...DENIED_CONSENT,
    analytics_storage: consent === "granted" ? "granted" : "denied",
  });
}

export function setAnalyticsConsent(consent) {
  if (!["granted", "denied"].includes(consent)) return false;
  const stored = setStoredValue(ANALYTICS_CONSENT_KEY, consent);
  applyConsent(consent);
  return stored;
}

export function initializeAnalytics() {
  const gtag = getGtag();
  gtag("consent", "default", DENIED_CONSENT);
  applyConsent(getAnalyticsConsent());

  const documentRef = globalThis.document;
  if (documentRef && !documentRef.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    const script = documentRef.createElement("script");
    script.id = GOOGLE_TAG_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    documentRef.head.appendChild(script);
  }

  if (configured) return;

  gtag("js", new Date());
  gtag("config", GA4_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  configured = true;
}
