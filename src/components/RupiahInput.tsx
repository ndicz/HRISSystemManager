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
}: {
  name: string;
  id?: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onValueChange?: (raw: number) => void;
}) {
  const [display, setDisplay] = useState(() => {
    // 0 is treated the same as unset — an amount that's genuinely "not
    // filled in yet" (a blank new row, an unpriced pulled-in request) is
    // far more common than a deliberate Rp0, and showing a bare "0" reads
    // as broken rather than empty, especially stacked several fields deep.
    const raw = defaultValue !== undefined && defaultValue !== null && defaultValue !== "" && defaultValue !== 0
      ? String(defaultValue).replace(/\D/g, "")
      : "";
    return formatThousands(raw);
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setDisplay(formatThousands(digits));
    onValueChange?.(parseInt(digits, 10) || 0);
  }

  return (
    <>
      <input
        className={className}
        type="text"
        inputMode="numeric"
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
