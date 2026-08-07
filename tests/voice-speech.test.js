import assert from "node:assert/strict";
import test from "node:test";

import { sanFromSpeech } from "../src/voice/sanFromSpeech.js";

test("speech parsing covers castling, piece moves, captures, and checks", () => {
  assert.equal(sanFromSpeech("castle king side"), "O-O");
  assert.equal(sanFromSpeech("castle queen side"), "O-O-O");
  assert.equal(sanFromSpeech("knight f three"), "Nf3");
  assert.equal(sanFromSpeech("bishop takes e five check"), "Bxe5+");
});

test("speech parsing covers pawn moves and promotion captures", () => {
  assert.equal(sanFromSpeech("e four"), "e4");
  assert.equal(
    sanFromSpeech("d takes e eight promote to queen check"),
    "dxe8=Q+",
  );
});

test("empty or punctuation-only speech does not produce SAN", () => {
  assert.equal(sanFromSpeech(""), "");
  assert.equal(sanFromSpeech(null), "");
  assert.equal(sanFromSpeech("..."), "");
});
