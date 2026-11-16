import type { GameSnapshot } from '../../../game/game';
import type { Message } from '../../../i18n';

export const OPENING_BEATS = {
    sixPm: 0,
    irisOpen: 1.8,
    riderOvertime: 3.0,
    riderSales: 5.0,
    pushIn: 7.2,
    chairHope: 8.3,
    irisClose: 11.3,
    sevenPm: 12.0,
    creakOpen: 12.5,
    creak: 13.1,
    creakClose: 15.9,
    spinToEight: 16.6,
    eightPm: 17.8,
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
    age: number;
    alpha: number;
};

export type OpeningFrame = {
    t: number;
    shot: 'clock' | 'office';
    iris: number | null;
    clockScale: number;
    hours: number;
    spin: number;
    clockPop: number;
    clockWobble: number;
    zoom: number;
    handoff: number;
    dusk: number;
    lighting: number;
    shake: [number, number];
    chair: {
        lift: number;
        tilt: number;
        backrest: number;
        riderPop: number;
        shiver: number;
    };
    hum: number;
    rage: number;
    creak: number;
    creakPulse: number;
    bubbles: OpeningBubble[];
    done: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const progress = (t: number, a: number, b: number) =>
    clamp((t - a) / (b - a), 0, 1);
const smooth = (u: number) => u * u * (3 - 2 * u);
const easeIn = (u: number) => u * u * u;
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const pop = (t: number, at: number, length = 0.5) => {
    const age = t - at;
    if (age < 0 || age > length) {
        return 0;
    }
    return Math.sin((age / length) * Math.PI * 3) * (1 - age / length);
};

export const WIDE_ZOOM = 1.15;
export const CLOSE_ZOOM = 2.7;
export const WIDE_FOCUS_Y = 290;
export const CLOSE_FOCUS_OFFSET = -62;

function bubble(
    t: number,
    speaker: OpeningBubble['speaker'],
    style: BubbleStyle,
    message: Message,
    from: number,
    to: number,
): OpeningBubble | null {
    if (t < from || t > to) {
        return null;
    }
    const alpha = Math.min(1, (to - t) / 0.25);
    return { speaker, style, message, age: t - from, alpha };
}

function clockHours(t: number) {
    const B = OPENING_BEATS;
    if (t < B.irisClose) {
        return 18;
    }
    if (t < B.spinToEight) {
        return 19;
    }
    if (t < B.eightPm) {
        return 19 + smooth(progress(t, B.spinToEight, B.eightPm));
    }
    if (t < B.spinToNine) {
        return 20;
    }
    return 20 + smooth(progress(t, B.spinToNine, B.ninePm));
}

function clockSpin(t: number) {
    const B = OPENING_BEATS;
    const spinOf = (a: number, b: number) =>
        t > a && t < b ? Math.sin(progress(t, a, b) * Math.PI) : 0;
    return Math.max(
        spinOf(B.spinToEight, B.eightPm),
        spinOf(B.spinToNine, B.ninePm),
    );
}

const VISITS = [
    [
        OPENING_BEATS.irisOpen,
        OPENING_BEATS.riderOvertime,
        OPENING_BEATS.irisClose,
        OPENING_BEATS.sevenPm,
    ],
    [
        OPENING_BEATS.creakOpen,
        OPENING_BEATS.creak,
        OPENING_BEATS.creakClose,
        OPENING_BEATS.spinToEight,
    ],
    [
        OPENING_BEATS.kickOpen,
        OPENING_BEATS.kick,
        OPENING_BEATS.kickClose,
        OPENING_BEATS.spinToNine,
    ],
] as const;

function cover(t: number) {
    if (t >= OPENING_BEATS.darkChair) {
        return { office: true, iris: null, clockScale: 1 };
    }
    for (const [open, opened, close, closed] of VISITS) {
        if (t < open || t >= closed) {
            continue;
        }
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

function creaking(t: number) {
    const B = OPENING_BEATS;
    if (t < B.creak || t >= B.creakClose) {
        return { strain: 0, pulse: 0 };
    }
    const strain = progress(t, B.creak, B.creakClose - 0.4);
    const age = t - B.creak;
    const span = B.creakClose - B.creak;
    const beats = age / 0.9 + ((age * age) / (2 * span)) * (1 / 0.35 - 1 / 0.9);
    const phase = beats % 1;
    const pulse =
        phase < 0.3
            ? Math.sin((phase / 0.3) * Math.PI) * (0.35 + 0.65 * strain)
            : 0;
    return { strain, pulse };
}

function buck(t: number, at: number) {
    const age = t - at;
    if (age < 0 || age > 1) {
        return { backrest: 0, riderPop: 0, jolt: 0 };
    }
    const back = 0.18;
    const snap = 0.26;
    const backrest =
        age < back
            ? -0.5 * smooth(age / back)
            : age < snap
              ? lerp(-0.5, 0.28, smooth((age - back) / (snap - back)))
              : 0.28 *
                Math.cos((age - snap) * 22) *
                Math.exp(-(age - snap) * 6);
    const air = (age - snap) / 0.45;
    const riderPop = air > 0 && air < 1 ? 34 * Math.sin(air * Math.PI) : 0;
    return { backrest, riderPop, jolt: pop(t, at + snap, 0.4) };
}

export function openingFrame(time: number): OpeningFrame {
    const B = OPENING_BEATS;
    const t = clamp(time, 0, B.end);
    const { office, iris, clockScale } = cover(t);

    let closeness = 0;
    if (t >= B.pushIn && t < B.sevenPm) {
        closeness = smooth(progress(t, B.pushIn, B.chairHope));
    }
    if (t >= B.creakOpen) {
        closeness = 1;
    }
    const zoom = lerp(WIDE_ZOOM, CLOSE_ZOOM, closeness);
    const handoff = smooth(progress(t, B.handoff, B.end));

    const dusk =
        t < B.irisClose
            ? 0
            : t < B.darkChair
              ? smooth(progress(t, B.sevenPm, B.ninePm))
              : 1;

    const hum =
        t >= B.chairHope && t < B.irisClose
            ? Math.min(1, (t - B.chairHope) / 0.3, (B.irisClose - t) / 0.3)
            : 0;
    const rageRise = progress(t, B.rage, B.rage + 0.25);
    const rage =
        t >= B.rage
            ? rageRise * (1 - progress(t, B.handoff - 0.2, B.handoff + 0.5))
            : 0;
    const { strain: creak, pulse: creakPulse } = creaking(t);
    const firstKick = buck(t, B.kick);
    const secondKick = buck(t, B.kick + 1.15);
    const firstStrength = Math.abs(firstKick.backrest) + firstKick.riderPop;
    const secondStrength = Math.abs(secondKick.backrest) + secondKick.riderPop;
    const kick = secondStrength > firstStrength ? secondKick : firstKick;
    const joy =
        -Math.abs(Math.sin(t * 6)) * 13 * hum - pop(t, B.chairHope, 0.6) * 10;
    const lift =
        joy -
        Math.abs(Math.sin(t * 41)) * 3 * rage -
        creakPulse * 2 -
        Math.abs(kick.jolt) * 6;
    const tilt =
        Math.sin(t * 3) * 0.13 * hum +
        Math.sin(t * 53) * 0.045 * rage +
        Math.sin(t * 70) * 0.05 * creakPulse;
    const punch = pop(t, B.rage, 0.45) * 7;
    const shake: [number, number] = [
        Math.sin(t * 61) * 3 * rage +
            punch +
            Math.sin(t * 83) * 1.6 * creakPulse,
        Math.cos(t * 47) * 2 * rage + kick.jolt * 6,
    ];

    const bubbles = [
        bubble(
            t,
            'rider',
            'solid',
            'opening.riderOvertime',
            B.riderOvertime,
            B.riderSales - 0.15,
        ),
        bubble(
            t,
            'rider',
            'solid',
            'opening.riderSales',
            B.riderSales,
            B.pushIn + 0.2,
        ),
        bubble(
            t,
            'chair',
            'glass',
            'opening.chairHope',
            B.chairHope + 0.1,
            B.irisClose,
        ),
        bubble(
            t,
            'rider',
            'solid',
            'opening.riderTyping',
            B.kick + 1.8,
            B.kickClose,
        ),
        bubble(
            t,
            'chair',
            'rage',
            'opening.chairRage',
            B.rage,
            B.handoff + 0.3,
        ),
        bubble(
            t,
            'rider',
            'solid',
            'opening.riderTyping',
            B.riderTyping,
            B.handoff + 0.3,
        ),
    ].filter((item): item is OpeningBubble => item !== null);

    return {
        t,
        shot: office ? 'office' : 'clock',
        iris,
        clockScale,
        hours: clockHours(t),
        spin: clockSpin(t),
        clockPop: Math.max(
            pop(t, B.sixPm + 0.35, 0.6),
            pop(t, B.sevenPm, 0.5),
            pop(t, B.eightPm, 0.5),
            pop(t, B.ninePm, 0.5),
        ),
        clockWobble:
            t >= B.ninePm && t < B.darkChair
                ? Math.sin((t - B.ninePm) * 30) *
                  0.06 *
                  (1 - progress(t, B.ninePm, B.darkChair))
                : 0,
        zoom,
        handoff,
        dusk,
        lighting: 1 - handoff,
        shake,
        chair: {
            lift,
            tilt,
            backrest: kick.backrest,
            riderPop: kick.riderPop,
            shiver: rage,
        },
        hum,
        rage,
        creak,
        creakPulse,
        bubbles,
        done: time >= B.end,
    };
}

export function openingFocusY(frame: OpeningFrame, chairY: number): number {
    const closeness = (frame.zoom - WIDE_ZOOM) / (CLOSE_ZOOM - WIDE_ZOOM);
    return lerp(
        WIDE_FOCUS_Y,
        chairY + CLOSE_FOCUS_OFFSET,
        clamp(closeness, 0, 1),
    );
}

export function openingState(
    state: GameSnapshot,
    frame: OpeningFrame,
): GameSnapshot {
    return {
        ...state,
        time: frame.t,
        player: {
            ...state.player,
            y: state.player.y + frame.chair.lift,
            a: state.player.a + frame.chair.tilt,
        },
    };
}
