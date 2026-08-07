import React from "react";

export default function ConfirmMoveButton({ disabled = false, language, onConfirm, pendingSan }) {
  if (!pendingSan) return null;

  const label = language === "el" ? "Επιβεβαίωση κίνησης" : "Confirm move";

  return (
    <button
      aria-label={`${label}: ${pendingSan}`}
      className="primary-button"
      disabled={disabled}
      onClick={() => onConfirm(pendingSan)}
      style={{
        marginLeft: "0.75rem",
        marginTop: "0.5rem",
        minHeight: 36,
        padding: "0.45rem 0.75rem",
      }}
      type="button"
    >
      {label}
    </button>
  );
}
