import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "blindfold-show-moves";

function getInitialVisibility() {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export default function MovesVisibilityToggle() {
  const [showMoves, setShowMoves] = useState(getInitialVisibility);
  const [state, setState] = useState({ host: null, movesList: null, language: "en" });

  useEffect(() => {
    let animationFrame = 0;

    const sync = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const panel = document.querySelector(".moves-panel");
        const movesList = panel?.querySelector("pre") || null;
        const language = document.documentElement.lang === "el" ? "el" : "en";

        if (!panel || !movesList) {
          setState({ host: null, movesList: null, language });
          return;
        }

        movesList.id = "moves-san-list";

        let host = panel.querySelector("[data-moves-visibility-host]");
        if (!host) {
          host = document.createElement("div");
          host.dataset.movesVisibilityHost = "true";
          host.style.display = "flex";
          host.style.justifyContent = "flex-end";
          host.style.marginBottom = "0.65rem";
          panel.insertBefore(host, movesList);
        }

        setState((previous) => {
          if (
            previous.host === host &&
            previous.movesList === movesList &&
            previous.language === language
          ) {
            return previous;
          }

          return { host, movesList, language };
        });
      });
    };

    sync();

    const rootObserver = new MutationObserver(sync);
    rootObserver.observe(document.getElementById("root") || document.body, {
      childList: true,
      subtree: true,
    });

    const languageObserver = new MutationObserver(sync);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    return () => {
      rootObserver.disconnect();
      languageObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showMoves));

    if (state.movesList) {
      state.movesList.hidden = !showMoves;
    }
  }, [showMoves, state.movesList]);

  if (!state.host) return null;

  const label = showMoves
    ? state.language === "el" ? "Απόκρυψη κινήσεων" : "Hide moves"
    : state.language === "el" ? "Εμφάνιση κινήσεων" : "Show moves";

  return createPortal(
    <button
      aria-controls="moves-san-list"
      aria-expanded={showMoves}
      onClick={() => setShowMoves((current) => !current)}
      style={{
        minHeight: 36,
        padding: "0.45rem 0.75rem",
      }}
      type="button"
    >
      {label} (SAN)
    </button>,
    state.host,
  );
}
