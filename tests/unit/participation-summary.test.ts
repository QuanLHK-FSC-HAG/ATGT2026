import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { playersFromLiveSheet, summarizePlayers } from '../../lib/public/participation-summary.ts';

describe('public participation summary', () => {
  it('deduplicates participants and groups Vietnamese class names by grade', () => {
    assert.deepEqual(summarizePlayers([
      { participant_id: 'a', class_name: '6A' },
      { participant_id: 'a', class_name: '6A' },
      { participant_id: 'b', class_name: '10A1' },
      { participant_id: 'c', class_name: 'Không rõ' },
    ]), { total: 3, by_grade: [{ grade: '6', count: 1 }, { grade: '10', count: 1 }, { grade: 'Khác', count: 1 }] });
  });

  it('reads only participant id and class from live Google Sheet rows', () => {
    assert.deepEqual(playersFromLiveSheet([
      ['participant_id', 'study_run_id', 'full_name', 'class_name'],
      ['p1', 'r1', 'Tên không được trả ra API', '8B'],
    ]), [{ participant_id: 'p1', class_name: '8B' }]);
  });
});
