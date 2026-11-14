import { FOCUS_DAMAGE, LEVEL, RULES } from '../../../level';
import type { Point } from '../../../types';
import type { FocusHit } from '../../../systems/focus/decide';

export type Cleaning = { x: number; a: number; b: number; spilled: boolean; age: number; followup: boolean; splashDir: number };
export type Bucket = { age: number; armed: boolean; spills: number };
export type CleaningResult = { cleaning: Cleaning; bucket: Bucket; splash: boolean; followup: boolean; soak: FocusHit | null };

export function waterExposure(bucketAge: number, p: Readonly<Point>, cleaningX: number = LEVEL.cleaning.x) {
    return bucketAge < RULES.waterExposure && Math.abs(p.x - cleaningX) < 210 && p.y > LEVEL.floor - 150;
}

// The bucket tips over when the chair rolls up to it, then refills before it can tip again.
export function cleaningStep(input: { p: Readonly<Point>; cleaning: Readonly<Cleaning>; bucket: Readonly<Bucket>; soakedOnSpill: number }, dt: number): CleaningResult {
    const { p } = input;
    const cleaning = { ...input.cleaning };
    const bucket = { ...input.bucket };
    let splash = false, followup = false, soak: FocusHit | null = null;
    const nearBucket = Math.abs(p.x - cleaning.x) < 150;
    const upright = bucket.age >= RULES.bucketReset;
    if (upright && !nearBucket) bucket.armed = true;
    if (upright && bucket.armed && nearBucket && p.y > LEVEL.floor - 200) {
        bucket.age = 0;
        bucket.armed = false;
        bucket.spills++;
        cleaning.spilled = true;
        cleaning.splashDir = p.x < cleaning.x ? -1 : 1;
        splash = true;
    }
    if (cleaning.spilled) {
        bucket.age += dt;
        cleaning.age += dt;
        if (!cleaning.followup && cleaning.age > 2.75) {
            cleaning.followup = true;
            followup = true;
        }
        if (input.soakedOnSpill !== bucket.spills && waterExposure(bucket.age, p, cleaning.x)) {
            soak = { kind: 'water', id: bucket.spills, damage: FOCUS_DAMAGE.water };
        }
    }
    return { cleaning, bucket, splash, followup, soak };
}

export function slipping(p: Readonly<Point>, cleaning: Readonly<Cleaning>, grounded: boolean) {
    return grounded && cleaning.spilled && p.x > cleaning.a
        && p.x < cleaning.a + Math.min(1, cleaning.age / .8) * (cleaning.b - cleaning.a) && p.y > LEVEL.floor - 55;
}
