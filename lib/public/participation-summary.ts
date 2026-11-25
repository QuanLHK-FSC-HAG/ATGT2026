import type { PlayerRecord } from '../types.ts';

export type GradeParticipation = { grade: string; count: number };

function gradeFromClassName(className: string): string {
  const match = className.trim().match(/^(\d{1,2})/);
  const grade = match ? Number(match[1]) : NaN;
  return grade >= 1 && grade <= 12 ? String(grade) : 'Khác';
}

export function summarizePlayers(players: Array<Pick<PlayerRecord, 'participant_id' | 'class_name'>>) {
  const unique = new Map(players.map(player => [player.participant_id, player]));
  const counts = new Map<string, number>();
  for (const player of unique.values()) {
    const grade = gradeFromClassName(player.class_name);
    counts.set(grade, (counts.get(grade) || 0) + 1);
  }
  const by_grade: GradeParticipation[] = [...counts.entries()]
    .sort(([left], [right]) => left === 'Khác' ? 1 : right === 'Khác' ? -1 : Number(left) - Number(right))
    .map(([grade, count]) => ({ grade, count }));
  return { total: unique.size, by_grade };
}

export function playersFromLiveSheet(rows: string[][]): Array<Pick<PlayerRecord, 'participant_id' | 'class_name'>> {
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => value.trim());
  const participantIndex = headers.indexOf('participant_id');
  const classIndex = headers.indexOf('class_name');
  if (participantIndex < 0 || classIndex < 0) return [];
  return rows.slice(1)
    .filter(row => row[participantIndex]?.trim())
    .map(row => ({ participant_id: row[participantIndex].trim(), class_name: row[classIndex]?.trim() || '' }));
}
