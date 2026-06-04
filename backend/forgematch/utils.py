from __future__ import annotations

import math
import re
from datetime import date, datetime, timezone
from typing import Any, Iterable

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#.\-]{1,}")


def tokens(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text or "")]


def as_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()] if "," in value else [value.strip()]
    return [str(value).strip()]


def norm_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return " ".join(norm_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(f"{key} {norm_text(item)}" for key, item in value.items())
    return str(value)


def clamp01(value: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return max(0.0, min(1.0, float(value)))


def ratio(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number > 1.0:
        number = number / 100.0
    return clamp01(number)


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def overlap_score(required: Iterable[str], actual: Iterable[str]) -> float:
    required_set = {str(item).lower().strip() for item in required if str(item).strip()}
    actual_set = {str(item).lower().strip() for item in actual if str(item).strip()}
    if not required_set:
        return 0.5
    return len(required_set & actual_set) / len(required_set)


def days_since(value: Any) -> int | None:
    if not value:
        return None
    parsed = None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    else:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
            try:
                parsed = datetime.strptime(str(value).strip(), fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                pass
    if parsed is None:
        return None
    return max(0, (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days)

