import { FOCUS_DAMAGE, LEVEL, RULES } from '../level';
import type { GameCore } from '../core';
import { focusHit, waterExposureActive } from './focus';

export function cleaningStep(s: GameCore, dt: number) {
    const F = LEVEL.floor;
    const nearBucket = Math.abs(s.p.x - s.cleaning.x) < 150;
    const upright = s.bucket.age >= RULES.bucketReset;
    if (upright && !nearBucket) {
        s.bucket.armed = true;
    }
    if (upright && s.bucket.armed && nearBucket && s.p.y > F - 200) {
        s.bucket.age = 0;
        s.bucket.armed = false;
        s.bucket.spills++;
        s.cleaning.spilled = true;
        s.cleaning.splashDir = s.p.x < s.cleaning.x ? -1 : 1;
        s.events.push({ type: 'water-splash', x: s.cleaning.x, side: s.cleaning.splashDir });
        s.events.push({ type: 'cue', id: 'water-spilled' });
        s.events.push({ type: 'cue', id: 'water-comment' });
    }
    if (s.cleaning.spilled) {
        s.bucket.age += dt;
        s.cleaning.age += dt;
        if (!s.cleaning.followup && s.cleaning.age > 2.75) {
            s.cleaning.followup = true;
            s.events.push({ type: 'cue', id: 'water-followup' });
        }
        if (s.soakedOnSpill !== s.bucket.spills && waterExposureActive(s)) {
            s.soakedOnSpill = s.bucket.spills;
            focusHit(s, 'water', s.bucket.spills, FOCUS_DAMAGE.water);
            if (s.mode !== 'play') return;
        }
    }
    s.events.push({ type: 'water-step', dt });
}
