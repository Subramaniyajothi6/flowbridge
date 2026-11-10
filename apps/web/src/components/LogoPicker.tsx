import { ImageUp } from "lucide-react";
import type { ReactNode } from "react";
import { LOGO_ACCEPT } from "../pages/logo-file.ts";

// The browser's own file box looks out of place, so it is hidden inside a normal-looking button.
// It stays reachable by keyboard, because a hidden input inside a label can still be focused.
// The logo and the buttons share one line, and the hint sits under the buttons.
export function LogoPicker({ preview, buttonLabel, hint, isBusy, onFile, extra }: {
  preview: ReactNode;
  buttonLabel: string;
  hint: string;
  isBusy?: boolean;
  onFile: (file: File | undefined) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="logo-picker">
      <div className="logo-picker-preview">{preview}</div>
      <div className="row logo-picker-actions">
        <label className={`btn btn-sm logo-picker-button ${isBusy ? "is-busy" : ""}`}>
          <ImageUp size={14} aria-hidden="true" /> {isBusy ? "Uploading..." : buttonLabel}
          <input
            className="sr-only"
            type="file"
            accept={LOGO_ACCEPT}
            disabled={isBusy}
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              // Lets the same file be chosen again after a mistake.
              event.target.value = "";
            }}
          />
        </label>
        {extra}
      </div>
      <span className="hint logo-picker-hint">{hint}</span>
    </div>
  );
}
