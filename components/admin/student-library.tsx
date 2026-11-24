'use client';

import { useEffect, useId, useState } from 'react';
import type { StudentCard } from '../../lib/admin/read-model';

const PAGE_SIZE = 9;

// StudentCard has no grade field. Infer only from a recognizable class prefix;
// never guess from the school name (a school can serve several levels).
function gradeFor(className: string): string {
  const match = className.trim().match(/^(?:lớp\s*|lop\s*)?(1[0-2]|[6-9])(?=$|[^0-9])/iu);
  if (!match) return '';
  return Number(match[1]) >= 10 ? 'THPT' : 'THCS';
}

function optionsFor(values: string[]): string[] {
  return [...new Set(values.filter(value => value.trim()))]
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}

export default function StudentLibrary({ students }: { students: StudentCard[] }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [page, setPage] = useState(1);
  const schools = optionsFor(students.map(student => student.school_name));
  const grades = optionsFor(students.map(student => gradeFor(student.class_name)));
  const classes = optionsFor(students.map(student => student.class_name));
  const normalizedQuery = query.trim().toLocaleLowerCase('vi');
  const filtered = students.filter(student =>
    (!school || student.school_name === school)
    && (!grade || gradeFor(student.class_name) === grade)
    && (!className || student.class_name === className)
    && [student.full_name, student.school_name, student.class_name, student.participant_id]
      .join(' ').toLocaleLowerCase('vi').includes(normalizedQuery));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function resetFilters() {
    setQuery('');
    setSchool('');
    setGrade('');
    setClassName('');
    setPage(1);
  }

  return <section className="scenario-library" aria-label="Thư viện học sinh">
    <header>
      <h1>Thư viện học sinh</h1>
      <p>Tra cứu học sinh và số lượt tham gia đã được ghi nhận.</p>
    </header>
    <div role="search" aria-label="Tìm và lọc học sinh">
      <label htmlFor={`${id}-search`}>Tìm học sinh</label>
      <input id={`${id}-search`} type="search" value={query}
        placeholder="Họ tên, trường, lớp hoặc mã tham gia"
        onChange={event => { setQuery(event.target.value); setPage(1); }} />
      <label htmlFor={`${id}-school`}>Trường</label>
      <select id={`${id}-school`} value={school}
        onChange={event => { setSchool(event.target.value); setPage(1); }}>
        <option value="">Tất cả trường</option>
        {schools.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <label htmlFor={`${id}-grade`}>Cấp học</label>
      <select id={`${id}-grade`} value={grade}
        onChange={event => { setGrade(event.target.value); setPage(1); }}>
        <option value="">Tất cả cấp học</option>
        {grades.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <label htmlFor={`${id}-class`}>Lớp</label>
      <select id={`${id}-class`} value={className}
        onChange={event => { setClassName(event.target.value); setPage(1); }}>
        <option value="">Tất cả lớp</option>
        {classes.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <button type="button" onClick={resetFilters}>Xóa bộ lọc</button>
    </div>
    <p role="status">{filtered.length} / {students.length} học sinh · Trang {current} / {pages}</p>
    {!filtered.length && <p>{students.length
      ? 'Không có học sinh phù hợp với bộ lọc hiện tại.'
      : 'Chưa có dữ liệu học sinh.'}</p>}
    <div className="scenario-article-grid">
      {filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(student => <article className="scenario-article" key={student.participant_id}>
        <div className="scenario-article-meta">
          <span>{student.class_name.trim() ? student.class_name : 'Chưa có lớp'}</span>
          <span>{gradeFor(student.class_name) || 'Chưa xác định cấp học'}</span>
        </div>
        <h2>{student.full_name.trim() ? student.full_name : 'Chưa có họ tên'}</h2>
        <p className="scenario-article-intro">{student.school_name.trim() ? student.school_name : 'Chưa có trường'}</p>
        <dl>
          <div><dt>Phiên tham gia</dt><dd>{student.session_count}</dd></div>
          <div><dt>Lượt xử lý tình huống</dt><dd>{student.attempt_count}</dd></div>
          <div><dt>Lượt nghiên cứu hoàn tất</dt><dd>{student.completed_runs}</dd></div>
        </dl>
      </article>)}
    </div>
    <nav className="pagination-bar" aria-label="Phân trang học sinh">
      <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Trang trước</button>
      <span>Trang {current} / {pages}</span>
      <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Trang sau</button>
    </nav>
  </section>;
}
