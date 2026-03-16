"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { computeWeekEnd, ensureMonday } from "@/utils/date";
import { format } from "date-fns";

type Props = {
  value?: { start: string; end: string };
  onChange?: (range: { start: string; end: string }) => void;
};

export function WeeklyRangePicker({ value, onChange }: Props) {
  const [start, setStart] = useState<string>(
    value?.start ?? format(ensureMonday(new Date()), "yyyy-MM-dd"),
  );

  const normalizedStart = useMemo(
    () => format(ensureMonday(new Date(start)), "yyyy-MM-dd"),
    [start],
  );
  const end = useMemo(
    () => format(computeWeekEnd(new Date(normalizedStart)), "yyyy-MM-dd"),
    [normalizedStart],
  );

  useEffect(() => {
    onChange?.({ start: normalizedStart, end });
  }, [normalizedStart, end, onChange]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label>Week start (Monday)</Label>
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>Week end</Label>
        <Input type="date" value={end} readOnly />
      </div>
    </div>
  );
}
