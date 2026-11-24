export interface SimulationSchool {
  name: string;
  locality: string;
  allowedGrades: readonly number[];
  source: string;
  allocationWeight?: number;
  usesRealRoster?: boolean;
}

export const FPT_HAU_GIANG_SCHOOL = 'Trường Tiểu học, THCS và THPT FPT Hậu Giang';

// Except for the explicitly imported FPT roster, all attached participants are synthetic.
export const SIMULATION_SCHOOLS: readonly SimulationSchool[] = [
  { name: FPT_HAU_GIANG_SCHOOL, locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 10, 11], source: 'https://fschool.fpt.edu.vn/hau-giang/', usesRealRoster: true },
  { name: 'Trường THPT Vị Thanh', locality: 'TP Cần Thơ', allowedGrades: [10, 11, 12], source: 'https://thptvithanh.cantho.edu.vn/', allocationWeight: 178 },
  { name: 'Trường THCS và THPT Chiêm Thành Tấn', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9, 10, 11, 12], source: 'https://cantho.edu.vn/', allocationWeight: 174 },
  { name: 'Trường THPT Long Mỹ', locality: 'TP Cần Thơ', allowedGrades: [10, 11, 12], source: 'https://thptlongmy.cantho.edu.vn/', allocationWeight: 163 },
  { name: 'Trường THPT Vị Thủy', locality: 'TP Cần Thơ', allowedGrades: [10, 11, 12], source: 'https://thptvithuy.cantho.edu.vn/', allocationWeight: 159 },
  { name: 'Trường THCS Vị Thanh', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 30 },
  { name: 'Trường THCS Vị Thủy', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 29 },
  { name: 'Trường THCS Vị Thắng', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 28 },
  { name: 'Trường THCS Vị Đông', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 27 },
  { name: 'Trường THCS Hoàng Diệu', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 26 },
  { name: 'Trường THCS Lê Quý Đôn', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 24 },
  { name: 'Trường THCS Nguyễn Viết Xuân', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 22 },
  { name: 'Trường THCS Trương Tấn Lập', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 20 },
  { name: 'Trường THCS Nguyễn Thành Đô', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://cantho.edu.vn/', allocationWeight: 18 },
  { name: 'Trường THCS Long Mỹ', locality: 'TP Cần Thơ', allowedGrades: [6, 7, 8, 9], source: 'https://thcslongmy.cantho.edu.vn/', allocationWeight: 16 },
] as const;

export const LOCAL_SIMULATION_SCHOOLS = SIMULATION_SCHOOLS.filter(school => !school.usesRealRoster);

export const SIMULATION_SCHOOL_DISCLAIMER =
  'Dữ liệu kiểm thử chỉ chạy local. Mẫu FPT Hậu Giang dùng 70-80% sĩ số từng lớp từ danh sách người dùng cung cấp; các trường còn lại dùng hồ sơ tổng hợp. Không sử dụng làm bằng chứng nghiên cứu hoặc xác nhận trường tham gia.';

export function gradeForSchool(school: SimulationSchool, ordinal: number): number {
  return school.allowedGrades[ordinal % school.allowedGrades.length];
}

/** Deterministic weighted allocation for synthetic students across local schools. */
export function allocateSimulationSchools(total: number, _seed: string): SimulationSchool[] {
  const schools = LOCAL_SIMULATION_SCHOOLS;
  if (total <= schools.length) return Array.from({ length: total }, (_, index) => schools[index]);
  const weightTotal = schools.reduce((sum, school) => sum + (school.allocationWeight ?? 1), 0);
  const exact = schools.map(school => total * (school.allocationWeight ?? 1) / weightTotal);
  const counts = exact.map(value => Math.floor(value));
  for (let remaining = total - counts.reduce((sum, value) => sum + value, 0); remaining > 0; remaining -= 1) {
    let best = 0;
    for (let index = 1; index < schools.length; index += 1) {
      if (exact[index] - counts[index] > exact[best] - counts[best]) best = index;
    }
    counts[best] += 1;
  }
  return counts.flatMap((count, index) => Array.from({ length: count }, () => schools[index]));
}
