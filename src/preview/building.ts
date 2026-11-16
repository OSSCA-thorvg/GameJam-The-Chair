import { createGame, type Game, type GameSnapshot } from '../game/game';
import type { Input } from '../game/types';
import { STAGE_TWO } from '../game/stages/building/data';
import { createEffects } from '../render/effects';
import { type PreviewScene } from './types';
import { FRAME_TIME, recordedScene, capture, stepGame } from './recording';

export // A stage two game with the rider carried in the convoy at `x`, about to say orientation `line`.
function convoyRide(x: number, line: number, said = false): Game {
    const game = createGame();
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    const cruise = STAGE_TWO.orientation.cruise;
    saved.checkpoint = 2;
    saved.lessons = { moved: true, jumped: true };
    saved.p = { ...saved.p, x, y: 392, vx: cruise, vy: 0, a: 0, w: 0 };
    saved.ground = true;
    saved.building.furniture = saved.building.furniture.map((chair: object, i: number) => ({ ...chair, x: x + 90 - i * 130, vx: cruise, released: true, cheer: 0 }));
    Object.assign(saved.building.corridor, {
        dispatchStarted: true, dispatchAge: 10, convoy: 'carried', lesson: line,
        chat: { kind: 'orientation', age: said ? 9 : -1, line },
    });
    game.restore(JSON.stringify(saved));
    return game;
}

export // Hop when the jump will peak over the next orientation obstacle.
function orientationHop(state: GameSnapshot) {
    if (!state.ground) return false;
    const p = state.player;
    return STAGE_TWO.orientation.obstacles.some(obstacle => {
        const time = (obstacle.x - p.x) / Math.max(1, p.vx);
        return time > .36 && time < .44;
    });
}

export // Rides the orientation convoy from `x`, the chairs about to say `line`.
function orientationRun(id: string, label: string, x: number, line: number, hop: boolean, frameCount: number, markers: PreviewScene['markers']): PreviewScene {
    const game = convoyRide(x, line);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < frameCount; i++) {
        const state = game.getSnapshot();
        if (hop && orientationHop(state)) game.jump();
        game.setInput(...(state.corridor.convoy === 'carried' ? [] : ['right'] satisfies Input[]));
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return { ...recordedScene(id, label, x, markers, frames), follow: true };
}

export function expressRun(id: string, label: string, rampJump: boolean, markers: PreviewScene['markers']): PreviewScene {
    const game = convoyRide(STAGE_TWO.express.start - 10, STAGE_TWO.orientation.lines.length - 1, true);
    const { pit } = STAGE_TWO.express;
    const effects = createEffects();
    const frames = [capture(game, effects)];
    let off = false;
    for (let i = 0; i < 300; i++) {
        const state = game.getSnapshot(), p = state.player, c = state.corridor;
        let keys: Input[] = [];
        if (off || c.convoy === 'free') keys = ['right'];
        else if (c.convoy === 'carried' && state.ground) {
            if (rampJump && pit.left - p.x > 0 && pit.left - p.x < 35) game.jump();
            if (p.x > pit.right + 120) { game.jump(); off = true; keys = ['right']; }
        }
        game.setInput(...keys);
        stepGame(game, effects);
        frames.push(capture(game, effects));
        if (game.getSnapshot().deaths > 0) break;
    }
    return { ...recordedScene(id, label, STAGE_TWO.express.ramp.start, markers, frames), follow: true };
}

export /** The meeting room on the `visit`-th walk in; the chairs grumble a different set of lines each time. */
function meetingVisit(visit = 1): PreviewScene {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    saved.mode = 'play';
    saved.ground = true;
    saved.p.x = STAGE_TWO.meeting - 110;
    game.restore(JSON.stringify(saved));
    game.interact();
    const effects = createEffects();
    // Earlier visits, as the effects would have counted them walking in and out of the room.
    for (let i = 1; i < visit; i++) {
        const state = game.getSnapshot();
        for (const kind of ['entering', 'corridor']) effects.observe({ ...state, corridor: { ...state.corridor, room: { kind } } });
    }
    const frames = [capture(game, effects)];
    for (let i = 0; i < Math.ceil((6 + STAGE_TWO.meetingEntry) / FRAME_TIME); i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    const id = visit === 1 ? 'building-meeting' : `building-meeting-${visit}`;
    const label = visit === 1 ? 'Building · The chairs cannot clock out' : `Building · The chairs cannot clock out (visit ${visit})`;
    return recordedScene(id, label, STAGE_TWO.meeting,
        [{ at: 0, label: 'Closed door' }, { at: .25, label: 'Opening and entering' },
            { at: STAGE_TWO.meetingEntry, label: 'Inside the meeting' }, { at: 2.4, label: 'Chairs sigh under their people' },
            { at: 2.75, label: 'End time extended' }, { at: 5.45, label: 'Return the borrowed chair' }], frames);
}

export function chairDispatch(): PreviewScene {
    const game = createGame({ seed: 8 });
    game.startStage(2);
    const saved = JSON.parse(game.serialize());
    saved.mode = 'play';
    saved.ground = true;
    saved.checkpoint = 1;
    saved.p.x = STAGE_TWO.checkpoints[1].x;
    game.restore(JSON.stringify(saved));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    for (let i = 0; i < 300; i++) {
        game.setInput('right');
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return recordedScene('building-dispatch', 'Building · Chairs leave after the first flag', STAGE_TWO.dispatch.room,
        [{ at: 0, label: 'First checkpoint' }, { at: 1.1, label: 'Room opens' },
            { at: 2.9, label: 'Last chair leaves' }, { at: 4.1, label: 'Door closes' }, { at: 4.8, label: 'Join the convoy' }], frames);
}

export function officeTyping(): PreviewScene {
    const game = createGame();
    game.startStage(2);
    const base = game.getSnapshot();
    const state = { ...base, player: { ...base.player, x: STAGE_TWO.length } };
    const effects = createEffects().snapshot();
    return {
        id: 'office-typing',
        label: 'Office · Window typing',
        duration: 1,
        focusX: STAGE_TWO.offices[1],
        markers: [{ at: 0, label: 'Ready' }, { at: .25, label: 'Hand raised' }, { at: .5, label: 'Key press' }],
        sample(time) {
            return { state: { ...state, time: Math.max(0, Math.min(1, time)) }, effects };
        },
    };
}
