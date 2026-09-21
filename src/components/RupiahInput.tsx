"use client";

import { useState } from "react";

function formatThousands(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Plain <input type="number"> shows raw digits with no thousand separator
// ("3000000"), which is hard to read for Rupiah amounts. This shows a
// formatted display ("3.000.000") while submitting the raw digit string
// through a paired hidden input, so it drops into any existing
// <form action={...}> the same way name="foo" on a number input did.
export function RupiahInput({
  name,
  id,
  defaultValue,
  placeholder,
  className = "input",
  style,
  onValueChange,
  allowNegative = false,
}: {
  name: string;
  id?: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onValueChange?: (raw: number) => void;
  // Almost every Rupiah field in this app is a non-negative amount, but a
  // few (salary component deductions) are intentionally signed — off by
  // default so the common case can't accidentally start accepting "-".
  allowNegative?: boolean;
}) {
  const [display, setDisplay] = useState(() => {
    // 0 is treated the same as unset — an amount that's genuinely "not
    // filled in yet" (a blank new row, an unpriced pulled-in request) is
    // far more common than a deliberate Rp0, and showing a bare "0" reads
    // as broken rather than empty, especially stacked several fields deep.
    if (defaultValue === undefined || defaultValue === null || defaultValue === "" || defaultValue === 0) return "";
    const negative = allowNegative && Number(defaultValue) < 0;
    const digits = String(defaultValue).replace(/\D/g, "");
    return (negative ? "-" : "") + formatThousands(digits);
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const negative = allowNegative && e.target.value.trim().startsWith("-");
    // Typing "1" right after an existing "0" (a freshly-focused field, or
    // right after backspacing to empty) inserts at the cursor rather than
    // replacing it, so the raw digits can be "01" — strip leading zeros
    // before they ever reach the display, or every such field shows "01",
    // "007", etc. instead of the number that was actually typed.
    const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setDisplay((negative ? "-" : "") + formatThousands(digits));
    onValueChange?.((negative ? -1 : 1) * (parseInt(digits, 10) || 0));
  }

  return (
    <>
      <input
        className={className}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        autoComplete="off"
        id={id}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        style={style}
      />
      <input type="hidden" name={name} value={display.replace(/\./g, "")} />
    </>
  );
}
