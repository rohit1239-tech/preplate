"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  ariaLabelPrefix?: string;
}

export function OtpInput({ value, onChange, length = 6, disabled, className, ariaLabelPrefix = "OTP digit" }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function setDigit(index: number, rawValue: string) {
    const nextDigit = rawValue.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = nextDigit;
    onChange(next.join("").slice(0, length));
    if (nextDigit && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handlePaste(rawValue: string) {
    const pasted = rawValue.replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, length) - 1]?.focus();
  }

  return (
    <div className={cn("flex justify-between gap-2", className)}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`${ariaLabelPrefix} ${index + 1}`}
          className="size-12 rounded-md border border-border bg-surface text-center text-xl font-semibold text-text-primary shadow-[var(--shadow-sm)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 sm:size-14"
          onChange={(event) => setDigit(index, event.target.value)}
          onFocus={(event) => event.target.select()}
          onPaste={(event) => {
            event.preventDefault();
            handlePaste(event.clipboardData.getData("text"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
            if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
            if (event.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
