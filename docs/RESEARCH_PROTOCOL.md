# Quy trình nghiên cứu

## Mục đích và giới hạn
Đánh giá thay đổi liên quan đến trải nghiệm học tập SafeRide trong cùng `study_run_id`. Đây không tự động là thiết kế nhân quả; không tuyên bố hiệu quả, tuân thủ pháp luật hay tác động hành vi ngoài đời nếu chưa có thiết kế/mẫu/phê duyệt phù hợp.

## Đối tượng và đồng ý
Đối tượng dự kiến THCS/THPT. Thu thập tối thiểu 4 trường phục vụ vận hành/nghiên cứu. Chủ dự án, nhà trường và pháp chế phải xác định yêu cầu thông báo/đồng ý của phụ huynh/đại diện hợp pháp trước dữ liệu thật; checkbox học sinh không thay thế cơ chế cần thiết.

## Luồng và ghép cặp
1. Tạo participant/session/study run bằng UUID server-side.
2. Pre-test form version A/B theo seed/audit allocation; không lộ rubric.
3. Training tình huống tương tác đã version hóa.
4. Post-test form tương đương nhưng khác item/variant; lưu result và validity flags.
5. Ghép Pre/Post **duy nhất** bằng `study_run_id`; hai học sinh cùng tên/lớp/trường vẫn là hai record.

## Chất lượng dữ liệu
Gắn cờ (không tự xóa) lượt thiếu đáp án, thời gian bất thường, seq không hợp lệ, replay, nhiều phiên dở dang. Báo cáo N enrolled/completed/paired/valid, missingness, lý do loại trừ, form/content/policy versions. Bảo toàn raw + derived rõ ràng.

## Phân tích dự kiến
Mô tả phân bố, median/mean theo kế hoạch, paired change trên record hợp lệ, completion và missingness. Báo cáo khoảng tin cậy/phương pháp sau khi nhà nghiên cứu xác nhận. Không suy diễn nhân quả nếu không có đối chứng/ngẫu nhiên hóa/thiết kế được phê duyệt.

## Quản trị
Đóng băng protocol/version trước đợt thu dữ liệu; mọi thay đổi form/rubric/content ghi Settings/audit. Không dùng dashboard demo để báo cáo nghiên cứu thật.
