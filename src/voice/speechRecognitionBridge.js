const NativeSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function canonicalizeTranscript(raw) {
  return String(raw || "")
    .replace(/\bnights?\b/gi, "knight")
    .replace(/\bnite\b/gi, "knight")
    .replace(/\bhorse\b/gi, "knight")
    .replace(/\brock\b/gi, "rook")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTranscript(raw) {
  const text = canonicalizeTranscript(raw).toLowerCase();
  let score = 0;

  if (/\b(knight|bishop|rook|queen|king|castle|castling)\b/.test(text)) score += 5;
  if (/\b(takes?|capture[sd]?|check|checkmate|mate)\b/.test(text)) score += 3;
  if (/\b[a-h][1-8]\b/.test(text)) score += 5;
  if (/\b(a|ay|b|bee|c|see|sea|d|dee|e|f|ef|g|gee|h|aitch)\s+(one|won|two|to|too|three|tree|four|for|five|six|seven|eight|ate|[1-8])\b/.test(text)) score += 5;
  if (/\b(o\s*o|0\s*0)\b/.test(text)) score += 4;

  return score;
}

function chooseBestAlternative(result) {
  if (!result || !Number.isFinite(result.length) || result.length <= 0) return null;

  let best = result[0];
  let bestScore = scoreTranscript(best?.transcript);

  for (let index = 1; index < result.length; index += 1) {
    const candidate = result[index];
    const candidateScore = scoreTranscript(candidate?.transcript);
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  if (!best) return null;
  return {
    confidence: best.confidence,
    transcript: canonicalizeTranscript(best.transcript),
  };
}

function createSyntheticEvent(event) {
  const originalResult = event?.results?.[0];
  const best = chooseBestAlternative(originalResult);
  if (!best) return event;

  const syntheticResult = {
    0: best,
    length: 1,
    isFinal: originalResult?.isFinal ?? true,
    item(index) {
      return index === 0 ? best : null;
    },
  };

  const syntheticResults = {
    0: syntheticResult,
    length: 1,
    item(index) {
      return index === 0 ? syntheticResult : null;
    },
  };

  return new Proxy(event, {
    get(target, property, receiver) {
      if (property === "results") return syntheticResults;
      return Reflect.get(target, property, receiver);
    },
  });
}

if (NativeSpeechRecognition && !window.__blindfoldSpeechRecognitionEnhanced) {
  function EnhancedSpeechRecognition() {
    const recognition = new NativeSpeechRecognition();

    return new Proxy(recognition, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, property, value) {
        if (property === "maxAlternatives") {
          Reflect.set(target, property, Math.max(5, Number(value) || 1), target);
          return true;
        }

        if (property === "onresult" && typeof value === "function") {
          Reflect.set(target, property, (event) => value(createSyntheticEvent(event)), target);
          return true;
        }

        Reflect.set(target, property, value, target);
        return true;
      },
    });
  }

  EnhancedSpeechRecognition.prototype = NativeSpeechRecognition.prototype;
  window.SpeechRecognition = EnhancedSpeechRecognition;
  window.webkitSpeechRecognition = EnhancedSpeechRecognition;
  window.__blindfoldSpeechRecognitionEnhanced = true;
}
