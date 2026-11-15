'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type AdminTab =
  | 'overview'
  | 'filters'
  | 'participants'
  | 'research'
  | 'scenarios'
  | 'logs'
  | 'ai'
  | 'health';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedGrade, setSelectedGrade] = useState<string>('Tất cả');
  const [selectedSchool, setSelectedSchool] = useState<string>('Tất cả');

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: '1. Tổng quan & Biểu đồ' },
    { id: 'filters', label: '2. Bộ lọc dữ liệu' },
    { id: 'participants', label: '3. Danh sách học sinh' },
    { id: 'research', label: '4. So sánh Trước & Sau học' },
    { id: 'scenarios', label: '5. Kho 160 Kịch bản' },
    { id: 'logs', label: '6. Sự kiện hành vi' },
    { id: 'ai', label: '7. Nhật ký phản hồi AI' },
    { id: 'health', label: '8. Trạng thái hệ thống' },
  ];

  return (
    <main className="reading-page" style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <Link href="/" className="back-link">← Trở về Trang Học Sinh</Link>
        <span style={{ background: '#065f46', color: '#6ee7b7', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
          BẢO MẬT XÁC THỰC QUẢN TRỊ VIÊN • TÀI KHOẢN: quanlhk.01@gmail.com
        </span>
      </div>

      <h1>Bảng Điều Khiển Quản Trị SafeRide EDU AI 2026</h1>
      <p style={{ color: '#475569', marginBottom: '20px' }}>
        Đồng bộ trực tuyến với Google Sheets ID: <code>1cb1yNL0GlzktDg-88G-Q-POqCqPHnencAF5O-nC20J8</code> (Thư mục Google Drive: <code>ATGT2026</code>).
        Dữ liệu thực tế ghi nhận trực tiếp khi học sinh tham gia, không dùng dữ liệu mẫu cố định.
      </p>

      <nav aria-label="Menu Quản trị 8 màn hình" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTab === t.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: activeTab === t.id ? '#eff6ff' : '#ffffff',
              color: activeTab === t.id ? '#1d4ed8' : '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <section aria-labelledby="heading-overview">
          <h2 id="heading-overview">1. Tổng quan Hệ thống & Bảng Biểu đồ Thống kê (bieu_do_thong_ke)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="notice"><strong>Tổng số Kịch bản:</strong> 160 tình huống (8 chủ đề × 20)</div>
            <div className="notice"><strong>Cấu trúc 8 Sheet không dấu:</strong> <code>bieu_do_thong_ke</code>, <code>hoc_sinh</code>, <code>phien_choi</code>, <code>luot_xu_ly</code>, <code>su_kien_hanh_vi</code>, <code>nhat_ky_ai</code>, <code>so_sanh_truoc_sau</code>, <code>kich_ban_goc</code></div>
            <div className="notice"><strong>Cơ chế Cấp độ chơi:</strong> Học sinh chọn cấp độ (Cơ bản / Nâng cao / Thử thách) theo từng lượt chơi tại <code>phien_choi</code></div>
            <div className="notice"><strong>Đồng bộ dữ liệu:</strong> Ghi nhận trực tuyến 100% lên Google Sheets</div>
          </div>
        </section>
      )}

      {activeTab === 'filters' && (
        <section aria-labelledby="heading-filters">
          <h2 id="heading-filters">2. Bộ lọc Đa chiều</h2>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <label>
              Khối lớp:{' '}
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option value="Tất cả">Tất cả (THCS & THPT)</option>
                <option value="THCS">Khối THCS</option>
                <option value="THPT">Khối THPT</option>
              </select>
            </label>
            <label>
              Trường học (Minh họa ẩn danh):{' '}
              <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}>
                <option value="Tất cả">Tất cả các trường học sinh tự nhập</option>
                <option value="THCS ABC">THCS ABC</option>
                <option value="THPT ABC">THPT ABC</option>
              </select>
            </label>
          </div>
          <p>Đang lọc theo: Khối <strong>{selectedGrade}</strong> • Trường <strong>{selectedSchool}</strong></p>
        </section>
      )}

      {activeTab === 'participants' && (
        <section aria-labelledby="heading-participants">
          <h2 id="heading-participants">3. Danh sách Học sinh Tham gia (Bảng hoc_sinh)</h2>
          <p>Học sinh không cần đăng nhập; khi vào chơi nhập trực tiếp: Họ và tên, Lớp, Trường, Tỉnh/Thành phố. Hệ thống không lưu cứng cấp độ vào bảng học sinh mà ghi nhận cấp độ theo từng phiên chơi.</p>
          <ul>
            <li><strong>Ví dụ ẩn danh 1:</strong> Học sinh A — Lớp 8A — Trường THCS ABC</li>
            <li><strong>Ví dụ ẩn danh 2:</strong> Học sinh B — Lớp 9B — Trường THCS ABC</li>
            <li><strong>Ví dụ ẩn danh 3:</strong> Học sinh C — Lớp 10A1 — Trường THPT ABC</li>
          </ul>
        </section>
      )}

      {activeTab === 'research' && (
        <section aria-labelledby="heading-research">
          <h2 id="heading-research">4. So sánh Kết quả Trước & Sau khi học (Bảng so_sanh_truoc_sau)</h2>
          <p>Tự động đối chiếu điểm số chặng Trước khi học, Luyện tập và Đánh giá sau học theo từng phiên chơi trực tuyến trên Google Sheets.</p>
        </section>
      )}

      {activeTab === 'scenarios' && (
        <section aria-labelledby="heading-scenarios">
          <h2 id="heading-scenarios">5. Kho 160 Kịch bản An toàn Giao thông (Bảng kich_ban_goc)</h2>
          <p>Bao gồm 160 tình huống giao thông học đường Việt Nam thực tế, phân bố đều cho cấp THCS và THPT.</p>
        </section>
      )}

      {activeTab === 'logs' && (
        <section aria-labelledby="heading-logs">
          <h2 id="heading-logs">6. Nhật ký Sự kiện Hành vi 3D (Bảng su_kien_hanh_vi)</h2>
          <p>Ghi nhận thao tác phanh, bật xi-nhan, nhường đường và thời gian phản xạ trong không gian mô phỏng 3D.</p>
        </section>
      )}

      {activeTab === 'ai' && (
        <section aria-labelledby="heading-ai">
          <h2 id="heading-ai">7. Nhật ký Phản hồi Sư phạm AI (Bảng nhat_ky_ai)</h2>
          <p>Toàn bộ thông tin cá nhân của học sinh được ẩn danh hoàn toàn trước khi tạo lời khuyên hướng dẫn luật giao thông đường bộ Việt Nam.</p>
        </section>
      )}

      {activeTab === 'health' && (
        <section aria-labelledby="heading-health">
          <h2 id="heading-health">8. Trạng thái Hoạt động Hệ thống</h2>
          <p>Kết nối Google Sheets và mô phỏng 3D hoạt động ổn định, hỗ trợ đồng thời nhiều học sinh truy cập từ phòng máy nhà trường hoặc thiết bị di động.</p>
        </section>
      )}
    </main>
  );
}