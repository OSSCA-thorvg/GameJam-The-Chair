import { translate, type Locale } from '../i18n';
import { OPENING_DURATION, openingFrame, type OpeningFrame } from '../render/scene/opening/timeline';

// Plays the opening cutscene once per browser, the first time the player presses Start. The cutscene is
// presentation only: the game waits (it is not advanced) and the main loop draws `frame()` instead.

export const OPENING_SEEN_KEY = 'the-chair-opening-seen';

export function openingSeen() {
    try {
        return localStorage.getItem(OPENING_SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

export function createOpening(root: HTMLElement, getLocale: () => Locale) {
    let time: number | null = null;
    let screen: HTMLElement | null = null;
    let onDone: (() => void) | null = null;
    const controller = new AbortController();

    function finish() {
        if (time === null) return;
        time = null;
        screen?.remove();
        screen = null;
        try { localStorage.setItem(OPENING_SEEN_KEY, '1'); } catch {}
        const done = onDone;
        onDone = null;
        done?.();
    }

    function start(done: () => void) {
        const scene = root.querySelector<HTMLElement>('.scene');
        if (!scene) return done();
        time = 0;
        onDone = done;
        // A transparent layer over the scene: any click or Enter/Esc/Space skips to the game.
        screen = document.createElement('div');
        screen.className = 'opening-skip';
        screen.setAttribute('role', 'button');
        screen.setAttribute('tabindex', '0');
        screen.setAttribute('aria-label', translate('opening.skip', getLocale()));
        const hint = document.createElement('span');
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = '▶▶';
        screen.append(hint);
        screen.addEventListener('click', finish);
        scene.append(screen);
        screen.focus();
    }

    window.addEventListener('keydown', event => {
        if (time === null || !['Escape', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        finish();
    }, { capture: true, signal: controller.signal });

    return {
        start,
        skip: finish,
        get active() {
            return time !== null;
        },
        advance(dt: number) {
            if (time === null) return;
            time += dt;
            if (time >= OPENING_DURATION) finish();
        },
        frame(): OpeningFrame | null {
            return time === null ? null : openingFrame(time);
        },
        destroy() {
            controller.abort();
            screen?.remove();
        },
    };
}
