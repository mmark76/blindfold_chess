import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ANALYTICS_NOTICE_DISMISSED_KEY,
  dismissAnalyticsNotice,
  shouldShowAnalyticsNotice,
} from "../src/analytics-notice.js";

function withStorage(storage, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
}

test("analytics notice shows on a first visit and stays hidden after dismissal", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  withStorage(storage, () => {
    assert.equal(shouldShowAnalyticsNotice(), true);
    assert.equal(dismissAnalyticsNotice(), true);
    assert.equal(values.get(ANALYTICS_NOTICE_DISMISSED_KEY), "true");
    assert.equal(shouldShowAnalyticsNotice(), false);
  });
});

test("analytics notice returns after site storage is cleared", () => {
  const values = new Map([[ANALYTICS_NOTICE_DISMISSED_KEY, "true"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  withStorage(storage, () => {
    assert.equal(shouldShowAnalyticsNotice(), false);
    values.clear();
    assert.equal(shouldShowAnalyticsNotice(), true);
  });
});

test("blocked storage leaves the notice available without throwing", () => {
  const blockedStorage = {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("blocked", "QuotaExceededError");
    },
  };

  withStorage(blockedStorage, () => {
    assert.equal(shouldShowAnalyticsNotice(), true);
    assert.equal(dismissAnalyticsNotice(), false);
  });
});

test("the app initializes from dismissal state and preserves manual reopening", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(source, /useState\(\(\) => \(\s*shouldShowAnalyticsNotice\(\)\s*\)\)/);
  assert.match(source, /function openAnalyticsChoices\(\)[\s\S]*setShowAnalyticsChoices\(true\)/);
  assert.match(source, /function closeAnalyticsChoices\(\)[\s\S]*dismissAnalyticsNotice\(\)/);
});
