import React from "react";

export default function ConfirmMoveButton({ disabled = false, language, onConfirm, pendingSan }) {
  if (!pendingSan) return null;

  const label = language === "el" ? "Επιβεβαίωση της κίνησής μου" : "Confirm my move";

  return (
    <button
      aria-label={`${label}: ${pendingSan}`}
      className="primary-button"
      disabled={disabled}
      onClick={() => onConfirm(pendingSan)}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        zIndex: 1200,
        width: "min(90vw, 340px)",
        minHeight: 52,
        padding: "0.75rem 1rem",
        transform: "translateX(-50%)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.28)",
        fontWeight: 700,
      }}
      type="button"
    >
      {label} · {pendingSan}
    </button>
  );
}
