import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PENDING_MOVE_PATTERN = /(?:Pending|Αναμονή):\s*([A-Za-z0-9+#=xO-]+)/u;

function readPendingMove(statusPanel) {
  const text = statusPanel?.textContent || "";
  return text.match(PENDING_MOVE_PATTERN)?.[1] || "";
}

function setControlledInputValue(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  if (!valueSetter) return false;

  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export default function ConfirmMoveButton() {
  const [state, setState] = useState({
    target: null,
    pendingSan: "",
    language: "en",
  });

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const target = document.querySelector(".status-panel");
        const pendingSan = readPendingMove(target);
        const language = document.documentElement.lang === "el" ? "el" : "en";

        setState((previous) => {
          if (
            previous.target === target &&
            previous.pendingSan === pendingSan &&
            previous.language === language
          ) {
            return previous;
          }

          return { target, pendingSan, language };
        });
      });
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById("root") || document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function confirmPendingMove() {
    if (!state.pendingSan) return;

    const input = document.querySelector('#move-input input[type="text"]');
    const form = input?.closest("form");

    if (!input || !form || !setControlledInputValue(input, state.pendingSan)) return;

    window.setTimeout(() => form.requestSubmit(), 0);
  }

  if (!state.target || !state.pendingSan) return null;

  const label = state.language === "el" ? "Επιβεβαίωση κίνησης" : "Confirm move";

  return createPortal(
    <button
      aria-label={`${label}: ${state.pendingSan}`}
      className="primary-button"
      onClick={confirmPendingMove}
      style={{
        marginLeft: "0.75rem",
        marginTop: "0.5rem",
        minHeight: 36,
        padding: "0.45rem 0.75rem",
      }}
      type="button"
    >
      {label}
    </button>,
    state.target,
  );
}
