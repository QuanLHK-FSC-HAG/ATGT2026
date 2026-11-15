# Schema dữ liệu và log

## Quy ước chung
UUID ngẫu nhiên cho `participant_id`, `session_id`, `study_run_id`, `attempt_id`, `batch_id`. Timestamp server UTC ISO-8601; client timestamp chỉ dùng ngữ cảnh. Chuỗi đưa vào Sheets phải neutralize formula prefix `= + - @`. PII tối thiểu chỉ nằm ở Players, không truyền Gemini.

## 9 bảng logic Google Sheets
| Bảng | Khóa/chỉ mục | Trường cốt lõi |
|---|---|---|
| Players | participant_id | full_name, class_name, school_name, province_city, created_at, privacy_notice_version, status |
| Sessions | session_id | participant_id, study_run_id, device_class, started_at, ended_at, state |
| EventsIndex | batch_id | session_id, event_count, first_seq, last_seq, drive_file_id, checksum, created_at, write_status |
| ScenarioResults | attempt_id | participant_id, study_run_id, scenario_id, scenario_version, outcome, rule_score, reaction_ms, flags |
| Assessments | study_run_id+phase | phase PRE/POST, form_version, raw_score, normalized_score, completion_time, validity_flags |
| AIAnalysis | analysis_id | pseudonymous_ref, model_version, prompt_version, summary, status, created_at |
| Scenarios | scenario_id+version | metadata, review_status, legal reference/effective date, release status |
| SystemLogs | log_id | timestamp, level, operation, pseudonymous refs, error code (không secret/PII không cần thiết) |
| Settings | setting_key | schema_version, policy_version, content_version, thresholds, release_flags |

## Event JSONL trên Drive
Mỗi file là immutable partition theo ngày/phiên, ví dụ `events/YYYY-MM-DD/<batch_id>.jsonl`. Header/manifest ghi schema version, `batch_id`, `session_id`, first/last seq, count, SHA-256 và server timestamp. Mỗi dòng event có `event_id`, `seq`, type, sanitized payload, client/server time. Không ghi từng frame game.

## Hợp đồng dữ liệu
- `full_name`: 2–100 ký tự sau chuẩn hóa khoảng trắng; `school_name`: 2–160; không HTML/script.
- `province_city`: ID từ danh mục đang hiệu lực, có catalog version/date; không hardcode danh sách cũ.
- Attempt submit nhận decision/event có kiểm chứng; **không** nhận điểm client là nguồn sự thật.
- Assessment ghép theo `study_run_id`; không ghép theo 4 trường/họ tên.

## Retention/correction/deletion
Chi tiết tại `DATA_RETENTION.md`. Khi xóa, tombstone/xóa PII ở Players, hạn chế liên kết ở index/export, thực hiện backup expiry theo chính sách đã được duyệt; phải lưu audit tối thiểu không chứa PII dư thừa.
