// Stage 1 · Office: copier papers, the mop bucket, geysers, wet floor, the bin and the monitors.
import type { StageHooks } from '../types';
import { applyCopier, applyPapers } from './copier/apply';
import { copierStep, papersStep } from './copier/decide';
import { applyCleaning } from './cleaning/apply';
import { cleaningStep, slipping, waterExposure } from './cleaning/decide';
import { applyGeyserHits } from './geyser/apply';
import { geyserHits } from './geyser/decide';
import { applyBinFall } from './bin/apply';
import { fallsIntoBin } from './bin/decide';
import { applyMonitorContact } from './monitor/apply';
import { monitorContact } from './monitor/decide';

export const officeHooks: StageHooks = {
    timers(s, dt) {
        s.copier.cool = Math.max(0, s.copier.cool - dt);
        s.binCooldown = Math.max(0, s.binCooldown - dt);
        s.paperPenaltyRemaining = Math.max(0, s.paperPenaltyRemaining - dt);
        s.slipCooldown = Math.max(0, s.slipCooldown - dt);
        s.lightPenaltyRemaining = Math.max(0, s.lightPenaltyRemaining - dt);
        s.lightCooldown = Math.max(0, s.lightCooldown - dt);
    },
    hazards(s, out, dt) {
        applyCopier(s, out, copierStep(s.copier, s.volley, s.p.x, true, dt));
        if (!applyPapers(s, out, papersStep(s.papers, s.p, s.inBin, dt), dt)) return false;
        applyCleaning(s, out, cleaningStep(s, dt), dt);
        applyGeyserHits(s, out, geyserHits(s.p, s.time, s.rng.physics));
        return s.mode === 'play';
    },
    beforeDrive(s, out, grounded) {
        s.slip = slipping(s.p, s.cleaning, grounded);
        if (s.slip && !s.wetSeen) s.wetSeen = true;
        if (s.slip && s.slipCooldown === 0 && Math.abs(s.p.vx) > 65) {
            out.push({ type: 'cue', id: 'slipping' });
            s.slipCooldown = 7;
        }
    },
    afterMove(s, out) {
        if (!fallsIntoBin(s.p, s.binCooldown)) return false;
        applyBinFall(s, out);
        return true;
    },
    afterCollide(s, out, _dt, previousX) {
        applyMonitorContact(s, out, monitorContact(s.p, previousX, s.time));
    },
    // Standing in fresh spilled water keeps focus from recovering.
    focusBlocked: s => waterExposure(s.bucket.age, s.p, s.cleaning.x),
    // There is no floor below the office: a fall ends in the bin.
    onFall(s, out) {
        applyBinFall(s, out);
    },
};
