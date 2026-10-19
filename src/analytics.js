const ANALYTICS_SCRIPT_ID = "blindfold-cookieless-analytics";
const ANALYTICS_SCRIPT_URL = "https://analytics.markellosecosystem.com/v1/script.js";
const PRODUCTION_HOSTS = new Set([
  "blindfoldchess.markellosecosystem.com",
]);

export function initializeAnalytics() {
  const documentRef = globalThis.document;
  const locationRef = globalThis.location;

  if (
    !documentRef
    || !locationRef
    || locationRef.protocol !== "https:"
    || !PRODUCTION_HOSTS.has(locationRef.hostname.toLowerCase())
    || documentRef.getElementById(ANALYTICS_SCRIPT_ID)
  ) {
    return false;
  }

  const script = documentRef.createElement("script");
  script.id = ANALYTICS_SCRIPT_ID;
  script.async = true;
  script.src = ANALYTICS_SCRIPT_URL;
  documentRef.head.appendChild(script);
  return true;
}
