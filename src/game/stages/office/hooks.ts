// Stage 1 · Office: copier papers, the mop bucket, geysers, wet floor, the bin and the monitors.
import type { StageHooks } from '../types';
import { applyCopier, applyPapers, applyUrgentCopier } from './copier/apply';
import { copierStep, papersStep, urgentCopierStep } from './copier/decide';
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
        s.office.copier.cool = Math.max(0, s.office.copier.cool - dt);
        s.office.binCooldown = Math.max(0, s.office.binCooldown - dt);
        s.office.paperPenaltyRemaining = Math.max(0, s.office.paperPenaltyRemaining - dt);
        s.office.slipCooldown = Math.max(0, s.office.slipCooldown - dt);
        s.office.lightPenaltyRemaining = Math.max(0, s.office.lightPenaltyRemaining - dt);
        s.office.lightCooldown = Math.max(0, s.office.lightCooldown - dt);
    },
    hazards(s, out, dt) {
        applyCopier(s, out, copierStep(s.office.copier, s.office.volley, s.p.x, true, dt));
        applyUrgentCopier(s, out, urgentCopierStep(s.office.urgent, s.p.x, dt));
        if (!applyPapers(s, out, papersStep(s.office.papers, s.p, s.office.inBin, dt), dt)) return false;
        const { cleaning, bucket, soakedOnSpill } = s.office;
        applyCleaning(s, out, cleaningStep({ p: s.p, cleaning, bucket, soakedOnSpill }, dt), dt);
        applyGeyserHits(s, out, geyserHits(s.p, s.time, s.rng.physics));
        return s.mode === 'play';
    },
    beforeDrive(s, out, grounded) {
        s.office.slip = slipping(s.p, s.office.cleaning, grounded);
        if (s.office.slip && !s.office.wetSeen) s.office.wetSeen = true;
        if (s.office.slip && s.office.slipCooldown === 0 && Math.abs(s.p.vx) > 65) {
            out.push({ type: 'cue', id: 'slipping' });
            s.office.slipCooldown = 7;
        }
    },
    // The wet floor makes the wheels slip.
    drive: s => ({ slip: s.office.slip }),
    afterMove(s, out) {
        if (!fallsIntoBin(s.p, s.office.binCooldown)) return false;
        applyBinFall(s, out);
        return true;
    },
    afterCollide(s, out, _dt, previousX) {
        applyMonitorContact(s, out, monitorContact(s.p, previousX, s.time));
    },
    // Spray specks while sliding fast on the wet floor (30 per second).
    afterScore(s, out, dt) {
        if (s.office.slip && Math.abs(s.p.vx) > 90 && Math.floor(s.time * 30) !== Math.floor((s.time - dt) * 30)) {
            out.push({ type: 'speck', x: s.p.x - 15, vx: -s.p.vx * .2 });
        }
    },
    // Focus does not recover right after a paper or light hit, or while standing in fresh spilled water.
    focusBlocked: s => s.office.paperPenaltyRemaining > 0 || s.office.lightPenaltyRemaining > 0
        || waterExposure(s.office.bucket.age, s.p, s.office.cleaning.x),
    // There is no floor below the office: a fall ends in the bin.
    onFall(s, out) {
        applyBinFall(s, out);
    },
};
