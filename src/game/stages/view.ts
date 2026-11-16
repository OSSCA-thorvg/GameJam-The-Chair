import { LEVEL } from '../level';
import { monitorPhase } from './office/monitor/decide';

export function monitorsView(time: number) {
    return LEVEL.monitors.map(monitor => ({ ...monitor, ...monitorPhase(monitor, time) }));
}
