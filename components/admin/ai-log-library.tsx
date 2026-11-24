'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AICard } from '../../lib/admin/read-model';

const PAGE_SIZE = 9;

function readableText(value: string): string {
  return value
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#(?:39|x27);/giu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}

export default function AILogLibrary({ ai }: { ai: AICard[] }) {
  const [query, setQuery] = useState('');
  const [scenario, setScenario] = useState('Tất cả');
  const [page, setPage] = useState(1);
  const scenarios = useMemo(() => ['Tất cả', ...new Set(ai.map(item => item.scenario_title).filter(Boolean))], [ai]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi');
    return ai.filter(item => {
      const haystack = [item.scenario_title, item.error_explanation, item.safety_principle, item.suggested_practice]
        .map(readableText).join(' ').toLocaleLowerCase('vi');
      return (!needle || haystack.includes(needle)) && (scenario === 'Tất cả' || item.scenario_title === scenario);
    });
  }, [ai, query, scenario]);
  useEffect(() => setPage(1), [query, scenario, ai]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const reset = () => { setQuery(''); setScenario('Tất cả'); setPage(1); };
  return <section className="scenario-library" aria-label="Thư viện nhật ký AI">
    <header><h1>Nhật ký AI sư phạm</h1><p>Phản hồi hướng dẫn theo từng tình huống.</p><p role="status">{filtered.length} / {ai.length} nhật ký · Trang {current} / {pages}</p></header>
    <div role="search" aria-label="Tìm và lọc nhật ký AI" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <label>Tìm nhật ký <input type="search" value={query} placeholder="Tình huống hoặc nội dung..." onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <label>Tình huống <select value={scenario} onChange={event => { setScenario(event.target.value); setPage(1); }}>{scenarios.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={reset}>Xóa bộ lọc</button>
    </div>
    {!filtered.length && <p role="status">{ai.length ? 'Không có nhật ký AI phù hợp với bộ lọc hiện tại.' : 'Chưa có nhật ký AI.'}</p>}
    <div className="scenario-article-grid">{filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(item => <article className="scenario-article" key={item.analysis_id}>
      <div className="scenario-article-meta"><span>{item.status === 'DETERMINISTIC_FALLBACK' ? 'Phản hồi tự động' : item.status}</span></div>
      <h2>{item.scenario_title}</h2>
      <p className="scenario-article-intro">{readableText(item.error_explanation)}</p>
      <details><summary>Đọc phản hồi sư phạm</summary><section><h3>Nguyên tắc an toàn</h3><p>{readableText(item.safety_principle)}</p></section><section><h3>Gợi ý luyện tập</h3><p>{readableText(item.suggested_practice)}</p></section><p className="scenario-review-note">Phản hồi phục vụ hướng dẫn học tập, không phải điểm chấm độc lập.</p></details>
    </article>)}</div>
    <nav className="pagination-bar" aria-label="Phân trang nhật ký AI"><button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Trang trước</button><span>Trang {current} / {pages}</span><button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Trang sau</button></nav>
  </section>;
}
