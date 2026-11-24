'use client';

import { useEffect, useState } from 'react';

// Parse only to extract text; source elements/attributes are never inserted into the page.
function plainText(value: string) {
  const document = new DOMParser().parseFromString(value, 'text/html');
  document.querySelectorAll('script,style,iframe,object,template').forEach(node => node.remove());
  document.querySelectorAll('div,p,br,li').forEach(node => node.append(' '));
  return (document.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export default function ScenarioLibrary({ rows, query, grade }: { rows: string[][]; query: string; grade: string }) {
  const [articles, setArticles] = useState<Record<string, string>[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const [headers = [], ...body] = rows;
    setArticles(body.map(row => Object.fromEntries(headers.map((header, index) => [header.trim().toLowerCase(), plainText(row[index] || '')]))));
    setPage(1);
  }, [rows]);
  useEffect(() => setPage(1), [query, grade]);
  const filtered = articles.filter(article => (grade === 'Tất cả' || article.target_grade === grade) && Object.values(article).join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  const current = Math.min(page, pages);
  return <section className="scenario-library" aria-label="Thư viện bài viết tình huống">
    <header><h1>Những tình huống trên đường đến trường</h1><p>Đọc bối cảnh, nhận ra nguy cơ và suy nghĩ về quyết định của em. Đây là tình huống mô phỏng, không phải bản tin sự kiện thực tế.</p><p>{filtered.length} bài viết · Nội dung cần được rà soát chuyên môn trước khi sử dụng chính thức.</p></header>
    {!filtered.length && <p role="status">Không có bài viết phù hợp với bộ lọc hiện tại.</p>}
    <div className="scenario-article-grid">{filtered.slice((current - 1) * 9, current * 9).map((article, index) => {
      const title = article.title_vi || article.scenario_title || 'Tình huống giao thông';
      const prompt = article.prompt_vi || article.scenario_setup || '';
      const hazard = article.hazard_cue_vi || article.pedagogical_risk || '';
      return <article className="scenario-article" key={article.scenario_id || `${title}-${index}`}>
        <div className="scenario-article-meta"><span>{article.skill_group || 'Kỹ năng giao thông'}</span><span>{article.target_grade || 'Học sinh'}</span></div>
        <h2>{title}</h2>
        <p className="scenario-article-intro">{prompt || 'Bài viết chưa có phần mô tả bối cảnh.'}</p>
        <details><summary>Đọc tình huống và suy ngẫm</summary>
          <section><h3>Điều cần chú ý</h3><p>{hazard || 'Chưa có mô tả nguy cơ riêng cho tình huống này.'}</p></section>
          <section><h3>Nếu là em, em sẽ làm gì?</h3><p>Em nhìn thấy dấu hiệu nào? Ai có thể bị ảnh hưởng bởi quyết định của em? Hãy giải thích lựa chọn của mình trước khi trao đổi với giáo viên.</p></section>
          {article.learning_objective && <section><h3>Mục tiêu bài học</h3><p>{article.learning_objective}</p></section>}
          <p className="scenario-review-note">Bản nháp dùng để thảo luận. Phương án xử lý và căn cứ pháp lý cần được duyệt; định dạng bài viết không thay thế việc thẩm định nội dung.</p>
          <details><summary>Thông tin kỹ thuật</summary><dl>{['scenario_id', 'version', 'trigger_event', 'phase_eligibility'].filter(key => article[key]).map(key => <div key={key}><dt>{key}</dt><dd>{article[key]}</dd></div>)}</dl></details>
        </details>
      </article>;
    })}</div>
    <nav className="pagination-bar" aria-label="Phân trang bài viết"><button disabled={current <= 1} onClick={() => setPage(current - 1)}>Trang trước</button><span>Trang {current} / {pages}</span><button disabled={current >= pages} onClick={() => setPage(current + 1)}>Trang sau</button></nav>
  </section>;
}
