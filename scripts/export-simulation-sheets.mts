import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';

const snapshot = JSON.parse(readFileSync('.runtime/simulation/logical_store.json', 'utf8')) as LogicalSheetsSnapshot;
if (snapshot.Settings.synthetic !== true) throw new Error('Refusing to export non-simulation data');
const out = resolve('.runtime/simulation/google-sheets-anonymous.json');
mkdirSync(resolve('.runtime/simulation'), { recursive: true });
const anonymous = snapshot.Players.map((player, index) => ({
  participant_ref: `SIM-${String(index + 1).padStart(4, '0')}`,
  school_name: player.school_name,
  class_name: player.class_name,
  province_city: player.province_city,
  created_at: player.created_at,
  synthetic: true,
}));
const ref = new Map(snapshot.Players.map((player, index) => [player.participant_id, `SIM-${String(index + 1).padStart(4, '0')}`]));
const omitName = <T extends Record<string, unknown>>(row: T) => ({ ...row, participant_id: ref.get(String(row.participant_id)) || 'SIM-UNKNOWN', synthetic: true });
const payload = {
  manifest: {
    synthetic: true,
    data_label: 'DỮ LIỆU GIẢ LẬP — KHÔNG PHẢI KẾT QUẢ NGHIÊN CỨU',
    time_window: snapshot.Settings.time_window,
    generated_at: new Date().toISOString(),
    upload_requires: 'SIMULATION_UPLOAD_CONFIRM=true',
    privacy: 'No student names or private roster data are included.',
  },
  sheets: {
    SIM_Players: anonymous,
    SIM_StudyRuns: snapshot.StudyRuns.map(omitName),
    SIM_Sessions: snapshot.Sessions.map(omitName),
    SIM_Assessments: snapshot.Assessments.map(omitName),
    SIM_ScenarioResults: snapshot.ScenarioResults.map(omitName),
    SIM_EventsIndex: snapshot.EventsIndex.map(row => ({ ...row, synthetic: true })),
    SIM_SystemLogs: snapshot.SystemLogs.map(row => ({ ...row, synthetic: true })),
  },
};
writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ output: out, tabs: Object.keys(payload.sheets), players: anonymous.length, contains_names: false }));
