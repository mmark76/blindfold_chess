import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoredBoolean,
  getStoredEnum,
  getStoredInteger,
  getStoredValue,
  setStoredValue,
} from "../src/storage.js";

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

test("storage readers accept only explicitly allowed persisted values", () => {
  const values = new Map([
    ["truthy", "true"],
    ["falsey", "false"],
    ["invalidBoolean", "yes"],
    ["language", "el"],
    ["invalidLanguage", "de"],
    ["difficulty", "12"],
    ["decimalDifficulty", "2.5"],
  ]);

  withStorage({ getItem: (key) => values.get(key) ?? null }, () => {
    assert.equal(getStoredBoolean("truthy", false), true);
    assert.equal(getStoredBoolean("falsey", true), false);
    assert.equal(getStoredBoolean("invalidBoolean", false), false);
    assert.equal(getStoredEnum("language", ["en", "el"], "en"), "el");
    assert.equal(getStoredEnum("invalidLanguage", ["en", "el"], "en"), "en");
    assert.equal(getStoredInteger("difficulty", [1, 5, 12], 5), 12);
    assert.equal(getStoredInteger("decimalDifficulty", [1, 2, 3], 1), 1);
  });
});

test("storage failures fall back without crashing application initialization", () => {
  const blockedStorage = {
    getItem() {
      throw new DOMException("blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("quota", "QuotaExceededError");
    },
  };

  withStorage(blockedStorage, () => {
    assert.equal(getStoredValue("language", "en"), "en");
    assert.equal(getStoredBoolean("board", true), true);
    assert.equal(setStoredValue("language", "el"), false);
  });
});

test("storage writes stringify values", () => {
  const values = new Map();

  withStorage({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }, () => {
    assert.equal(setStoredValue("difficulty", 7), true);
    assert.equal(values.get("difficulty"), "7");
  });
});
