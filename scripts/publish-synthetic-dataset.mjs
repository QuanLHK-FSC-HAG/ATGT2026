import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve(process.argv[2] || '.runtime/schools-1000-final-20261123/logical_store.json');
const target = resolve('data/research/synthetic-study-2026/logical_store.json');
const raw = readFileSync(source, 'utf8');
const snapshot = JSON.parse(raw);

if (snapshot?.Settings?.synthetic !== true || snapshot?.Settings?.research_evidence !== false) {
  throw new Error('Dataset must be explicitly synthetic and marked as non-research evidence.');
}

const expected = {
  Players: 1017,
  StudyRuns: 1017,
  Sessions: 1017,
  EventsIndex: 3051,
  ScenarioResults: 3051,
  Assessments: 2034,
  AIAnalysis: 3051,
  Scenarios: 163,
};

for (const [table, count] of Object.entries(expected)) {
  if (!Array.isArray(snapshot[table]) || snapshot[table].length !== count) {
    throw new Error(`${table} must contain exactly ${count} records.`);
  }
}

snapshot.Settings = {
  ...snapshot.Settings,
  simulation_run_id: 'synthetic-study-2026-public-v1',
  school_source: 'Tên trường tham khảo từ nguồn công khai; toàn bộ hồ sơ học sinh và hoạt động là dữ liệu tổng hợp.',
  school_disclaimer: 'Bộ dữ liệu giả lập phục vụ nghiên cứu và trình diễn phần mềm. Tên học sinh, kết quả, thời gian và lượt xử lý đều là dữ liệu tổng hợp; không xác nhận cá nhân hoặc trường học tham gia thực tế.',
  fpt_roster_sample: '103 hồ sơ tổng hợp; phân bố giả lập theo 70-80% sĩ số lớp.',
  public_dataset: true,
};

const output = `${JSON.stringify(snapshot, null, 2)}\n`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, output, 'utf8');
const checksum = createHash('sha256').update(output).digest('hex');
writeFileSync(resolve(dirname(target), 'SHA256SUMS'), `${checksum}  logical_store.json\n`, 'utf8');
console.log(`Published ${target}`);
console.log(`SHA-256 ${checksum}`);
