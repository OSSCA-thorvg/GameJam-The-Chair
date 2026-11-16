import type { GameSnapshot } from '../game/game';
import type { StageId } from '../game/types';

type StagePresentation = {
    scene: 'office' | 'building' | 'rooftop' | 'sky' | 'orbit';
    controls: { flight: boolean; meeting: boolean; spray: boolean };
    hud: {
        jump: boolean;
        balance: boolean;
        manualSpray: boolean;
        focusAlert: boolean;
    };
    camera: { width: number; followVertical: boolean; followWhenWon: boolean };
};

export const STAGE_PRESENTATION = {
    1: {
        scene: 'office',
        controls: { flight: false, meeting: false, spray: false },
        hud: {
            jump: true,
            balance: true,
            manualSpray: false,
            focusAlert: true,
        },
        camera: { width: 1, followVertical: false, followWhenWon: false },
    },
    2: {
        scene: 'building',
        controls: { flight: false, meeting: true, spray: false },
        hud: {
            jump: true,
            balance: true,
            manualSpray: false,
            focusAlert: false,
        },
        camera: { width: 1, followVertical: false, followWhenWon: false },
    },
    3: {
        scene: 'rooftop',
        controls: { flight: false, meeting: false, spray: true },
        hud: {
            jump: true,
            balance: true,
            manualSpray: true,
            focusAlert: false,
        },
        camera: { width: 1, followVertical: true, followWhenWon: false },
    },
    4: {
        scene: 'sky',
        controls: { flight: false, meeting: false, spray: true },
        hud: {
            jump: true,
            balance: true,
            manualSpray: true,
            focusAlert: false,
        },
        camera: { width: 1.12, followVertical: true, followWhenWon: true },
    },
    5: {
        scene: 'orbit',
        controls: { flight: true, meeting: false, spray: true },
        hud: {
            jump: false,
            balance: false,
            manualSpray: false,
            focusAlert: false,
        },
        camera: { width: 1, followVertical: true, followWhenWon: false },
    },
} satisfies Record<StageId, StagePresentation>;

export function stageCamera(state: GameSnapshot):
    | {
          lead: number;
          focusY: number;
          width: number;
          followVertical: false;
          followWhenWon: false;
      }
    | {
          lead: number;
          focusY: number;
          width: number;
          followVertical: true;
          followWhenWon: false;
      }
    | {
          lead: number;
          focusY: number;
          width: number;
          followVertical: true;
          followWhenWon: true;
      } {
    const policy = STAGE_PRESENTATION[state.stage];
    const centred =
        (policy.scene === 'rooftop' && state.firstFlight.kind !== 'course') ||
        (policy.scene === 'sky' && state.sky.phase === 'arrival');
    const signLook =
        policy.scene === 'rooftop'
            ? 330 +
              110 * Math.max(0, Math.min(1, (state.player.x - 2050) / 300))
            : 330;
    const flight = state.firstFlight;
    const focusY =
        policy.scene === 'sky' || flight.kind === 'flight'
            ? 265
            : flight.kind === 'ride'
              ? 440 - 175 * Math.min(1, flight.age / 1.2)
              : signLook;
    return { ...policy.camera, lead: centred ? 0.5 : 0.35, focusY };
}

export function hideStageHud(state: GameSnapshot): boolean {
    const { scene } = STAGE_PRESENTATION[state.stage];
    return (
        (scene === 'sky' &&
            (state.sky.phase === 'reveal' || state.sky.phase === 'depth')) ||
        (scene === 'orbit' && state.orbit?.phase === 'parked')
    );
}
