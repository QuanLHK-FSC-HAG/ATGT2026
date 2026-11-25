import type { ScenarioDefinition, ScenarioSceneType } from '../types.ts';

export const INTERACTIVE_PILOT_SCENE_TYPES = [
  'PEDESTRIAN_CROSSING',
  'INTERSECTION_SIGNAL',
  'LARGE_VEHICLE_BLIND_SPOT',
] as const satisfies readonly ScenarioSceneType[];

const pilotTypes = new Set<ScenarioSceneType>(INTERACTIVE_PILOT_SCENE_TYPES);

export function isInteractivePilotScenario(
  scenario: Pick<ScenarioDefinition, 'visual_spec'>,
): boolean {
  return pilotTypes.has(scenario.visual_spec.scene_type);
}
