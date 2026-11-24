import assert from 'node:assert/strict';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  allocateSimulationSchools,
  FPT_HAU_GIANG_SCHOOL,
  gradeForSchool,
  LOCAL_SIMULATION_SCHOOLS,
  SIMULATION_SCHOOLS,
} from '../lib/data/simulation-schools.ts';
import type { LogicalSheetsSnapshot } from '../lib/google/storage.ts';

const { values } = parseArgs({ options: {
  snapshot: { type: 'string' },
  manifest: { type: 'string' },
}, strict: true, allowPositionals: false });
assert(values.snapshot && values.manifest, 'SNAPSHOT_AND_MANIFEST_REQUIRED');
const snapshotPath = resolve(values.snapshot);
const manifestPath = resolve(values.manifest);
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as LogicalSheetsSnapshot;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  synthetic: boolean; seed: string; schools: typeof SIMULATION_SCHOOLS;
  students: Array<{ participant_id: string; school: string; grade: string }>;
};
assert(snapshot.Settings.synthetic === true && manifest.synthetic === true, 'SYNTHETIC_DATA_REQUIRED');
assert(snapshot.Players.length === manifest.students.length, 'PLAYER_MANIFEST_COUNT_MISMATCH');

const localStudents = manifest.students.filter(student => student.school !== FPT_HAU_GIANG_SCHOOL);
const assignments = allocateSimulationSchools(localStudents.length, manifest.seed);
const withinSchool = new Map<string, number>();
const players = new Map(snapshot.Players.map(player => [player.participant_id, player]));
for (const player of snapshot.Players) player.province_city = 'TP Cần Thơ';
for (const [index, student] of localStudents.entries()) {
  const school = assignments[index];
  const ordinal = withinSchool.get(school.name) ?? 0;
  withinSchool.set(school.name, ordinal + 1);
  const grade = gradeForSchool(school, ordinal);
  const className = `${grade}A${1 + ordinal % 3}`;
  student.school = school.name;
  student.grade = className;
  const player = players.get(student.participant_id);
  assert(player, 'MANIFEST_PLAYER_NOT_FOUND');
  player.school_name = school.name;
  player.class_name = className;
}
assert(withinSchool.size === LOCAL_SIMULATION_SCHOOLS.length, 'ALL_LOCAL_SCHOOLS_REQUIRED');
manifest.schools = SIMULATION_SCHOOLS;

async function replaceWithBackup(path: string, value: unknown) {
  const backup = join(dirname(path), `${basename(path)}.before-school-redistribution-${Date.now()}.json`);
  await copyFile(path, backup, constants.COPYFILE_EXCL);
  const next = `${path}.redistributed.next`;
  await writeFile(next, JSON.stringify(value), { flag: 'wx' });
  await rename(next, path);
}

await replaceWithBackup(snapshotPath, snapshot);
await replaceWithBackup(manifestPath, manifest);
console.log(JSON.stringify({ students: manifest.students.length, schools: Object.fromEntries(withinSchool) }));
