from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "rankings.sqlite3"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            create table if not exists rankings (
                id integer primary key autoincrement,
                job_domain text not null,
                job_description text not null,
                created_at text not null,
                candidate_count integer not null,
                average_score real not null,
                top_candidate text,
                runtime_seconds real not null,
                ranking_version text not null,
                payload text not null
            )
            """
        )


def save_ranking(payload: dict, job_domain: str, job_description: str) -> int:
    init_db()
    rankings = payload.get("rankings", [])
    avg = sum(item.get("overall_score", 0) for item in rankings) / len(rankings) if rankings else 0
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            insert into rankings
            (job_domain, job_description, created_at, candidate_count, average_score, top_candidate, runtime_seconds, ranking_version, payload)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_domain or "Untitled Ranking",
                job_description,
                datetime.now(timezone.utc).isoformat(),
                len(rankings),
                round(avg, 2),
                rankings[0].get("name") if rankings else "",
                payload.get("runtime_seconds", 0),
                payload.get("ranking_version", "2.0.0"),
                json.dumps(payload),
            ),
        )
        return int(cursor.lastrowid)


def list_rankings() -> list[dict]:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "select id, job_domain, created_at, candidate_count, average_score, top_candidate, runtime_seconds, ranking_version from rankings order by id desc"
        ).fetchall()
    return [dict(row) for row in rows]


def get_ranking(ranking_id: int) -> dict | None:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("select payload from rankings where id = ?", (ranking_id,)).fetchone()
    return json.loads(row[0]) if row else None


def delete_ranking(ranking_id: int) -> bool:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("delete from rankings where id = ?", (ranking_id,))
        return cursor.rowcount > 0

