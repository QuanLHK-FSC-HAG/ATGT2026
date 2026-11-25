'use client';

import { useEffect, useState } from 'react';

type Summary = { total: number; by_grade: Array<{ grade: string; count: number }>; updated_at: string };

export default function ParticipationDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/public/participation-summary', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as Summary;
        if (active) setSummary(data);
      } catch {
        // Keep the homepage usable if the live aggregate is temporarily unavailable.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!summary) return <section className="participation-board" aria-label="Thống kê học sinh"><span className="participation-loading">Đang tải số liệu tham gia…</span></section>;
  const max = Math.max(1, ...summary.by_grade.map(item => item.count));

  return (
    <section className="participation-board" aria-labelledby="participation-title">
      <div className="participation-summary">
        <span className="participation-kicker">DỮ LIỆU THAM GIA TRỰC TUYẾN</span>
        <strong id="participation-title">{summary.total.toLocaleString('vi-VN')}</strong>
        <span>học sinh đã tham gia</span>
      </div>
      <div className="grade-chart" aria-label="Phân bố học sinh theo khối lớp">
        {summary.by_grade.map(item => (
          <div className="grade-column" key={item.grade} title={`Khối ${item.grade}: ${item.count} học sinh`}>
            <span className="grade-value">{item.count}</span>
            <div className="grade-track"><span style={{ height: `${Math.max(8, item.count / max * 100)}%` }} /></div>
            <strong>{item.grade === 'Khác' ? 'Khác' : `Khối ${item.grade}`}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
