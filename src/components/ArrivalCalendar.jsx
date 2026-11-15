import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { parseUtcDay } from "../lib/analysis.mjs";

// All dates are UTC calendar days. No device timezone or native date picker.
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const monthStart = (ms) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const monthLabel = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
const longLabel = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function ArrivalCalendar({
  id = "arrival",
  value,
  onChange,
  min,
  max,
}) {
  const uid = useId(),
    root = useRef(null),
    trigger = useRef(null),
    panel = useRef(null),
    pendingFocus = useRef(false);
  const lower = parseUtcDay(min),
    upper = parseUtcDay(max),
    selected = parseUtcDay(value);
  const clamp = (ms) => Math.max(lower, Math.min(upper, ms));
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(selected ?? lower),
    [month, setMonth] = useState(monthStart(selected ?? lower)),
    [position, setPosition] = useState({ top: 16, left: 16 });
  const invalid =
    value !== "" && (selected === null || selected < lower || selected > upper);
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!panel.current || !root.current) return;
      const anchor = root.current.getBoundingClientRect(),
        box = panel.current.getBoundingClientRect();
      const below = anchor.bottom + 8;
      const top = Math.max(
        16,
        Math.min(
          innerHeight - box.height - 16,
          below + box.height <= innerHeight - 16
            ? below
            : anchor.top - box.height - 8,
        ),
      );
      const left = Math.max(
        16,
        Math.min(anchor.left, innerWidth - box.width - 16),
      );
      setPosition((old) =>
        old.top === top && old.left === left ? old : { top, left },
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, month]);
  useEffect(() => {
    if (open && pendingFocus.current) {
      root.current?.querySelector(`[data-day="${iso(active)}"]`)?.focus();
      pendingFocus.current = false;
    }
  }, [open, active, month]);
  const show = () => {
    const ms = clamp(selected ?? lower);
    setActive(ms);
    setMonth(monthStart(ms));
    pendingFocus.current = true;
    setOpen(true);
  };
  const move = (ms) => {
    const date = clamp(ms);
    pendingFocus.current = true;
    setActive(date);
    setMonth(monthStart(date));
  };
  const shiftMonth = (offset) => {
    const d = new Date(active);
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0),
    ).getUTCDate();
    move(first + (Math.min(d.getUTCDate(), last) - 1) * DAY);
  };
  const start = month - ((new Date(month).getUTCDay() + 6) % 7) * DAY;
  const endMonth = Date.UTC(
    new Date(month).getUTCFullYear(),
    new Date(month).getUTCMonth() + 1,
    0,
  );
  const cellCount = Math.ceil(((endMonth - start) / DAY + 1) / 7) * 7;
  const weeks = Array.from({ length: cellCount / 7 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => start + (row * 7 + col) * DAY),
  );
  return (
    <div
      className="arrival-calendar"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="calendar-input-row">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          autoComplete="off"
          spellCheck={false}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={`${uid}-help`}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          ref={trigger}
          className="calendar-trigger"
          aria-label="Choose arrival date"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${uid}-dialog` : undefined}
          onClick={() => (open ? close() : show())}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 2v6m10-6v6M3 11h18m-13 4h2m4 0h2m-8 3h2" />
          </svg>
        </button>
      </div>
      <small
        className={invalid ? "calendar-hint invalid" : "calendar-hint"}
        id={`${uid}-help`}
      >
        {invalid
          ? "Use YYYY-MM-DD within the computed period. Other dates are not calculated."
          : "UTC date. Type YYYY-MM-DD or open the calendar."}
      </small>
      {open ? (
        <div
          id={`${uid}-dialog`}
          className="calendar-popover"
          ref={panel}
          style={{
            "--calendar-top": `${position.top}px`,
            "--calendar-left": `${position.left}px`,
          }}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-month`}
        >
          <div className="calendar-heading">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month <= monthStart(lower)}
              onClick={() => shiftMonth(-1)}
            >
              ←
            </button>
            <h3 id={`${uid}-month`} aria-live="polite">
              {monthLabel(month)}
            </h3>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= monthStart(upper)}
              onClick={() => shiftMonth(1)}
            >
              →
            </button>
          </div>
          <p className="calendar-coverage">
            Computed dates · {min} to {max}
          </p>
          <table
            role="grid"
            aria-labelledby={`${uid}-month`}
            onKeyDown={(e) => {
              if (e.target.tagName !== "BUTTON" || !e.target.dataset.day)
                return;
              const weekday = (new Date(active).getUTCDay() + 6) % 7;
              const moves = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
                Home: -weekday,
                End: 6 - weekday,
              };
              if (e.key in moves) {
                e.preventDefault();
                move(active + moves[e.key] * DAY);
              }
              if (e.key === "PageUp" || e.key === "PageDown") {
                e.preventDefault();
                shiftMonth(e.key === "PageUp" ? -1 : 1);
              }
            }}
          >
            <thead>
              <tr>
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <th key={day} scope="col">
                    <abbr title={day}>{day.slice(0, 1)}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, row) => (
                <tr key={row}>
                  {week.map((ms) => {
                    const available = ms >= lower && ms <= upper;
                    return (
                      <td key={ms} aria-selected={ms === selected}>
                        <button
                          type="button"
                          data-day={iso(ms)}
                          aria-label={longLabel(ms)}
                          className={`${monthStart(ms) !== month ? "adjacent " : ""}${ms === selected ? "selected" : ""}`}
                          disabled={!available}
                          tabIndex={ms === active ? 0 : -1}
                          onFocus={() => setActive(ms)}
                          onClick={() => {
                            onChange(iso(ms));
                            close(true);
                          }}
                        >
                          {new Date(ms).getUTCDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="calendar-keys">
            Arrow keys: days · Page Up/Down: month
          </p>
          <div className="calendar-footer">
            <button
              type="button"
              onClick={() => {
                onChange("");
                close(true);
              }}
            >
              Clear date
            </button>
            <button type="button" onClick={() => close(true)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
