import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('data/research/synthetic-study-2026/logical_store.json');
const target = resolve(process.argv[2] || '.runtime/public-dataset/logical_store.json');
if (!existsSync(source)) throw new Error('Public synthetic dataset is missing.');

const snapshot = JSON.parse(readFileSync(source, 'utf8'));
if (snapshot?.Settings?.synthetic !== true || snapshot?.Settings?.public_dataset !== true) {
  throw new Error('Refusing to prepare an unverified dataset.');
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Prepared ${target}`);
