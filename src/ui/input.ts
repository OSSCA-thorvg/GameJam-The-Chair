import type { Game } from '../game/game';
import type { Input } from '../game/types';
export function bindInput(root: HTMLElement, game: Game) {
    const km: Partial<Record<string, Input>> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', q: 'q', Q: 'q', e: 'e', E: 'e' };
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const menu = root.querySelector<HTMLElement>('[data-pause-menu]');
    const pauseButton = root.querySelector<HTMLButtonElement>('[data-pause]');
    const panel = root.querySelector<HTMLElement>('[data-overlay]');
    let menuOpen = false;
    let panelOpen = false;
    let returnFocus: HTMLElement | null = null;
    function focusable(container: HTMLElement) {
        return [...container.querySelectorAll<HTMLElement>('button:not([disabled]), summary, [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
    }
    function syncMenu() {
        const paused = game.getSnapshot().mode === 'pause';
        if (menu) menu.hidden = !paused;
        pauseButton?.setAttribute('aria-expanded', String(paused));
        if (paused && !menuOpen) {
            menuOpen = true;
            menu?.querySelector<HTMLButtonElement>('[data-resume]')?.focus();
        } else if (!paused && menuOpen) {
            menuOpen = false;
            if (menu?.contains(document.activeElement)) {
                (returnFocus?.isConnected && returnFocus !== document.body && !returnFocus.hidden ? returnFocus : pauseButton)?.focus();
            }
        }
        const visiblePanel = !!panel && !panel.hidden;
        if (visiblePanel && !panelOpen && !paused) panel?.querySelector<HTMLButtonElement>('[data-start]')?.focus();
        if (!visiblePanel && panelOpen && panel?.contains(document.activeElement)) pauseButton?.focus();
        panelOpen = visiblePanel;
    }
    function togglePause() {
        if (game.getSnapshot().mode === 'play') returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : pauseButton;
        game.pause();
        syncMenu();
    }
    function button(selector: string, action: () => void) {
        root.querySelector<HTMLElement>(selector)?.addEventListener('click', () => { action(); syncMenu(); }, options);
    }
    button('[data-start]', () => {
        const state = game.getSnapshot();
        if (state.mode === 'won' && state.stage === 1) game.startStage(2);
        else if (state.mode === 'won' && state.stage === 2) game.startStage(3);
        else game.reset();
    });
    for (const stage of [1, 2, 3] as const) {
        button(`[data-stage="${stage}"]`, () => {
            if (stage <= game.getSnapshot().completedStage) game.startStage(stage);
        });
    }
    button('[data-reset]', game.restart);
    button('[data-pause]', togglePause);
    button('[data-resume]', togglePause);
    window.addEventListener('keydown', e => {
        if (!root.isConnected || (e.target instanceof Element && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
        const state = game.getSnapshot();
        if (e.key === 'Tab') {
            const dialog = state.mode === 'pause' ? menu : panel && !panel.hidden ? panel : null;
            if (dialog) {
                const targets = focusable(dialog);
                const first = targets[0], last = targets[targets.length - 1];
                if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                    e.preventDefault(); last?.focus();
                } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                    e.preventDefault(); first?.focus();
                }
            }
            return;
        }
        if (!e.repeat && (e.key.toLowerCase() === 'p' || e.key === 'Escape')) {
            if (state.mode === 'play' || state.mode === 'pause') {
                e.preventDefault();
                togglePause();
            }
            return;
        }
        if (!e.repeat && e.key.toLowerCase() === 'r' && state.mode !== 'intro') {
            e.preventDefault();
            game.restart();
            syncMenu();
            return;
        }
        if (state.mode !== 'play') return;
        const k = km[e.key];
        if (k || e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (k) game.press(k);
            if (!e.repeat && (e.code === 'Space' || e.key === 'ArrowUp')) game.jump();
            if (!e.repeat && (e.key === 'f' || e.key === 'F')) game.spray();
        }
    }, options);
    window.addEventListener('keyup', e => {
        const key = km[e.key];
        if (key) game.release(key);
    }, options);
    window.addEventListener('blur', game.clearInput, options);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.getSnapshot().mode === 'play') togglePause();
    }, options);
    root.querySelectorAll<HTMLElement>('[data-key]').forEach(button => {
        const key = button.dataset.key;
        if (key !== 'left' && key !== 'right' && key !== 'q' && key !== 'e') return;
        button.addEventListener('pointerdown', e => {
            e.preventDefault();
            game.press(key);
            button.setPointerCapture(e.pointerId);
        }, options);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => game.release(key), options);
    });
    root.querySelector<HTMLElement>('[data-jump]')?.addEventListener('pointerdown', e => { e.preventDefault(); game.jump(); }, options);
    root.querySelector<HTMLElement>('[data-spray]')?.addEventListener('pointerdown', e => { e.preventDefault(); game.spray(); }, options);
    const observer = new MutationObserver(() => {
        if ((game.getSnapshot().mode === 'pause') !== menuOpen || (!!panel && !panel.hidden) !== panelOpen) syncMenu();
    });
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    queueMicrotask(syncMenu);
    return () => { controller.abort(); observer.disconnect(); };
}
