import { CANONICAL_PROVINCES } from '../lib/data/provinces.ts';
import type { Phase, Scenario } from './types';

// Danh sách 34 Đơn vị Hành chính Tỉnh / Thành phố mới nhất Việt Nam
export const DEMO_PROVINCES = [...CANONICAL_PROVINCES];

export const FALLBACK: Record<Phase, Scenario[]> = {
  PRE: [{
    scenario_id: 'SR-PRE-01',
    version: '2026.1',
    title_vi: 'Cổng trường giờ tan học đông đúc',
    prompt_vi: 'Một bạn học sinh đang bước xuống vạch qua đường phía trước cổng trường.',
    hazard_cue_vi: 'Cửa ô tô phụ huynh vừa hé mở bên phải và xe đạp đi cùng chiều.',
    options: [
      { id: 'stop_yield', label_vi: 'Giảm tốc độ, quan sát kỹ và dừng lại trước vạch để nhường đường cho người đi bộ' },
      { id: 'pass_fast', label_vi: 'Tăng tốc lách qua khe hẹp trước khi bạn kịp bước tiếp' },
      { id: 'horn_only', label_vi: 'Bấm còi liên tục nhưng vẫn giữ nguyên tốc độ di chuyển' }
    ]
  }],
  TRAINING: [{
    scenario_id: 'SR-TRN-01',
    version: '2026.1',
    title_vi: 'Điểm mù xe buýt học đường và báo hiệu chuyển hướng',
    prompt_vi: 'Em cần qua giao lộ gần trường khi có xe buýt lớn đang dừng đón trả học sinh.',
    hazard_cue_vi: 'Vùng điểm mù khuất tầm nhìn phía đầu xe buýt có người đi bộ chuẩn bị bước sang đường.',
    options: [
      { id: 'signal_wait', label_vi: 'Giữ khoảng cách an toàn, bật đèn tín hiệu xi-nhan sớm, chỉ di chuyển khi tầm nhìn thông thoáng' },
      { id: 'cut_front', label_vi: 'Cắt ngang sát đầu xe buýt để sang đường thật nhanh' },
      { id: 'ride_side', label_vi: 'Đi song song bám sát vào vùng khuất bên sườn xe' }
    ]
  }],
  POST: [{
    scenario_id: 'SR-POST-01',
    version: '2026.1',
    title_vi: 'Qua vạch đi bộ khi thời tiết mưa ướt trơn trượt',
    prompt_vi: 'Đèn vàng nhấp nháy, mặt đường trơn và có nhóm học sinh đang chờ sang đường.',
    hazard_cue_vi: 'Quãng đường phanh trơn trượt dài hơn bình thường và tầm nhìn bị hạn chế.',
    options: [
      { id: 'early_brake', label_vi: 'Chủ động phanh sớm, giảm tốc độ đều tay, dừng trước vạch trắng và nhường đường' },
      { id: 'late_brake', label_vi: 'Giữ tốc độ nhanh rồi phanh gấp ngay trên vạch kẻ đường' },
      { id: 'weave', label_vi: 'Đánh lái lượn vòng sang làn đối diện để vượt qua người đi bộ' }
    ]
  }]
};