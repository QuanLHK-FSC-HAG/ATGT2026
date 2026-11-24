'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ResearchCard } from '../../lib/admin/read-model';

function gradeFromClass(className: string): string | null {
  return className.trim().match(/^(?:lớp\s*|lop\s*)?(1[0-2]|[6-9])(?=$|[^0-9])/iu)?.[1] ?? null;
}

/**
 * ResearchLibrary component for viewing and filtering research data.
 * Adheres to constraints: 9 items/page, local state, semantic labels, plain text.
 */
export default function ResearchLibrary({ research }: { research: ResearchCard[] }) {
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('Tất cả');
  const [gradeFilter, setGradeFilter] = useState('Tất cả');
  const [classFilter, setClassFilter] = useState('Tất cả');
  const [completionFilter, setCompletionFilter] = useState('Tất cả');
  const [page, setPage] = useState(1);

  // Derive unique values for filters
  const schools = useMemo(() => ['Tất cả', ...new Set(research.map(r => r.school_name).filter(Boolean))], [research]);
  const classes = useMemo(() => ['Tất cả', ...new Set(research.map(r => r.class_name).filter(Boolean))], [research]);

  // Simple heuristic for grades from class names (e.g., "10A1" -> "10")
  const grades = useMemo(() => {
    const extracted = research.map(r => {
      return gradeFromClass(r.class_name);
    }).filter(Boolean) as string[];
    return ['Tất cả', ...new Set(extracted)].sort((a, b) => parseInt(a) - parseInt(b));
  }, [research]);

  const filtered = useMemo(() => {
    return research.filter(r => {
      const matchesSearch = !search ||
        r.full_name.toLowerCase().includes(search.toLowerCase()) ||
        r.participant_id.toLowerCase().includes(search.toLowerCase());

      const matchesSchool = schoolFilter === 'Tất cả' || r.school_name === schoolFilter;
      const matchesClass = classFilter === 'Tất cả' || r.class_name === classFilter;

      const grade = gradeFromClass(r.class_name);
      const matchesGrade = gradeFilter === 'Tất cả' || grade === gradeFilter;

      const isCompleted = r.state === 'COMPLETED';
      const matchesCompletion = completionFilter === 'Tất cả' ||
        (completionFilter === 'Hoàn thành' && isCompleted) ||
        (completionFilter === 'Chưa xong' && !isCompleted);

      return matchesSearch && matchesSchool && matchesClass && matchesGrade && matchesCompletion;
    });
  }, [research, search, schoolFilter, classFilter, gradeFilter, completionFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, schoolFilter, classFilter, gradeFilter, completionFilter]);

  const itemsPerPage = 9;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  const formatScore = (val: number | null) => val !== null ? `${val}đ` : '—';
  const formatDelta = (val: number | null) => {
    if (val === null) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val}đ`;
  };

  return (
    <section className="scenario-library" aria-label="Thư viện dữ liệu nghiên cứu">
      <header>
        <h1>Thư viện nghiên cứu</h1>
        <p>Theo dõi tiến độ và kết quả đánh giá năng lực của học sinh trước và sau khi học.</p>
        <p>{filtered.length} kết quả phù hợp.</p>
      </header>

      <div className="research-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="search-input" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Tìm kiếm học sinh</label>
          <input
            id="search-input"
            type="text"
            placeholder="Tên hoặc ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="school-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Trường</label>
          <select
            id="school-select"
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="grade-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Khối</label>
          <select
            id="grade-select"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            {grades.map(g => <option key={g} value={g}>{g === 'Tất cả' ? g : `Khối ${g}`}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="class-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Lớp</label>
          <select
            id="class-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="status-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Trạng thái</label>
          <select
            id="status-select"
            value={completionFilter}
            onChange={(e) => setCompletionFilter(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
          >
            <option value="Tất cả">Tất cả</option>
            <option value="Hoàn thành">Hoàn thành</option>
            <option value="Chưa xong">Chưa xong</option>
          </select>
        </div>
      </div>

      {!filtered.length && <p role="status" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Không tìm thấy dữ liệu nghiên cứu nào phù hợp.</p>}

      <div className="scenario-article-grid">
        {paginatedItems.map((item) => (
          <article className="scenario-article" key={item.study_run_id}>
            <div className="scenario-article-meta">
              <span>{item.class_name || 'N/A'}</span>
              <span>{item.school_name || 'N/A'}</span>
            </div>
            <h2>{item.full_name || 'Học sinh ẩn danh'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '1rem 0', textAlign: 'center' }}>
              <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Trước học</div>
                <div style={{ fontWeight: 600 }}>{formatScore(item.pre_score)}</div>
              </div>
              <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sau học</div>
                <div style={{ fontWeight: 600 }}>{formatScore(item.post_score)}</div>
              </div>
              <div style={{ padding: '0.5rem', background: item.delta !== null && item.delta >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mức tiến bộ</div>
                <div style={{ fontWeight: 600, color: item.delta !== null && item.delta >= 0 ? '#166534' : '#991b1b' }}>
                  {formatDelta(item.delta)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              <div><strong>Trạng thái:</strong> {item.state}</div>
              <div><strong>Ngày tạo:</strong> {new Date(item.created_at).toLocaleDateString('vi-VN')}</div>
            </div>

          </article>
        ))}
      </div>

      <nav className="pagination-bar" aria-label="Phân trang dữ liệu">
        <button
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Trang trước
        </button>
        <span>Trang {currentPage} / {totalPages}</span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setPage(currentPage + 1)}
        >
          Trang sau
        </button>
      </nav>
    </section>
  );
}
