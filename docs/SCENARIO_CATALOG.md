# Catalog và kiểm duyệt tình huống

## Ma trận nội dung
8 nhóm bắt buộc: (1) báo hiệu, (2) cổng trường, (3) người đi bộ/nhường đường, (4) giao lộ/vòng xuyến, (5) điểm mù, (6) khoảng cách/phanh, (7) thời tiết, (8) văn hóa và xe ưu tiên. Bloom: Nhận biết, Thông hiểu, Vận dụng. Phương tiện/NPC phải phản ánh bối cảnh học sinh: đi bộ, xe đạp/điện, xe gắn máy điện, <50cc, mô tô, ô tô phụ huynh, xe đưa đón, xe buýt, xe tải/container.

## Schema bắt buộc
`scenario_id, version, status, title, group, bloom_level, target_grades, vehicle, npc, environment, trigger, choices/actions, expected_rule, score_rubric, feedback, legal_reference, legal_effective_date, reviewer, review_status, difficulty, variant_family, assets, accessibility_text`.

## Cổng phát hành
- `DRAFT`: có thể chỉnh sửa, không dùng đánh giá chính thức.
- `NEEDS_LEGAL_REVIEW`: chưa đưa vào scoring chính thức khi trích dẫn pháp luật chưa xác minh.
- `PEDAGOGICAL_REVIEW`: chờ chuyên gia kiểm định mục tiêu/độ khó/feedback.
- `APPROVED`: chỉ khi reviewer thực tế và audit metadata đầy đủ.
- `PUBLISHED`/`RETIRED`: trạng thái release có thể truy vết.

## Yêu cầu 150+
Không chỉ đổi ID/tiêu đề. Validator kiểm tra unique id/version, schema, playable actions, rubric, accessibility, coverage group/Bloom/grade, variant equivalence. Các biến thể -A/-B/-C phải có mục tiêu đo lường tương đương. Cần đối chiếu nguồn luật/văn bản đang có hiệu lực tại ngày phát hành; ghi nguồn, điều khoản, ngày hiệu lực/ngày kiểm tra hoặc gắn `NEEDS_LEGAL_REVIEW`.
