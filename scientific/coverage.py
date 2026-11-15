"""Reproducible UTC calendar coverage shared by every time-series generator."""
from __future__ import annotations

import argparse
import calendar
from datetime import date, datetime, timezone
from pathlib import Path


def anniversary(day, year):
    return day.replace(year=year, day=min(day.day, calendar.monthrange(year, day.month)[1]))


def configure(module, argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", type=date.fromisoformat)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--resume-staging", action="store_true",
                        help="rebuild.py only: validate/finalize an existing matching staging generation")
    args = parser.parse_args(argv)
    if bool(args.start) != bool(args.end) or (args.as_of and args.start):
        parser.error("Use --as-of YYYY-MM-DD OR both --start and --end YYYY-MM-DD")
    today = args.as_of or datetime.now(timezone.utc).date()
    start = args.start or anniversary(today, today.year - 1)
    end = args.end or anniversary(today, today.year + 1)
    if start >= end:
        parser.error("start must precede end")
    # DE440s coverage is 1849-2150; enforce a deliberately narrower supported range.
    if start.year < 1900 or end.year > 2100:
        parser.error("Supported date range is 1900-2100 with the pinned kernels")
    module.PERIOD = {"startUtc": f"{start.isoformat()}T00:00:00Z",
                     "endUtc": f"{end.isoformat()}T00:00:00Z"}
    module.COVERAGE_POLICY = {
        "mode": "explicit-interval" if args.start else "rolling-calendar-years",
        "asOfUtcDate": None if args.start else today.isoformat(),
        "calendarYearsBefore": None if args.start else 1,
        "calendarYearsAfter": None if args.start else 1,
        "boundaryConvention": "Both UTC midnight endpoints included in sample arrays; interval durations exclude the final endpoint.",
        "leapDayPolicy": "February 29 anniversaries clamp to February 28 in non-leap years.",
        "refreshPolicy": "Regenerate for the current UTC date once daily; advancing the date drops the oldest coverage and adds the new end. Deployment scheduling is external to this generator.",
    }
    if args.output_dir:
        module.OUT = str(args.output_dir.resolve())
    return args
