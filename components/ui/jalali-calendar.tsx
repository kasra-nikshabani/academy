"use client";

import * as React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  JALALI_MONTH_NAMES,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT_NAMES,
  addJalaliMonths,
  formatJalaliLong,
  fromJalali,
  getJalaliMonthGrid,
  isSameJalaliDay,
  toJalali,
} from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";

export interface JalaliCalendarProps {
  /** Currently selected day. */
  value?: Date | undefined;
  onSelect?: (date: Date) => void;
  /** Earliest selectable day (inclusive). */
  minDate?: Date | undefined;
  /** Latest selectable day (inclusive). */
  maxDate?: Date | undefined;
  /** Extra rule on top of min/max — e.g. block past training dates. */
  isDateDisabled?: (date: Date) => boolean;
  /**
   * Move focus to the selected day on mount. Set when the calendar opens in a
   * popover, so a keyboard user lands on the grid instead of the nav arrows.
   * Left off for an inline calendar, which must not steal focus.
   */
  autoFocusDay?: boolean;
  className?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A Jalali month view, Saturday-first, in Persian digits.
 *
 * Written rather than adapted from react-day-picker: that library models a
 * Gregorian month and needs a full custom date library to think in Jalali.
 * Doing the month arithmetic directly keeps week order, leap years and Persian
 * numerals correct in one place, and it is covered by tests/unit/date.test.ts.
 */
export function JalaliCalendar({
  value,
  onSelect,
  minDate,
  maxDate,
  isDateDisabled,
  autoFocusDay = false,
  className,
}: JalaliCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const initial = toJalali(value ?? today);

  const [view, setView] = React.useState({ jy: initial.jy, jm: initial.jm });
  const [focusedDate, setFocusedDate] = React.useState<Date>(value ?? today);
  const gridRef = React.useRef<HTMLDivElement>(null);

  // Follow the selection when it changes from outside (e.g. a form reset).
  // Adjusted during render rather than in an effect: React re-runs the render
  // immediately with the new state instead of painting a stale month first.
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      const next = toJalali(value);
      setView({ jy: next.jy, jm: next.jm });
      setFocusedDate(value);
    }
  }

  const weeks = React.useMemo(
    () => getJalaliMonthGrid(view.jy, view.jm),
    [view],
  );

  // Moving DOM focus is exactly what an effect is for: syncing React state to
  // an external system.
  React.useEffect(() => {
    if (!autoFocusDay) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>('[data-focused="true"]')
      ?.focus();
  }, [autoFocusDay]);

  const isDisabled = React.useCallback(
    (date: Date): boolean => {
      if (minDate && date.getTime() < minDate.getTime() - DAY_MS) return true;
      if (maxDate && date.getTime() > maxDate.getTime() + DAY_MS) return true;
      return isDateDisabled?.(date) ?? false;
    },
    [minDate, maxDate, isDateDisabled],
  );

  const goToMonth = (delta: number): void => {
    setView((current) => addJalaliMonths(current.jy, current.jm, delta));
  };

  const moveFocus = (deltaDays: number): void => {
    const next = new Date(focusedDate.getTime() + deltaDays * DAY_MS);
    setFocusedDate(next);

    const nextJalali = toJalali(next);
    if (nextJalali.jy !== view.jy || nextJalali.jm !== view.jm) {
      setView({ jy: nextJalali.jy, jm: nextJalali.jm });
    }

    // Focus follows the roving tabindex after the grid re-renders.
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>('[data-focused="true"]')
        ?.focus();
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    // The grid is right-to-left: ArrowLeft moves forward in time.
    const moves: Record<string, number> = {
      ArrowLeft: 1,
      ArrowRight: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };

    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveFocus(delta);
      return;
    }

    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      goToMonth(event.key === "PageDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isDisabled(focusedDate)) onSelect?.(focusedDate);
    }
  };

  const years = React.useMemo(() => {
    const currentYear = toJalali(today).jy;
    const from = Math.min(currentYear - 40, view.jy);
    const to = Math.max(currentYear + 5, view.jy);
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }, [today, view.jy]);

  return (
    <div className={cn("w-fit p-3 select-none", className)} dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه قبل"
          onClick={() => goToMonth(-1)}
        >
          <ChevronRight className="size-4" />
        </Button>

        <div className="flex items-center gap-1">
          <select
            aria-label="ماه"
            className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            value={view.jm}
            onChange={(event) =>
              setView((current) => ({
                ...current,
                jm: Number(event.target.value),
              }))
            }
          >
            {JALALI_MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="سال"
            className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            value={view.jy}
            onChange={(event) =>
              setView((current) => ({
                ...current,
                jy: Number(event.target.value),
              }))
            }
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {toPersianDigits(year)}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ماه بعد"
          onClick={() => goToMonth(1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${JALALI_MONTH_NAMES[view.jm - 1]} ${toPersianDigits(view.jy)}`}
        onKeyDown={handleKeyDown}
      >
        <div role="row" className="mb-1 grid grid-cols-7">
          {WEEKDAY_SHORT_NAMES.map((short, index) => (
            <abbr
              key={short}
              role="columnheader"
              title={WEEKDAY_NAMES[index]}
              aria-label={WEEKDAY_NAMES[index]}
              className="grid h-8 place-items-center text-xs text-muted-foreground no-underline"
            >
              {short}
            </abbr>
          ))}
        </div>

        {weeks.map((week) => (
          <div
            role="row"
            key={week[0]!.date.toISOString()}
            className="grid grid-cols-7"
          >
            {week.map((cell) => {
              const selected = value
                ? isSameJalaliDay(cell.date, value)
                : false;
              const isToday = isSameJalaliDay(cell.date, today);
              const focused = isSameJalaliDay(cell.date, focusedDate);
              const disabled = isDisabled(cell.date);

              return (
                <div
                  role="gridcell"
                  aria-selected={selected}
                  key={cell.date.toISOString()}
                >
                  <button
                    type="button"
                    data-focused={focused}
                    tabIndex={focused ? 0 : -1}
                    disabled={disabled}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={formatJalaliLong(cell.date)}
                    onClick={() => {
                      setFocusedDate(cell.date);
                      onSelect?.(cell.date);
                    }}
                    className={cn(
                      "grid size-9 place-items-center rounded-md text-sm transition-colors focus-visible:ring-ring",
                      "focus-visible:ring-2 focus-visible:outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      !cell.isCurrentMonth && "text-muted-foreground/50",
                      isToday &&
                        !selected &&
                        "font-semibold ring-1 ring-brand ring-inset",
                      selected &&
                        "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                      disabled && "pointer-events-none line-through opacity-40",
                    )}
                  >
                    {toPersianDigits(cell.jalali.jd)}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const now = toJalali(today);
            setView({ jy: now.jy, jm: now.jm });
            setFocusedDate(fromJalali(now.jy, now.jm, now.jd));
          }}
        >
          امروز
        </Button>
      </div>
    </div>
  );
}
