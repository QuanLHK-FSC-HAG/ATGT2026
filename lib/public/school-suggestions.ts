import type { PlayerRecord } from '../types.ts';

/**
 * Distinct school names from player records, for the entry-card suggestion list.
 * - Trims whitespace and drops empty names.
 * - Groups spellings case-insensitively (vi locale); keeps the spelling that
 *   appears most often (first-seen wins a tie), so one school is suggested
 *   exactly one way and later entries stay consistent with past entries.
 * - Sorts A–Z (vi locale), capped at 500 names. Only school names are
 *   returned — no student names or ids ever leave this function.
 */
export function distinctSchoolNames(players: Array<Pick<PlayerRecord, 'school_name'>>): string[] {
  const groups = new Map<string, { best: string; bestCount: number; counts: Map<string, number> }>();
  for (const player of players) {
    const name = player.school_name?.trim() ?? '';
    if (!name) continue;
    const key = name.toLocaleLowerCase('vi');
    let group = groups.get(key);
    if (!group) {
      group = { best: name, bestCount: 0, counts: new Map() };
      groups.set(key, group);
    }
    const count = (group.counts.get(name) ?? 0) + 1;
    group.counts.set(name, count);
    if (count > group.bestCount) {
      group.best = name;
      group.bestCount = count;
    }
  }
  return [...groups.values()]
    .map((group) => group.best)
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .slice(0, 500);
}

/** Reads only the school_name column from live Google Sheet rows. */
export function schoolsFromLiveSheet(rows: string[][]): string[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim());
  const schoolIndex = headers.indexOf('school_name');
  if (schoolIndex < 0) return [];
  return distinctSchoolNames(
    rows.slice(1).map((row) => ({ school_name: row[schoolIndex]?.trim() || '' })),
  );
}
