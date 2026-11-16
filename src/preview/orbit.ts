import { createGame } from '../game/game';
import type { Input } from '../game/types';
import { STAGE_FIVE } from '../game/stages/orbit/data';
import { ORBIT_ENDING } from '../render/scene/orbit/ending';
import { createEffects } from '../render/effects';
import { type PreviewScene } from './types';
import { recordedScene, capture, stepGame, moveToward } from './recording';
import { orbitKeys } from './autopilot';

export function orbitRoute(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 4 rear view' }];
    const { air, space, shadow } = STAGE_FIVE.heights;
    let previous = '';
    for (let i = 0; i < 9000; i++) {
        const state = game.getSnapshot(),
            orbit = state.orbit;
        if (!orbit) break;
        game.setInput(...orbitKeys(state));
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const section =
            orbit.phase === 'parked'
                ? 'Ending'
                : orbit.z < air
                  ? '5-1 clouds'
                  : orbit.z < space
                    ? '5-2 atmosphere'
                    : orbit.z < shadow
                      ? '5-3 space'
                      : 'Earth shadow';
        if (section !== previous) {
            markers.push({ at: i / 60, label: section });
            previous = section;
        }
        if (
            orbit.phase === 'parked' &&
            i / 60 - (markers.at(-1)?.at ?? 0) > ORBIT_ENDING.end + 1
        ) {
            break;
        }
    }
    return recordedScene(
        'orbit-route',
        'Orbit · 5-1 to 5-3 and the ending',
        0,
        markers,
        frames,
    );
}

export function orbitEndingScene(aside = false): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const parked = JSON.parse(game.serialize());
    Object.assign(parked.orbit, {
        phase: 'parked',
        z: STAGE_FIVE.checkpoint.z,
        speed: 0,
        settled: 1,
        age: 76,
    });
    if (aside) {
        Object.assign(parked.p, {
            x: -STAGE_FIVE.bounds.x,
            y: STAGE_FIVE.bounds.y,
            vx: 0,
            vy: 0,
            a: 0,
        });
    }
    parked.checkpoint = 1;
    parked.time = 76;
    game.restore(JSON.stringify(parked));
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const {
        release,
        focus,
        signal,
        disconnect,
        handsStop,
        wideFrom,
        spinFrom,
        spin,
        lightsOut,
        dark,
        end,
    } = ORBIT_ENDING;
    const markers = [
        { at: 0, label: 'Spray dies down' },
        { at: release, label: 'Extinguisher floats off' },
        { at: focus, label: 'Over his shoulder' },
        { at: signal, label: 'Signal dropping' },
        { at: disconnect, label: 'Network lost on screen' },
        { at: handsStop, label: 'Hands stop · nothing' },
        { at: wideFrom, label: 'Pulling back' },
        { at: spinFrom, label: 'Chair swivels, camera circles' },
        { at: spin, label: 'Laptop goes dark' },
        { at: lightsOut, label: 'Fading out' },
        { at: dark, label: 'THE END' },
    ];
    for (let i = 0; i < (end + 1) * 60; i++) {
        stepGame(game, effects);
        frames.push(capture(game, effects));
    }
    return aside
        ? recordedScene(
              'orbit-ending-aside',
              'Orbit · Ending after parking off to one side',
              0,
              markers,
              frames,
          )
        : recordedScene(
              'orbit-ending',
              'Orbit · Ending: network lost on screen, hands stop, the chair looks out, THE END',
              0,
              markers,
              frames,
          );
}

export function orbitSatelliteLightScene(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 5 start' }];
    const first = STAGE_FIVE.satelliteLight.beams[0];
    let previous = '';
    for (let i = 0; i < 2400; i++) {
        const state = game.getSnapshot(),
            orbit = state.orbit;
        if (!orbit || orbit.z > first.to + 200) break;
        game.setInput(...orbitKeys(state));
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const stage =
            orbit.z < first.from
                ? 'clouds'
                : orbit.z < first.to
                  ? 'satellite light'
                  : 'past the beam';
        if (stage !== previous) {
            markers.push({ at: i / 60, label: stage });
            previous = stage;
        }
    }
    return recordedScene(
        'orbit-satellite-light',
        'Orbit · 5-1: the first beam, announced then dodged',
        0,
        markers,
        frames,
    );
}

export function orbitSatelliteLightLitScene(): PreviewScene {
    const game = createGame();
    game.startStage(5);
    const effects = createEffects();
    const frames = [capture(game, effects)];
    const markers = [{ at: 0, label: 'Stage 5 start' }];
    const first = STAGE_FIVE.satelliteLight.beams[0];
    let previous = '';
    for (let i = 0; i < 2400; i++) {
        const state = game.getSnapshot(),
            orbit = state.orbit,
            p = state.player;
        if (!orbit || orbit.z > first.to) break;
        const target =
            orbit.aims[0].x +
            first.half.x +
            40 +
            90 * Math.cos(orbit.age * 0.9);
        const keys: Input[] = moveToward(p, target);
        game.setInput(...keys);
        stepGame(game, effects);
        frames.push(capture(game, effects));
        const stage =
            orbit.z < first.from - 300 ? 'approach' : 'in and out of the light';
        if (stage !== previous) {
            markers.push({ at: i / 60, label: stage });
            previous = stage;
        }
    }
    return recordedScene(
        'orbit-satellite-light-lit',
        'Orbit · The chair lights up near and inside a satellite light',
        0,
        markers,
        frames,
    );
}
