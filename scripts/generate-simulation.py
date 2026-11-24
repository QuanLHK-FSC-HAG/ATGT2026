"""Generate LOCAL-ONLY synthetic SafeRide data.

Uses names from data hs.xls only for the local Fschool Hậu Giang simulation.
Output lives under .runtime/simulation/ (gitignored). Never upload this output as-is.
"""
from __future__ import annotations

import hashlib
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data hs.xls"
OUT = ROOT / ".runtime" / "simulation"
SEED = "atgt2026-local-simulation-2026-11-14-12-14-v1"
RNG = random.Random(SEED)
TZ = timezone(timedelta(hours=7))
START = datetime(2026, 11, 14, 7, 20, tzinfo=TZ)
END = datetime(2026, 12, 14, 18, 10, tzinfo=TZ)
TODAY = datetime(2026, 11, 17, 23, 59, tzinfo=TZ)

SCHOOLS = [
    ("Fschool Sóc Trăng", "TP Cần Thơ", ["6A", "7A", "8A", "10A", "11A"]),
    ("Fschool Cần Thơ", "TP Cần Thơ", ["10A", "11A", "12A"]),
    ("Fschool Long Vân", "Gia Lai", ["10A", "11A", "12A"]),
    ("Fschool Đà Nẵng", "TP Đà Nẵng", ["10A", "11A", "12A"]),
    ("Fschool Hòa Lạc", "TP Hà Nội", ["10A", "11A", "12A"]),
    ("THCS Châu Văn Liêm", "TP Cần Thơ", ["6A", "7A", "8A", "9A"]),
    ("THCS Lê Quí Đôn", "TP Cần Thơ", ["6A", "7A", "8A", "9A"]),
    ("THCS Long Mỹ", "TP Cần Thơ", ["6A", "7A", "8A", "9A"]),
    ("THCS Ngô Quốc Trị", "TP Cần Thơ", ["6A", "7A", "8A", "9A"]),
]

FAMILIES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ"]
MIDDLES = ["Minh", "Ngọc", "Thảo", "Gia", "Khánh", "Quốc", "Thanh", "Anh", "Phương", "Bảo", "Tuệ", "Hải"]
GIVENS = ["An", "Bình", "Châu", "Duy", "Giang", "Hà", "Hân", "Khang", "Linh", "Long", "Minh", "Nam", "Nhi", "Phúc", "Quân", "Trang", "Vy", "Yến"]
SCENARIOS = ["SCN-101A", "SCN-202A", "SCN-303A", "SCN-404A", "SCN-505A", "SCN-606A", "SCN-707A", "SCN-808A"]


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def random_time() -> datetime:
    minutes = int((END - START).total_seconds() // 60)
    candidate = START + timedelta(minutes=RNG.randrange(minutes + 1))
    # Favor class-time windows then vary naturally.
    return candidate.replace(hour=RNG.choice([7, 8, 9, 13, 14, 15, 16]), minute=RNG.randrange(0, 60))


def fake_name() -> str:
    return f"{RNG.choice(FAMILIES)} {RNG.choice(MIDDLES)} {RNG.choice(GIVENS)}"


def real_hau_giang_names() -> list[tuple[str, str]]:
    book = xlrd.open_workbook(SOURCE)
    result: list[tuple[str, str]] = []
    for sheet_name, class_name in [("tin_hoc_6a", "6A"), ("tin_hoc_7a", "7A"), ("tin_hoc_8a", "8A"), ("tin_hoc_10a", "10A"), ("tin_hoc_11a", "11A")]:
        sheet = book.sheet_by_name(sheet_name)
        names = []
        for index in range(6, sheet.nrows):
            # Verified header: row 5, name column 2; column 0 is STT, not a name.
            ordinal = sheet.cell_value(index, 0)
            value = str(sheet.cell_value(index, 2)).strip()
            if isinstance(ordinal, (int, float)) and ordinal > 0 and value and value not in names:
                names.append(value)
        # Do not duplicate identities merely to achieve an arbitrary target.
        for name in names[:15]:
            result.append((name, class_name))
    return result


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit("Missing private source: data hs.xls")
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "logical_store.json"
    if target.exists():
        raise SystemExit(f"Refusing to overwrite existing simulation: {target}")

    players, runs, sessions, assessments, scenario_results, event_index, drive_batches, system_logs = [], [], [], [], [], [], {}, []
    all_students = [(name, grade, "Fschool Hậu Giang", "TP Cần Thơ", "private_local_name_source") for name, grade in real_hau_giang_names()]
    for school, province, grades in SCHOOLS:
        for index in range(60):
            all_students.append((fake_name(), grades[index % len(grades)], school, province, "synthetic_name"))

    for ordinal, (name, grade, school, province, name_source) in enumerate(all_students, 1):
        participant_id, run_id, session_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        created = random_time()
        base = RNG.randint(42, 82)
        pattern = RNG.choices(["improved", "flat", "declined", "incomplete"], [0.62, 0.18, 0.08, 0.12])[0]
        pre, post = base, max(0, min(100, base + (RNG.randint(8, 30) if pattern == "improved" else RNG.randint(-5, 5) if pattern == "flat" else RNG.randint(-18, -3))))
        complete = pattern != "incomplete"
        player = {"participant_id": participant_id, "full_name": name, "class_name": grade, "school_name": school, "province_city": province, "province_catalog_version": "project-34-2026", "privacy_notice_version": "SIMULATED_NO_CONSENT", "created_at": iso(created), "status": "ACTIVE"}
        run = {"study_run_id": run_id, "participant_id": participant_id, "current_phase": "POST" if complete else "TRAINING", "state": "COMPLETED" if complete else "TRAINING_IN_PROGRESS", "pre_completed": True, "training_completed_count": RNG.randint(1, 3), "post_completed": complete, "pre_score": pre, "post_score": post if complete else None, "created_at": iso(created), "updated_at": iso(created + timedelta(minutes=RNG.randint(15, 80)))}
        session = {"session_id": session_id, "participant_id": participant_id, "study_run_id": run_id, "device_class": RNG.choice(["DESKTOP", "TABLET", "MOBILE"]), "started_at": iso(created), "ended_at": iso(created + timedelta(minutes=RNG.randint(15, 80))) if complete else None, "expires_at": iso(created + timedelta(hours=6)), "state": "COMPLETED" if complete else "ACTIVE"}
        players.append(player); runs.append(run); sessions.append(session)
        assessments.append({"assessment_id": str(uuid.uuid4()), "study_run_id": run_id, "participant_id": participant_id, "phase": "PRE", "form_version": "SIM-2026.1", "raw_score": pre, "normalized_score": pre, "completion_time_ms": RNG.randint(90000, 280000), "validity_flags": ["SIMULATED_RECORD", "SIMULATED_TIME_WINDOW"], "created_at": iso(created + timedelta(minutes=5))})
        if complete:
            assessments.append({"assessment_id": str(uuid.uuid4()), "study_run_id": run_id, "participant_id": participant_id, "phase": "POST", "form_version": "SIM-2026.1", "raw_score": post, "normalized_score": post, "completion_time_ms": RNG.randint(90000, 280000), "validity_flags": ["SIMULATED_RECORD", "SIMULATED_TIME_WINDOW"], "created_at": iso(created + timedelta(minutes=45))})
        phases = [("PRE", pre), ("TRAINING", RNG.randint(45, 95))] + ([("POST", post)] if complete else [])
        for seq, (phase, score) in enumerate(phases, 1):
            scenario_id = SCENARIOS[(ordinal + seq) % len(SCENARIOS)]
            safe = score >= 65
            attempt_id = str(uuid.uuid4())
            attempt_time = created + timedelta(minutes=seq * 12)
            result = {"attempt_id": attempt_id, "participant_id": participant_id, "study_run_id": run_id, "session_id": session_id, "phase": phase, "scenario_id": scenario_id, "scenario_version": "SIM-2026.1", "selected_decision": "opt_safe" if safe else RNG.choice(["opt_rush", "opt_ignore"]), "outcome": "SAFE" if safe else "HAZARDOUS", "rule_score": score, "rule_engine_version": "SIMULATED_NOT_RESEARCH", "reaction_ms": RNG.randint(500, 4000), "flags": ["SIMULATED_RECORD", "SIMULATED_FUTURE_TIME"] if attempt_time > TODAY else ["SIMULATED_RECORD"], "created_at": iso(attempt_time)}
            scenario_results.append(result)
            event_rows = []
            for event_seq, event_type in enumerate(["SCENARIO_START", "HAZARD_VISIBLE", "BRAKE" if safe else "SIGNAL", "DECISION_INPUT", "SCENARIO_END"], 1):
                event_rows.append({"event_id": str(uuid.uuid4()), "session_id": session_id, "seq": event_seq, "timestamp": iso(attempt_time + timedelta(seconds=event_seq * 2)), "schema_version": "1", "type": event_type, "scenario_id": scenario_id, "payload": {"attempt_id": attempt_id, "phase": phase, "input_type": "SIMULATED"}})
            batch_id = str(uuid.uuid4()); jsonl = "\n".join(json.dumps(event, ensure_ascii=False, separators=(",", ":")) for event in event_rows)
            checksum = hashlib.sha256(jsonl.encode()).hexdigest()
            event_index.append({"batch_id": batch_id, "session_id": session_id, "event_count": len(event_rows), "first_seq": 1, "last_seq": len(event_rows), "drive_file_id": f"SIMULATED-{batch_id}", "checksum": checksum, "created_at": iso(attempt_time), "write_status": "COMMITTED", "storage_mode": "LOCAL_DEMO_MOCK"})
            drive_batches[batch_id] = {"jsonl": jsonl, "checksum": checksum, "created_at": iso(attempt_time)}
        system_logs.append({"log_id": str(uuid.uuid4()), "level": "INFO", "category": "SIMULATION", "message": "Synthetic local record generated; not a research observation.", "metadata": {"synthetic": True, "name_source": name_source, "future_simulated": created > TODAY}, "created_at": iso(created)})

    snapshot = {"storage_mode": "LOCAL_DEMO_MOCK", "demo_banner": "DỮ LIỆU GIẢ LẬP — không dùng làm kết quả nghiên cứu.", "Players": players, "StudyRuns": runs, "Sessions": sessions, "EventsIndex": event_index, "ScenarioResults": scenario_results, "Assessments": assessments, "AIAnalysis": [], "Scenarios": [], "SystemLogs": system_logs, "Settings": {"synthetic": True, "simulation_seed": SEED, "time_window": "2026-11-14/2026-12-14", "private_names_local_only": True}, "DriveEventBatches": drive_batches}
    manifest = {"synthetic": True, "simulation_seed": SEED, "generated_at": iso(datetime.now(TZ)), "source_file_local_only": "data hs.xls", "time_window": {"start": iso(START), "end": iso(END), "future_records_after": iso(TODAY)}, "players": len(players), "private_local_names": sum(1 for p in players if p["school_name"] == "Fschool Hậu Giang"), "never_upload_as_is": True}
    target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"players": len(players), "runs": len(runs), "attempts": len(scenario_results), "assessments": len(assessments), "output": str(target)}, ensure_ascii=True))

if __name__ == "__main__":
    main()
