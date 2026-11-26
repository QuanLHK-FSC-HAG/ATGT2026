import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { distinctSchoolNames, schoolsFromLiveSheet } from '../../lib/public/school-suggestions.ts';

describe('public school suggestions', () => {
  it('trims, dedupes case-insensitively keeping the most frequent spelling, and sorts A–Z', () => {
    assert.deepEqual(distinctSchoolNames([
      { school_name: 'Trường THCS Lê Quý Đôn' },
      { school_name: 'trường thcs lê quý đôn' },
      { school_name: 'Trường THCS Lê Quý Đôn ' },
      { school_name: 'Trường THPT Vị Thanh' },
      { school_name: '  ' },
      { school_name: '' },
    ]), ['Trường THCS Lê Quý Đôn', 'Trường THPT Vị Thanh']);
  });

  it('keeps the first spelling on a count tie', () => {
    assert.deepEqual(distinctSchoolNames([
      { school_name: 'Trường thcs A' },
      { school_name: 'TRƯỜNG THCS A' },
    ]), ['Trường thcs A']);
  });

  it('reads only the school_name column from live Google Sheet rows', () => {
    assert.deepEqual(schoolsFromLiveSheet([
      ['participant_id', 'full_name', 'school_name'],
      ['p1', 'Tên không được trả ra API', 'Trường THCS Lê Quý Đôn'],
      ['p2', 'Tên khác', 'trường thcs lê quý đôn'],
    ]), ['Trường THCS Lê Quý Đôn']);
  });

  it('returns an empty list when the sheet has no school_name column', () => {
    assert.deepEqual(schoolsFromLiveSheet([
      ['participant_id', 'class_name'],
      ['p1', '6A'],
    ]), []);
  });
});
