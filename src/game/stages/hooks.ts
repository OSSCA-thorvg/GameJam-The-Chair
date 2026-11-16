import type { CoreState } from '../state';
import type { StageId } from '../types';
import type { StageHooks } from './types';
import { officeHooks } from './office/hooks';
import { buildingHooks } from './building/hooks';
import { rooftopHooks } from './rooftop/hooks';
import { orbitHooks } from './orbit/hooks';
import { skyHooks } from './sky/hooks';

export function stageHooks(stage: StageId): StageHooks {
    switch (stage) {
        case 1:
            return officeHooks;
        case 2:
            return buildingHooks;
        case 3:
            return rooftopHooks;
        case 4:
            return skyHooks;
        case 5:
            return orbitHooks;
    }
}

export function focusBlockedIn(s: Readonly<CoreState>) {
    return stageHooks(s.stage).focusBlocked?.(s) ?? false;
}
