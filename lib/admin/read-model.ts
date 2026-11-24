import type { LogicalSheetsSnapshot } from '../google/storage.ts';
import { CANONICAL_SCENARIOS } from '../rules/engine.ts';
import type { AIAnalysisRecord, AssessmentRecord, StudyRunState } from '../types.ts';

export interface StudentCard {
  participant_id: string;
  full_name: string;
  class_name: string;
  school_name: string;
  province_city: string;
  session_count: number;
  completed_runs: number;
  attempt_count: number;
}

export interface ResearchCard {
  study_run_id: string;
  participant_id: string;
  full_name: string;
  class_name: string;
  school_name: string;
  pre_score: number | null;
  post_score: number | null;
  delta: number | null;
  state: StudyRunState;
  created_at: string;
}

export interface AICard extends AIAnalysisRecord {
  scenario_title: string;
}

export interface AdminReadModel {
  students: StudentCard[];
  research: ResearchCard[];
  ai: AICard[];
  totals: { students: number; sessions: number; attempts: number; paired_runs: number; ai_logs: number };
  metrics: {
    paired_pre_average: number | null;
    paired_post_average: number | null;
    skills: Array<{ label: string; pre_percent: number; post_percent: number; improvement: number }>;
  };
}

const pairKey = (run: string, participant: string) => JSON.stringify([run, participant]);
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// Timestamp, then stable ID, then score break ties independently of snapshot row order.
function compareAssessments(a: AssessmentRecord, b: AssessmentRecord): number {
  const aTime = Date.parse(a.created_at);
  const bTime = Date.parse(b.created_at);
  const timeOrder = (Number.isFinite(aTime) ? aTime : -Infinity) - (Number.isFinite(bTime) ? bTime : -Infinity);
  return (Number.isNaN(timeOrder) ? 0 : timeOrder)
    || compareText(a.assessment_id, b.assessment_id)
    || compareText(String(a.normalized_score), String(b.normalized_score));
}

/** Pure admin projection: no storage reads, writes, identity decoding or run-score fallback. */
export function buildAdminReadModel(snapshot: LogicalSheetsSnapshot): AdminReadModel {
  const players = new Map(snapshot.Players.map(player => [player.participant_id, player]));
  const sessionCounts = new Map<string, number>();
  const attemptCounts = new Map<string, number>();
  const completedCounts = new Map<string, number>();
  const increment = (counts: Map<string, number>, id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const session of snapshot.Sessions) increment(sessionCounts, session.participant_id);
  for (const attempt of snapshot.ScenarioResults) increment(attemptCounts, attempt.participant_id);
  for (const run of snapshot.StudyRuns) {
    if (run.state === 'COMPLETED') increment(completedCounts, run.participant_id);
  }

  const assessments = new Map<string, Partial<Record<'PRE' | 'POST', AssessmentRecord>>>();
  for (const assessment of snapshot.Assessments) {
    const key = pairKey(assessment.study_run_id, assessment.participant_id);
    const phases = assessments.get(key) ?? {};
    const previous = phases[assessment.phase];
    if (!previous || compareAssessments(assessment, previous) > 0) phases[assessment.phase] = assessment;
    assessments.set(key, phases);
  }
  const score = (assessment: AssessmentRecord | undefined): number | null =>
    assessment && Number.isFinite(assessment.normalized_score) ? assessment.normalized_score : null;

  const students: StudentCard[] = snapshot.Players.map(player => ({
    participant_id: player.participant_id,
    full_name: player.full_name,
    class_name: player.class_name,
    school_name: player.school_name,
    province_city: player.province_city,
    session_count: sessionCounts.get(player.participant_id) ?? 0,
    completed_runs: completedCounts.get(player.participant_id) ?? 0,
    attempt_count: attemptCounts.get(player.participant_id) ?? 0,
  }));
  const research: ResearchCard[] = snapshot.StudyRuns.map(run => {
    const player = players.get(run.participant_id);
    const phases = assessments.get(pairKey(run.study_run_id, run.participant_id));
    const pre = score(phases?.PRE);
    const post = score(phases?.POST);
    return {
      study_run_id: run.study_run_id,
      participant_id: run.participant_id,
      full_name: player?.full_name ?? '',
      class_name: player?.class_name ?? '',
      school_name: player?.school_name ?? '',
      pre_score: pre,
      post_score: post,
      delta: pre !== null && post !== null ? post - pre : null,
      state: run.state,
      created_at: run.created_at,
    };
  });
  const paired = research.filter(row => row.pre_score !== null && row.post_score !== null);
  const scenarios = new Map(CANONICAL_SCENARIOS.map(scenario => [scenario.scenario_id, scenario]));
  const skillScores = new Map<string, { preSum: number; preCount: number; postSum: number; postCount: number }>();
  for (const attempt of snapshot.ScenarioResults) {
    const scenario = scenarios.get(attempt.scenario_id);
    if (!scenario || !Number.isFinite(attempt.rule_score) || !['PRE', 'POST'].includes(attempt.phase)) continue;
    const label = scenario.skill_group || scenario.rubric.error_group;
    const aggregate = skillScores.get(label) ?? { preSum: 0, preCount: 0, postSum: 0, postCount: 0 };
    const value = Math.max(0, Math.min(100, attempt.rule_score));
    if (attempt.phase === 'PRE') { aggregate.preSum += value; aggregate.preCount += 1; }
    if (attempt.phase === 'POST') { aggregate.postSum += value; aggregate.postCount += 1; }
    skillScores.set(label, aggregate);
  }
  return {
    students,
    research,
    ai: snapshot.AIAnalysis.map(analysis => ({
      ...analysis,
      scenario_title: scenarios.get(analysis.scenario_id)?.title_vi ?? analysis.scenario_id,
    })),
    totals: {
      students: students.length,
      sessions: snapshot.Sessions.length,
      attempts: snapshot.ScenarioResults.length,
      paired_runs: paired.length,
      ai_logs: snapshot.AIAnalysis.length,
    },
    metrics: {
      paired_pre_average: paired.length ? paired.reduce((sum, row) => sum + row.pre_score!, 0) / paired.length : null,
      paired_post_average: paired.length ? paired.reduce((sum, row) => sum + row.post_score!, 0) / paired.length : null,
      // PRE/POST attempt-weighted means make the learning effect visible per safety group.
      skills: [...skillScores].sort(([a], [b]) => compareText(a, b))
        .map(([label, aggregate]) => {
          const pre = aggregate.preCount ? aggregate.preSum / aggregate.preCount : 0;
          const post = aggregate.postCount ? aggregate.postSum / aggregate.postCount : 0;
          return { label, pre_percent: pre, post_percent: post, improvement: post - pre };
        }),
    },
  };
}
