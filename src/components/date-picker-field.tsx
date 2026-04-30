"use client";

import { useState, useCallback } from "react";
import { CalendarDate } from "@internationalized/date";

type DatePickerFieldProps = {
  defaultValue?: string;
  name?: string;
};

function parseDateString(value: string | undefined): CalendarDate | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (y && m && d) return new CalendarDate(y, m, d);
  return undefined;
}

function formatDateValue(date: CalendarDate | null | undefined): string {
  if (!date) return "";
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function DatePickerField({ defaultValue, name }: DatePickerFieldProps) {
  const [value, setValue] = useState<CalendarDate | null>(() => parseDateString(defaultValue) ?? null);
  const [open, setOpen] = useState(false);

  const handleChange = useCallback((val: CalendarDate) => {
    setValue(val);
    setOpen(false);
  }, []);

  const fieldName = name ?? "date";
  const displayValue = formatDateValue(value);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          aria-label="Match date"
          className="h-10 w-full rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
          name={fieldName}
          readOnly
          placeholder="YYYY-MM-DD"
          value={displayValue}
        />
        <button
          aria-label="Open calendar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
          type="button"
          onClick={() => setOpen((prev) => !prev)}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <rect height="18" rx="2" width="18" x="3" y="4" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2">
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-[20rem] rounded-2xl border app-hairline bg-[linear-gradient(180deg,rgba(17,21,29,0.98),rgba(11,14,20,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
            <Calendar onChange={handleChange} value={value} />
          </div>
        </div>
      )}
    </div>
  );
}

function Calendar({ onChange, value }: { onChange: (val: CalendarDate) => void; value: CalendarDate | null }) {
  const now = new CalendarDate(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate(),
  );

  const [viewedYear, setViewedYear] = useState(value?.year ?? now.year);
  const [viewedMonth, setViewedMonth] = useState(value?.month ?? now.month);

  const goToPrevMonth = () => {
    if (viewedMonth === 1) {
      setViewedMonth(12);
      setViewedYear(viewedYear - 1);
    } else {
      setViewedMonth(viewedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewedMonth === 12) {
      setViewedMonth(1);
      setViewedYear(viewedYear + 1);
    } else {
      setViewedMonth(viewedMonth + 1);
    }
  };

  const firstDayOfMonth = new CalendarDate(viewedYear, viewedMonth, 1);
  const startWeekday = getDayOfWeek(firstDayOfMonth);
  const daysInMonth = getDaysInMonth(viewedYear, viewedMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
          type="button"
          onClick={goToPrevMonth}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-zinc-100">
          {MONTH_NAMES[viewedMonth - 1]} {viewedYear}
        </span>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
          type="button"
          onClick={goToNextMonth}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-[11px] font-medium uppercase tracking-wider app-copy-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const cellDate = new CalendarDate(viewedYear, viewedMonth, day);
          const isSelected = value != null && value.year === cellDate.year && value.month === cellDate.month && value.day === cellDate.day;
          const isToday = now.year === cellDate.year && now.month === cellDate.month && now.day === cellDate.day;

          return (
            <button
              key={day}
              className={`flex h-9 w-full items-center justify-center rounded-lg text-sm ${isSelected ? "bg-[rgba(140,167,146,0.3)] text-zinc-50 font-semibold" : isToday ? "border app-hairline text-zinc-100 font-medium" : "text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"}`}
              type="button"
              onClick={() => onChange(cellDate)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function getDayOfWeek(date: CalendarDate): number {
  const jsDate = new Date(date.year, date.month - 1, date.day);
  const day = jsDate.getDay();
  return day === 0 ? 6 : day - 1;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}