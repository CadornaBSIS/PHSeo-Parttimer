"use client";

import { useEffect, useRef } from "react";
import { TimepickerUI } from "timepicker-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string; // stored value, "HH:MM" (24h)
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
};

function to12h(value24: string) {
  const [hhRaw, mmRaw] = value24.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "12:00 AM";
  const isPM = hh >= 12;
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const minutes = `${Math.max(0, Math.min(59, mm))}`.padStart(2, "0");
  return `${hour12}:${minutes} ${isPM ? "PM" : "AM"}`;
}

function to24h(hour: string | undefined, minutes: string | undefined, type: string | undefined) {
  const h = Number(hour);
  const m = Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const isPM = String(type ?? "").toUpperCase() === "PM";
  const hour12 = Math.max(1, Math.min(12, h));
  const hour24 = (hour12 % 12) + (isPM ? 12 : 0);
  const hh = `${hour24}`.padStart(2, "0");
  const mm = `${Math.max(0, Math.min(59, m))}`.padStart(2, "0");
  return `${hh}:${mm}`;
}

export function TimepickerInput({
  id,
  value,
  disabled,
  placeholder,
  className,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<TimepickerUI | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;

    const picker = new TimepickerUI(inputRef.current, {
      clock: { type: "12h" },
      ui: { editable: false },
      behavior: {
        // Avoid focus-jumping back to the input (feels odd in forms).
        focusInputAfterClose: false,
      },
      callbacks: {
        onConfirm: () => {
          const data = picker.getValue();
          const next = to24h(data.hour, data.minutes, data.type);
          if (next) onChangeRef.current(next);
        },
      },
    });

    pickerRef.current = picker;
    picker.create();
    // Sync initial value into the UI/input.
    picker.setValue(to12h(initialValueRef.current));

    return () => {
      picker.destroy();
      pickerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    // Keep the library state in sync when form values change externally.
    try {
      picker.setValue(to12h(value));
    } catch {
      // If an invalid value somehow slips through, keep the previous UI state.
    }
  }, [value]);

  return (
    <Input
      id={id}
      ref={inputRef}
      type="text"
      disabled={disabled}
      placeholder={placeholder}
      className={cn("cursor-pointer", className)}
      readOnly
    />
  );
}
