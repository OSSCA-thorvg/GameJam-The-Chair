import { parseState, createGame } from '../game/game';
import {
    ductTimings,
    STAGE_THREE,
    GRAPH_CORNERS,
} from '../game/stages/rooftop/data';
import { createEffects } from '../render/effects';
import { type PreviewScene, type PreviewFrame } from './types';
import { FRAME_TIME, recordedScene, capture, stepGame } from './recording';

export function rooftopEntrance(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 300; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(
        'rooftop-entrance',
        'Rooftop · Entrance & slipping portrait',
        400,
        [
            { at: 0, label: 'Closed · Portrait straight' },
            { at: 0.4, label: 'Door opens' },
            { at: 1.1, label: 'Chair emerges · Portrait straight' },
            { at: 1.8, label: 'At the block' },
            { at: 2.6, label: 'Door shuts · Portrait jolts' },
            { at: 2.8, label: 'Portrait drops' },
            { at: 2.96, label: 'Caught · Swinging' },
            { at: 3.9, label: 'Swing overshoot' },
            { at: 4.2, label: 'Settled at 40 degrees' },
        ],
        frames,
    );
}

export function rooftopTakeoff(): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const saved = parseState(game.serialize());
    saved.checkpoint = STAGE_THREE.checkpoints.length - 1;
    game.restore(JSON.stringify(saved));
    game.reset();
    const parked = parseState(game.serialize());
    parked.p = { ...parked.p, x: 2150, y: -172, vx: 0, vy: 0, a: 0, w: 0 };
    parked.ground = true;
    parked.extinguisher.owned = true;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    game.setInput('right');
    for (let i = 0; i < 600 && game.getSnapshot().stage === 3; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    const markers = [
        { at: 0, label: 'Run-up' },
        { at: 1.65, label: 'Boards the graph · Surge' },
        ...graphTargetMarkers(frames),
        { at: 3, label: 'Breaks out of the sign' },
        { at: 3.4, label: 'Short arrow · Chair keeps climbing · White clouds' },
        { at: 4.5, label: 'Colour changing' },
        { at: 5.6, label: 'Bread at sky' },
    ].sort((a, b) => a.at - b.at);
    return {
        ...recordedScene(
            'rooftop-takeoff',
            'Rooftop · Sales graph ride & bread cloud ascent',
            2500,
            markers,
            frames,
        ),
        follow: true,
    };
}

export function graphTargetMarkers(
    frames: PreviewFrame[],
): PreviewScene['markers'] {
    return [
        { distance: GRAPH_CORNERS[1] + 24, label: 'First peak · Green check' },
        {
            distance: GRAPH_CORNERS[1] + 100,
            label: 'Target starts moving · Rail stays fixed',
        },
        {
            distance: GRAPH_CORNERS[1] + 220,
            label: 'Target higher · Check becomes an empty circle',
        },
    ].map((marker) => ({
        at:
            Math.max(
                0,
                frames.findIndex(
                    (frame) =>
                        frame.state.firstFlight.kind === 'ride' &&
                        frame.state.firstFlight.dist >= marker.distance,
                ),
            ) * FRAME_TIME,
        label: marker.label,
    }));
}

export function shaftHazards(
    id: string,
    label: string,
    at: { x: number; y: number },
    startTime: number,
    markers: PreviewScene['markers'],
): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const saved = parseState(game.serialize());
    saved.checkpoint = STAGE_THREE.checkpoints.findIndex(
        (mark) => mark.x === 1310,
    );
    game.restore(JSON.stringify(saved));
    game.reset();
    const parked = parseState(game.serialize());
    parked.p = { ...parked.p, x: at.x, y: at.y, vx: 0, vy: 0, a: 0, w: 0 };
    parked.ground = true;
    parked.time = startTime;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 400; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene(id, label, at.x, markers, frames);
}

export function ductSneeze(gust = false): PreviewScene {
    const game = createGame();
    game.startStage(3);
    const base = game.getSnapshot();
    const effects = createEffects().snapshot();
    const kind = gust ? 'gust' : 'first';
    const timing = ductTimings(kind);
    return {
        id: gust ? 'duct-gust' : 'duct-sneeze',
        label: gust
            ? 'Rooftop · Timed duct gust'
            : 'Rooftop · First timed sneeze & overtime junk',
        duration: 2.2,
        focusX: 1510,
        markers: [
            { at: 0.05, label: 'Inhale' },
            { at: timing.inhale + 0.02, label: 'Twitch' },
            { at: timing.inhale + timing.twitch + 0.18, label: 'Sneeze' },
            {
                at: gust ? 1.6 : 2.1,
                label: gust ? 'Gust fades' : 'Junk settles',
            },
        ],
        sample(time) {
            const at = Math.max(0, Math.min(2.2, time));
            const drift = Math.min(
                1,
                Math.max(0, at - timing.inhale - timing.twitch),
            );
            return {
                state: {
                    ...base,
                    time: at,
                    hasExtinguisher: true,
                    checkpoint: 2,
                    rooftopEntrance: { kind: 'ready' },
                    ductReaction: {
                        kind: 'reacting',
                        age: gust ? 10 + at : at,
                        shots: gust ? 2 : 1,
                        bursts: [{ kind, age: at }],
                    },
                    player: {
                        ...base.player,
                        x: 1580 - drift * (gust ? 120 : 145),
                        y: 160 - Math.sin(drift * Math.PI) * 45,
                        a: -0.05,
                    },
                    ground: false,
                },
                effects,
            };
        },
    };
}
