import assert from "node:assert/strict";
import test from "node:test";
import { initializeAnalytics } from "../src/analytics.js";

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.head = {
      appendChild: (element) => {
        this.elements.set(element.id, element);
      },
    };
  }

  createElement() {
    return {};
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

function withBrowserEnvironment(location, callback) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  const documentRef = new FakeDocument();

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentRef,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: location,
  });

  try {
    callback(documentRef);
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;

    if (locationDescriptor) Object.defineProperty(globalThis, "location", locationDescriptor);
    else delete globalThis.location;
  }
}

test("cookie-less analytics loads once on the production hostname", () => {
  withBrowserEnvironment(
    {
      hostname: "blindfoldchess.markellosecosystem.com",
      protocol: "https:",
    },
    (documentRef) => {
      assert.equal(initializeAnalytics(), true);

      const script = documentRef.getElementById("blindfold-cookieless-analytics");
      assert.equal(script.async, true);
      assert.equal(script.src, "https://analytics.markellosecosystem.com/v1/script.js");
      assert.equal(initializeAnalytics(), false);
    },
  );
});

test("cookie-less analytics does not load outside the production hostname", () => {
  withBrowserEnvironment(
    {
      hostname: "localhost",
      protocol: "https:",
    },
    (documentRef) => {
      assert.equal(initializeAnalytics(), false);
      assert.equal(documentRef.elements.size, 0);
    },
  );
});
