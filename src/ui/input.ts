import type { Game } from '../game/game';
import type { Input } from '../game/types';
// UI controls send commands; they never edit player or collision data.
export function bindInput(root: HTMLElement, game: Game) {
    const km: Partial<Record<string, Input>> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'brake', s: 'brake', S: 'brake', q: 'q', Q: 'q', e: 'e', E: 'e' };
    const controller = new AbortController();
    const options = { signal: controller.signal };
    function button(selector: string, action: () => void) {
        root.querySelector<HTMLElement>(selector)?.addEventListener('click', action, options);
    }
    button('[data-start]', game.reset);
    button('[data-reset]', game.restart);
    button('[data-pause]', game.pause);
    window.addEventListener('keydown', e => {
        if (!root.isConnected || (e.target instanceof Element && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) {
            return;
        }
        const k = km[e.key];
        if (k || e.code === 'Space' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (k) {
                game.press(k);
            }
            if (!e.repeat && (e.code === 'Space' || e.key === 'ArrowUp')) {
                game.jump();
            }
        }
        if (!e.repeat && e.key.toLowerCase() === 'r') {
            game.restart();
        }
        if (!e.repeat && e.key.toLowerCase() === 'p') {
            game.pause();
        }
    }, options);
    window.addEventListener('keyup', e => {
        const k = km[e.key];
        if (k) {
            game.release(k);
        }
    }, options);
    window.addEventListener('blur', game.clearInput, options);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.getSnapshot().mode === 'play') {
            game.pause();
        }
    }, options);
    root.querySelectorAll<HTMLElement>('[data-key]').forEach(b => {
        const key = b.dataset.key as Input;
        if (!Object.values(km).includes(key)) {
            return;
        }
        b.addEventListener('pointerdown', e => {
            e.preventDefault();
            game.press(key);
            b.setPointerCapture(e.pointerId);
        }, options);
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            b.addEventListener(ev, () => game.release(key), options);
        }
    });
    root.querySelector<HTMLElement>('[data-jump]')?.addEventListener('pointerdown', e => {
        e.preventDefault();
        game.jump();
    }, options);
    return () => controller.abort();
}
