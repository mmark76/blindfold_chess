import React from "react";
import ReactDOM from "react-dom/client";
import App from "./AppV2.jsx";
import BoardVisibilityToggle from "./BoardVisibilityToggle.jsx";
import ConfirmMoveButton from "./ConfirmMoveButton.jsx";
import EvaluationPanel from "./EvaluationPanel.jsx";
import MovesVisibilityToggle from "./MovesVisibilityToggle.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import globalStyles from "./styles.css?raw";
import boardStyles from "./board-visibility.css?raw";
import evaluationStyles from "./evaluation-panel.css?raw";
import settingsStyles from "./settings-panel.css?raw";
import "./styles.css";

function installBundledStyleFallback() {
  const styleId = "blindfold-bundled-styles";
  if (document.getElementById(styleId)) return;

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
    <>
      <App />
      <ConfirmMoveButton />
      <MovesVisibilityToggle />
      <BoardVisibilityToggle />
      <EvaluationPanel />
      <SettingsPanel />
    </>
  </React.StrictMode>
);
