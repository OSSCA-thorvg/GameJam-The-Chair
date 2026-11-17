import { choice, record } from './primitives';

export function activity(data: Record<string, unknown>, path: string): void {
    switch (data.mode) {
        case 'impact':
            choice(data.lossReason, ['head'], `${path}.lossReason`);
            record(data.impact, `${path}.impact`);
            return;
        case 'focuslost':
            choice(data.lossReason, ['focus'], `${path}.lossReason`);
            requireNullImpact(data, path);
            requireLostFocus(data, path);
            return;
        case 'dead':
            if (data.lossReason === 'head') {
                record(data.impact, `${path}.impact`);
                return;
            }
            choice(
                data.lossReason,
                ['bin', 'focus', 'lift'],
                `${path}.lossReason`,
            );
            requireNullImpact(data, path);
            if (data.lossReason === 'focus') {
                requireLostFocus(data, path);
            }
            return;
        default:
            if (data.lossReason !== null) {
                throw new Error(
                    `${path}.lossReason must be null in ${String(data.mode)} mode`,
                );
            }
            requireNullImpact(data, path);
    }
}

function requireNullImpact(data: Record<string, unknown>, path: string) {
    if (data.impact !== null) {
        throw new Error(`${path}.impact must be null without a head impact`);
    }
}

function requireLostFocus(data: Record<string, unknown>, path: string) {
    const focus = record(data.focus, `${path}.focus`);
    if (focus.value !== 0) {
        throw new Error(`${path}.focus.value must be zero after focus loss`);
    }
}
