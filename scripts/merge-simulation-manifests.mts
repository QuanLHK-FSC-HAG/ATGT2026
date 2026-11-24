import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  target: { type: 'string' }, extension: { type: 'string' },
}, strict: true, allowPositionals: false });
assert(values.target && values.extension, 'TARGET_AND_EXTENSION_REQUIRED');
const targetPath = resolve(values.target);
const extensionPath = resolve(values.extension);
const target = JSON.parse(await readFile(targetPath, 'utf8'));
const extension = JSON.parse(await readFile(extensionPath, 'utf8'));
assert(target.synthetic === true && extension.synthetic === true, 'SYNTHETIC_MANIFESTS_REQUIRED');
assert(target.status === 'COMPLETED' && extension.status === 'COMPLETED', 'COMPLETED_MANIFESTS_REQUIRED');
const existingNames = new Set(target.students.map((student: { name: string }) => student.name));
assert(extension.students.every((student: { name: string }) => !existingNames.has(student.name)), 'DUPLICATE_STUDENT_NAME');
target.students.push(...extension.students.map((student: Record<string, unknown>, index: number) => ({
  ...student, ordinal: target.students.length + index + 1,
})));
target.requested_students = target.students.length;
target.requests_started += extension.requests_started;
target.requests_acknowledged += extension.requests_acknowledged;
for (const key of Object.keys(target.counts)) target.counts[key] += extension.counts[key] ?? 0;
target.smoke = false;
target.ended_at = extension.ended_at;
const backup = join(dirname(targetPath), `${basename(targetPath)}.before-extension.json`);
await copyFile(targetPath, backup, constants.COPYFILE_EXCL);
const next = `${targetPath}.merged.next`;
await writeFile(next, JSON.stringify(target), { flag: 'wx' });
await rename(next, targetPath);
console.log(JSON.stringify({ students: target.students.length, attempts: target.counts.acknowledged_attempts }));
