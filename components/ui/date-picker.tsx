"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { JalaliCalendar } from "@/components/ui/jalali-calendar";
import { formatJalali } from "@/lib/utils/date";

export interface DatePickerProps {
  value?: Date | undefined;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  minDate?: Date | undefined;
  maxDate?: Date | undefined;
  isDateDisabled?: (date: Date) => boolean;
  disabled?: boolean;
  /** Links the trigger to a `<Label htmlFor>`. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}

/** Jalali date field: a button that opens the calendar in a popover. */
export function DatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  minDate,
  maxDate,
  isDateDisabled,
  disabled,
  id,
  className,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          {value ? formatJalali(value) : placeholder}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <JalaliCalendar
          autoFocusDay
          value={value}
          minDate={minDate}
          maxDate={maxDate}
          isDateDisabled={isDateDisabled}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
