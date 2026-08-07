import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import globalStyles from "./styles.css?raw";
import boardStyles from "./board-visibility.css?raw";
import evaluationStyles from "./evaluation-panel.css?raw";
import settingsStyles from "./settings-panel.css?raw";
import "./styles.css";

function installBundledStyleFallback() {
  const styleId = "blindfold-bundled-styles";
  if (document.getElementById(styleId)) return;
  if (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--content-width")
      .trim()
  ) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.dataset.source = "javascript-bundle-fallback";
  style.textContent = [
    globalStyles,
    boardStyles,
    evaluationStyles,
    settingsStyles,
  ].join("\n\n");
  document.head.appendChild(style);
}

installBundledStyleFallback();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
