import type { Game } from '../game/game';
import { bindControls } from './controls';
// Menu buttons, dialog focus and pause syncing. Gameplay keys and touch controls live in ./controls.
// `blocked` (e.g. while a replay plays) hides the pause menu and ignores every live-game control.
export function bindInput(root: HTMLElement, game: Game, { blocked = () => false }: { blocked?: () => boolean } = {}) {
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
        const paused = game.status().mode === 'pause' && !blocked();
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
        if (visiblePanel && !panelOpen && !paused && !blocked() && !document.querySelector?.('.startup-splash')) panel?.querySelector<HTMLButtonElement>('[data-start]')?.focus();
        if (!visiblePanel && panelOpen && panel?.contains(document.activeElement)) pauseButton?.focus();
        panelOpen = visiblePanel;
    }
    function togglePause() {
        if (blocked()) return;
        if (game.status().mode === 'play') returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : pauseButton;
        game.pause();
        syncMenu();
    }
    function button(selector: string, action: () => void) {
        root.querySelector<HTMLElement>(selector)?.addEventListener('click', () => { if (blocked()) return; action(); syncMenu(); }, options);
    }
    button('[data-start]', () => {
        const state = game.status();
        if (state.mode === 'won' && state.stage === 1) game.startStage(2);
        else if (state.mode === 'won' && state.stage === 2) game.startStage(3);
        else game.reset();
    });
    for (const stage of [1, 2, 3, 4] as const) {
        button(`[data-stage="${stage}"]`, () => {
            if (stage <= game.status().completedStage || (stage === 4 && game.status().completedStage >= 3)) game.startStage(stage);
        });
    }
    button('[data-reset]', game.restart);
    button('[data-pause]', togglePause);
    button('[data-resume]', togglePause);
    const accepting = () => root.isConnected && !blocked() && !document.querySelector?.('.startup-splash');
    window.addEventListener('keydown', e => {
        if (e.key !== 'Tab' || !accepting()) return;
        const state = game.status();
        const dialog = state.mode === 'pause' ? menu : panel && !panel.hidden ? panel : null;
        if (!dialog) return;
        const targets = focusable(dialog);
        const first = targets[0], last = targets[targets.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            e.preventDefault(); last?.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
            e.preventDefault(); first?.focus();
        }
    }, options);
    bindControls(root, game, {
        accepting: e => accepting() && !(e.target instanceof Element && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)),
        togglePause,
        afterRestart: syncMenu,
    }, controller.signal);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.status().mode === 'play') togglePause();
    }, options);
    const observer = new MutationObserver(() => {
        if ((game.status().mode === 'pause' && !blocked()) !== menuOpen || (!!panel && !panel.hidden) !== panelOpen) syncMenu();
    });
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    queueMicrotask(syncMenu);
    return Object.assign(() => { controller.abort(); observer.disconnect(); }, { sync: syncMenu });
}
