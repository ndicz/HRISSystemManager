"use client";

import { useRef, useState } from "react";

// A native <input type="date"> shows the date in the browser's own locale,
// so the same app read "10/01/2026" (US, month first) for one person and
// "01/10/2026" for another. This always shows dd/mm/yyyy, with a calendar
// button that opens the browser's own picker, and submits/reports the
// usual ISO "yyyy-mm-dd" — a drop-in for the native input, either
// uncontrolled (`name` + `defaultValue`) or controlled (`value` + `onChange`).

function toDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function toIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// Typing "01102026" becomes "01/10/2026" as you go.
function autoSlash(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  min,
  max,
  disabled,
  title,
  className = "input",
  style,
  inputStyle,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const iso = controlled ? value : inner;
  const [text, setText] = useState(() => toDisplay(iso));
  // Follow changes made from outside (a parent resetting the value, the
  // calendar picker) without clobbering a half-typed date.
  const [shownIso, setShownIso] = useState(iso);
  if (iso !== shownIso) {
    setShownIso(iso);
    setText(toDisplay(iso));
  }
  const pickerRef = useRef<HTMLInputElement>(null);

  function commit(next: string) {
    if (!controlled) setInner(next);
    setShownIso(next);
    onChange?.(next);
  }

  function handleType(raw: string) {
    const formatted = autoSlash(raw);
    setText(formatted);
    if (formatted === "") {
      commit("");
      return;
    }
    const parsed = toIso(formatted);
    if (parsed && (!min || parsed >= min) && (!max || parsed <= max)) commit(parsed);
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", ...style }}>
      <input
        className={className}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => handleType(e.target.value)}
        onBlur={() => setText(toDisplay(iso))}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        title={title ?? "Format tanggal: dd/mm/yyyy"}
        disabled={disabled}
        style={{ width: "100%", paddingRight: 34, ...inputStyle }}
      />
      <button
        type="button"
        aria-label="Buka kalender"
        disabled={disabled}
        onClick={() => {
          const el = pickerRef.current;
          if (!el) return;
          try { el.showPicker(); } catch { el.focus(); }
        }}
        style={{ position: "absolute", right: 6, background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 0, color: "inherit", opacity: 0.6 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {/* The browser's own calendar, kept invisible behind the button. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        min={min}
        max={max}
        onChange={(e) => { commit(e.target.value); setText(toDisplay(e.target.value)); }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      {name && <input type="hidden" name={name} value={iso} />}
    </div>
  );
}
