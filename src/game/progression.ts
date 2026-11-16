import type { StageId } from './types';

export function isStageUnlocked(
    stage: number,
    completedStage: 0 | StageId,
): boolean {
    return stage >= 1 && stage <= 5 && stage <= completedStage + 1;
}
