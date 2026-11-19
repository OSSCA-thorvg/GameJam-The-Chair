import endingUrl from '../../assets/bgm/ending.m4a?url';
import stage12Url from '../../assets/bgm/stage1-2.m4a?url';
import stage3Url from '../../assets/bgm/stage3.m4a?url';
import stage4Url from '../../assets/bgm/stage4.m4a?url';
import stage5Url from '../../assets/bgm/stage5.m4a?url';
import startUrl from '../../assets/bgm/start.m4a?url';

import type { MusicTrack } from '../presentation/music';

const TRACK_URLS: Record<MusicTrack, string> = {
    start: startUrl,
    'stage1-2': stage12Url,
    stage3: stage3Url,
    stage4: stage4Url,
    stage5: stage5Url,
    ending: endingUrl,
};
const VOLUME = 0.55;
const DUCKED = 0.18;
const FADE_SECONDS = 1.2;
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

export type Music = {
    play(track: MusicTrack, ducked: boolean): void;
    advance(dt: number): void;
    destroy(): void;
};

export function createMusic(): Music {
    const voices = new Map<MusicTrack, HTMLAudioElement>();
    let current: MusicTrack | null = null;
    let target = VOLUME;
    let unlocked = false;

    const voice = (track: MusicTrack) => {
        let audio = voices.get(track);
        if (!audio) {
            audio = new Audio(TRACK_URLS[track]);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = 0;
            voices.set(track, audio);
        }
        return audio;
    };
    const start = (audio: HTMLAudioElement) => {
        if (document.hidden || !audio.paused) {
            return;
        }
        audio.play().then(
            () => {
                unlocked = true;
            },
            () => {},
        );
    };
    const unlock = () => {
        if (current) {
            start(voice(current));
        }
        if (unlocked) {
            for (const name of UNLOCK_EVENTS) {
                window.removeEventListener(name, unlock, true);
            }
        }
    };
    const onVisibility = () => {
        for (const audio of voices.values()) {
            if (document.hidden) {
                audio.pause();
            }
        }
        if (!document.hidden && current) {
            start(voice(current));
        }
    };
    for (const name of UNLOCK_EVENTS) {
        window.addEventListener(name, unlock, true);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return {
        play(track, ducked) {
            target = ducked ? DUCKED : VOLUME;
            if (track === current) {
                return;
            }
            current = track;
            const audio = voice(track);
            audio.currentTime = 0;
            start(audio);
        },
        advance(dt) {
            const step = (VOLUME * Math.min(dt, 0.1)) / FADE_SECONDS;
            for (const [track, audio] of voices) {
                const goal = track === current ? target : 0;
                const delta = Math.max(
                    -step,
                    Math.min(step, goal - audio.volume),
                );
                audio.volume = Math.max(0, Math.min(1, audio.volume + delta));
                if (goal === 0 && audio.volume === 0 && !audio.paused) {
                    audio.pause();
                }
            }
        },
        destroy() {
            for (const name of UNLOCK_EVENTS) {
                window.removeEventListener(name, unlock, true);
            }
            document.removeEventListener('visibilitychange', onVisibility);
            for (const audio of voices.values()) {
                audio.pause();
                audio.removeAttribute('src');
            }
            voices.clear();
        },
    };
}
