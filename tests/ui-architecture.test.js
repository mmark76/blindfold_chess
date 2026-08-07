import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const COMPONENTS = [
  "BoardVisibilityToggle.jsx",
  "ConfirmMoveButton.jsx",
  "MovesVisibilityToggle.jsx",
  "EvaluationPanel.jsx",
  "SettingsPanel.jsx",
];

test("UI components communicate through React props rather than DOM bridges", async () => {
  for (const filename of COMPONENTS) {
    const source = await readFile(new URL(`../src/${filename}`, import.meta.url), "utf8");

    assert.doesNotMatch(source, /\bMutationObserver\b/, `${filename} installs a MutationObserver`);
    assert.doesNotMatch(source, /\bcreatePortal\b/, `${filename} creates a dynamic portal`);
    assert.doesNotMatch(source, /\.querySelector(?:All)?\s*\(/, `${filename} reaches into another component's DOM`);
    assert.doesNotMatch(source, /\brequestSubmit\s*\(/, `${filename} submits a form through the DOM`);
    assert.doesNotMatch(source, /\bdispatchEvent\s*\(/, `${filename} dispatches synthetic DOM events`);
  }
});

test("the root renders one React application tree", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");

  assert.match(source, /<App\s*\/>/);
  for (const filename of COMPONENTS) {
    const componentName = filename.replace(/\.jsx$/, "");
    assert.doesNotMatch(source, new RegExp(`<${componentName}\\s*/>`));
  }
});
