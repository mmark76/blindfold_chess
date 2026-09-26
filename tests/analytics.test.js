import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_CONSENT_KEY,
  GA4_MEASUREMENT_ID,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "../src/analytics.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("analytics consent defaults to unset and persists valid choices", () => {
  const previousStorage = globalThis.localStorage;
  const previousDataLayer = globalThis.dataLayer;
  const previousGtag = globalThis.gtag;

  globalThis.localStorage = new MemoryStorage();
  globalThis.dataLayer = [];
  delete globalThis.gtag;

  try {
    assert.equal(GA4_MEASUREMENT_ID, "G-DK5WN8TH3Z");
    assert.equal(getAnalyticsConsent(), null);

    assert.equal(setAnalyticsConsent("granted"), true);
    assert.equal(
      globalThis.localStorage.getItem(ANALYTICS_CONSENT_KEY),
      "granted",
    );
    assert.equal(getAnalyticsConsent(), "granted");

    assert.equal(setAnalyticsConsent("denied"), true);
    assert.equal(getAnalyticsConsent(), "denied");

    assert.equal(setAnalyticsConsent("invalid"), false);
    assert.equal(getAnalyticsConsent(), "denied");
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;

    if (previousDataLayer === undefined) delete globalThis.dataLayer;
    else globalThis.dataLayer = previousDataLayer;

    if (previousGtag === undefined) delete globalThis.gtag;
    else globalThis.gtag = previousGtag;
  }
});
