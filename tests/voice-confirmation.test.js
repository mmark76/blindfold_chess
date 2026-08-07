import test from "node:test";
import assert from "node:assert/strict";
import { interpretConfirmCommand } from "../src/voice/interpretConfirmCommand.js";

test("confirmation commands use complete words instead of substrings", () => {
  assert.equal(interpretConfirmCommand("confirm"), "CONFIRM");
  assert.equal(interpretConfirmCommand("yes, please"), "CONFIRM");
  assert.equal(interpretConfirmCommand("rook a3"), "UNKNOWN");
  assert.equal(interpretConfirmCommand("look again later"), "REPEAT");
});

test("negative confirmation commands take precedence", () => {
  assert.equal(interpretConfirmCommand("do not confirm"), "CANCEL");
  assert.equal(interpretConfirmCommand("no, confirm"), "CANCEL");
  assert.equal(interpretConfirmCommand("don't accept"), "CANCEL");
  assert.equal(interpretConfirmCommand("cancel"), "CANCEL");
});

test("repeat and short affirmative phrases remain supported", () => {
  assert.equal(interpretConfirmCommand("say again"), "REPEAT");
  assert.equal(interpretConfirmCommand("pardon"), "REPEAT");
  assert.equal(interpretConfirmCommand("do it"), "CONFIRM");
  assert.equal(interpretConfirmCommand("go"), "CONFIRM");
  assert.equal(interpretConfirmCommand(""), "UNKNOWN");
});
