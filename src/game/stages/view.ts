// Read-only values the presentation shows for stage props, routed here so shared code never imports a
// stage's internals directly.
import { LEVEL } from '../level';
import { monitorPhase } from './office/monitor/decide';

/** Office monitor lights at `time` (shown in the snapshot for every stage, as before). */
export function monitorsView(time: number) {
    return LEVEL.monitors.map(monitor => ({ ...monitor, ...monitorPhase(monitor, time) }));
}
