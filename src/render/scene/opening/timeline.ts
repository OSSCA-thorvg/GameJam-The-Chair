import type { Message } from '../../../i18n';
import type { GameState } from '../../../game/game';

// The opening cutscene is pure presentation: every frame is a function of the elapsed time only, so the
// game page, the motion preview and the tests all see the same picture for the same `t`.

/** Start time (seconds) of every beat. */
export const OPENING_BEATS = {
    sixPm: 0,
    irisOpen: 1.8,
    riderOvertime: 3.0,
    riderSales: 5.0,
    pushIn: 7.2,
    chairHope: 8.3,
    irisClose: 11.3,
    sevenPm: 12.0,
    // 7 pm: back on the chair, creaking louder and louder while the worker types.
    creakOpen: 12.5,
    creak: 13.1,
    creakClose: 15.9,
    spinToEight: 16.6,
    eightPm: 17.8,
    // 8 pm: the backrest bucks the worker up twice, anger marks throb, and he types on.
    kickOpen: 18.3,
    kick: 18.9,
    kickClose: 21.6,
    spinToNine: 22.3,
    ninePm: 23.5,
    darkChair: 24.2,
    rage: 24.7,
    riderTyping: 25.6,
    handoff: 27.8,
    end: 29.2,
} as const;

export const OPENING_DURATION = OPENING_BEATS.end;

export type BubbleStyle = 'solid' | 'glass' | 'rage';
export type OpeningBubble = {
    speaker: 'rider' | 'chair';
    style: BubbleStyle;
    message: Message;
    /** Seconds since the bubble appeared. */
    age: number;
    /** 0..1 fade multiplier. */
    alpha: number;
};

export type OpeningFrame = {
    t: number;
    /** `clock`: only the wall clock is on screen. `office`: the office, possibly under a clock cover. */
    shot: 'clock' | 'office';
    /** Clock cover over the office: 0 hides the office, 1 has opened the iris fully. null: no cover. */
    iris: number | null;
    /** Clock face scale (1 at rest; grows while the iris dives into it). */
    clockScale: number;
    /** Clock time in hours on a 24 h dial (18 = 6 pm). */
    hours: number;
    /** Minute hand speed, 0..1, for the motion trail. */
    spin: number;
    /** Arrival bounce of the clock (0 at rest). */
    clockPop: number;
    /** Wobble of the whole clock after the last spin (radians). */
    clockWobble: number;
    /** Office camera zoom (1 = gameplay width); see openingFocusY for the framing. */
    zoom: number;
    /** 0..1 blend from the cutscene camera back to the gameplay camera. */
    handoff: number;
    /** 0 = 6 pm sunset, 1 = 9 pm night. */
    dusk: number;
    /** Strength of the cutscene lighting (fades out on handoff). */
    lighting: number;
    /** Screen shake in screen px. */
    shake: [number, number];
    /**
     * Chair pose relative to the gameplay pose. `backrest`: the backrest's own swing in radians (negative leans it
     * back); `riderPop`: how far the worker is bucked up off the seat; `shiver`: how hard the chair shakes with
     * rage (0..1), drawn as afterimages beside it.
     */
    chair: { lift: number; tilt: number; backrest: number; riderPop: number; shiver: number };
    /** Chair humming (0..1) and rage (0..1) intensities for the decorations around it. */
    hum: number;
    rage: number;
    /** 7 pm creaking: how strained the chair is (0..1, growing) and the current creak (0..1, pulsing). */
    creak: number;
    creakPulse: number;
    /** 8 pm anger marks (0..1). */
    anger: number;
    bubbles: OpeningBubble[];
    done: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const progress = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const smooth = (u: number) => u * u * (3 - 2 * u);
const easeIn = (u: number) => u * u * u;
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A quick squash that settles: peaks right after `at` and dies out within `length` seconds. */
const pop = (t: number, at: number, length = .5) => {
    const age = t - at;
    if (age < 0 || age > length) return 0;
    return Math.sin(age / length * Math.PI * 3) * (1 - age / length);
};

export const WIDE_ZOOM = 1.15;
export const CLOSE_ZOOM = 2.7;
/** World y of the wide shot's screen centre and the chair close-up offset from the chair centre. */
export const WIDE_FOCUS_Y = 290;
export const CLOSE_FOCUS_OFFSET = -62;

function bubble(t: number, speaker: OpeningBubble['speaker'], style: BubbleStyle, message: Message, from: number, to: number): OpeningBubble | null {
    if (t < from || t > to) return null;
    const alpha = Math.min(1, (to - t) / .25);
    return { speaker, style, message, age: t - from, alpha };
}

/** Hour hand position (24 h) at time `t`. */
function clockHours(t: number) {
    const B = OPENING_BEATS;
    if (t < B.irisClose) return 18;
    if (t < B.spinToEight) return 19;
    if (t < B.eightPm) return 19 + smooth(progress(t, B.spinToEight, B.eightPm));
    if (t < B.spinToNine) return 20;
    return 20 + smooth(progress(t, B.spinToNine, B.ninePm));
}

function clockSpin(t: number) {
    const B = OPENING_BEATS;
    const spinOf = (a: number, b: number) => t > a && t < b ? Math.sin(progress(t, a, b) * Math.PI) : 0;
    return Math.max(spinOf(B.spinToEight, B.eightPm), spinOf(B.spinToNine, B.ninePm));
}

/** Office visits between clock shots: [the iris starts opening, fully open, starts closing, back on the clock]. */
const VISITS = [
    [OPENING_BEATS.irisOpen, OPENING_BEATS.riderOvertime, OPENING_BEATS.irisClose, OPENING_BEATS.sevenPm],
    [OPENING_BEATS.creakOpen, OPENING_BEATS.creak, OPENING_BEATS.creakClose, OPENING_BEATS.spinToEight],
    [OPENING_BEATS.kickOpen, OPENING_BEATS.kick, OPENING_BEATS.kickClose, OPENING_BEATS.spinToNine],
] as const;

/** Whether the office is on screen, and the clock cover diving into it or closing over it. */
function cover(t: number) {
    if (t >= OPENING_BEATS.darkChair) return { office: true, iris: null, clockScale: 1 };
    for (const [open, opened, close, closed] of VISITS) {
        if (t < open || t >= closed) continue;
        if (t < opened) {
            const u = easeIn(progress(t, open, opened));
            return { office: true, iris: u, clockScale: 1 + 2.4 * u };
        }
        if (t >= close) {
            const u = 1 - easeOut(progress(t, close, closed));
            return { office: true, iris: u, clockScale: 1 + 2.4 * u };
        }
        return { office: true, iris: null, clockScale: 1 };
    }
    return { office: false, iris: 0, clockScale: 1 };
}

/**
 * 7 pm: a creak every so often, coming quicker and harder as the hour drags on. `strain` grows 0..1 across the
 * shot; `pulse` is the creak sounding now.
 */
function creaking(t: number) {
    const B = OPENING_BEATS;
    if (t < B.creak || t >= B.creakClose) return { strain: 0, pulse: 0 };
    const strain = progress(t, B.creak, B.creakClose - .4);
    // The gap between creaks shrinks from .9 s to .35 s; integrate it so the beat speeds up smoothly.
    const age = t - B.creak, span = B.creakClose - B.creak;
    const beats = age / .9 + (age * age / (2 * span)) * (1 / .35 - 1 / .9);
    const phase = beats % 1;
    const pulse = phase < .3 ? Math.sin(phase / .3 * Math.PI) * (.35 + .65 * strain) : 0;
    return { strain, pulse };
}

/** One buck of the backrest at `at`: leans back, snaps forward and throws the worker up, then wobbles still. */
function buck(t: number, at: number) {
    const age = t - at;
    if (age < 0 || age > 1) return { backrest: 0, riderPop: 0, jolt: 0 };
    const back = .18, snap = .26;
    const backrest = age < back ? -.5 * smooth(age / back)
        : age < snap ? lerp(-.5, .28, smooth((age - back) / (snap - back)))
            : .28 * Math.cos((age - snap) * 22) * Math.exp(-(age - snap) * 6);
    const air = (age - snap) / .45;
    const riderPop = air > 0 && air < 1 ? 34 * Math.sin(air * Math.PI) : 0;
    return { backrest, riderPop, jolt: pop(t, at + snap, .4) };
}

export function openingFrame(time: number): OpeningFrame {
    const B = OPENING_BEATS;
    const t = clamp(time, 0, B.end);
    const { office, iris, clockScale } = cover(t);

    // Wide office → chair close-up for the 6 pm hope; every later office shot starts close on the chair.
    let closeness = 0;
    if (t >= B.pushIn && t < B.sevenPm) closeness = smooth(progress(t, B.pushIn, B.chairHope));
    if (t >= B.creakOpen) closeness = 1;
    const zoom = lerp(WIDE_ZOOM, CLOSE_ZOOM, closeness);
    const handoff = smooth(progress(t, B.handoff, B.end));

    const dusk = t < B.irisClose ? 0 : t < B.darkChair ? smooth(progress(t, B.sevenPm, B.ninePm)) : 1;

    const hum = t >= B.chairHope && t < B.irisClose ? Math.min(1, (t - B.chairHope) / .3, (B.irisClose - t) / .3) : 0;
    const rageRise = progress(t, B.rage, B.rage + .25);
    const rage = t >= B.rage ? rageRise * (1 - progress(t, B.handoff - .2, B.handoff + .5)) : 0;
    const { strain: creak, pulse: creakPulse } = creaking(t);
    const kick = [buck(t, B.kick), buck(t, B.kick + 1.15)].reduce((a, b) => Math.abs(b.backrest) + b.riderPop > Math.abs(a.backrest) + a.riderPop ? b : a);
    const anger = t >= B.kick + .3 && t < B.kickClose ? Math.min(1, (t - B.kick - .3) / .25, (B.kickClose - t) / .3) : 0;
    // 6 pm: bouncy hops and a side-to-side dance, with a jump for joy as the hope begins.
    const joy = -Math.abs(Math.sin(t * 6)) * 13 * hum - pop(t, B.chairHope, .6) * 10;
    const lift = joy - Math.abs(Math.sin(t * 41)) * 3 * rage - creakPulse * 2 - Math.abs(kick.jolt) * 6;
    const tilt = Math.sin(t * 3) * .13 * hum + Math.sin(t * 53) * .045 * rage + Math.sin(t * 70) * .05 * creakPulse;
    const punch = pop(t, B.rage, .45) * 7;
    const shake: [number, number] = [
        Math.sin(t * 61) * 3 * rage + punch + Math.sin(t * 83) * 1.6 * creakPulse,
        Math.cos(t * 47) * 2 * rage + kick.jolt * 6,
    ];

    const bubbles = [
        bubble(t, 'rider', 'solid', 'opening.riderOvertime', B.riderOvertime, B.riderSales - .15),
        bubble(t, 'rider', 'solid', 'opening.riderSales', B.riderSales, B.pushIn + .2),
        bubble(t, 'chair', 'glass', 'opening.chairHope', B.chairHope + .1, B.irisClose),
        bubble(t, 'rider', 'solid', 'opening.riderTyping', B.kick + 1.8, B.kickClose),
        bubble(t, 'chair', 'rage', 'opening.chairRage', B.rage, B.handoff + .3),
        bubble(t, 'rider', 'solid', 'opening.riderTyping', B.riderTyping, B.handoff + .3),
    ].filter((item): item is OpeningBubble => item !== null);

    return {
        t,
        shot: office ? 'office' : 'clock',
        iris,
        clockScale,
        hours: clockHours(t),
        spin: clockSpin(t),
        clockPop: Math.max(pop(t, B.sixPm + .35, .6), pop(t, B.sevenPm, .5), pop(t, B.eightPm, .5), pop(t, B.ninePm, .5)),
        clockWobble: t >= B.ninePm && t < B.darkChair ? Math.sin((t - B.ninePm) * 30) * .06 * (1 - progress(t, B.ninePm, B.darkChair)) : 0,
        zoom,
        handoff,
        dusk,
        lighting: 1 - handoff,
        shake,
        chair: { lift, tilt, backrest: kick.backrest, riderPop: kick.riderPop, shiver: rage },
        hum,
        rage,
        creak,
        creakPulse,
        anger,
        bubbles,
        done: time >= B.end,
    };
}

/** Focus y for a frame: the wide shot looks at the room, the close-up at the chair. */
export function openingFocusY(frame: OpeningFrame, chairY: number) {
    const closeness = (frame.zoom - WIDE_ZOOM) / (CLOSE_ZOOM - WIDE_ZOOM);
    return lerp(WIDE_FOCUS_Y, chairY + CLOSE_FOCUS_OFFSET, clamp(closeness, 0, 1));
}

/** The game snapshot as the cutscene shows it: the chair performs and the rider keeps typing. */
export function openingState(state: GameState, frame: OpeningFrame): GameState {
    return {
        ...state,
        time: frame.t,
        player: { ...state.player, y: state.player.y + frame.chair.lift, a: state.player.a + frame.chair.tilt },
    };
}
