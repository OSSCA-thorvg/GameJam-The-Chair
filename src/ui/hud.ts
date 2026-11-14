import { translate, type Locale, type Message } from '../i18n';
import type { GameState } from '../game/game';
import type { Mode } from '../game/types';
import type { FeedbackState } from './feedback';
import type { EffectsState } from '../render/effects';
export function createHud(root: HTMLElement, getLocale: () => Locale = () => 'en') {
    const q = (selector: string) => root.querySelector<HTMLElement>(selector);
    const text = (selector: string, value: string) => {
        const el = q(selector);
        if (el && el.textContent !== value) el.textContent = value;
    };
    const hidden = (selector: string, value: boolean) => {
        const el = q(selector);
        if (el) el.hidden = value;
    };
    const style = (selector: string, key: string, value: string) => q(selector)?.style.setProperty(key, value);
    let previousMode: Mode = 'intro';
    let lastStage = 1;
    let lastTime = 0;
    let previousFocus = 100;
    let focusIntroduced = false;
    let introduceUntil = 0;
    // `cutscene`: the opening is playing over a fresh game, so every game HUD element stays out of the way.
    function draw(state: GameState, feedback: FeedbackState, effects: EffectsState, cutscene = false) {
        const t = (message: Message) => translate(message, getLocale());
        const { mode, focus } = state;
        const active = mode === 'play' && !cutscene;
        // The stage four turn into 3D and the stage five ending (parked in the Earth's shadow) play without HUD.
        const ending = (state.stage === 4 && (state.sky.phase === 'reveal' || state.sky.phase === 'depth'))
            || (state.stage === 5 && state.orbit?.phase === 'parked');
        const paused = mode === 'pause';
        if (state.stage !== lastStage || state.time < lastTime) {
            focusIntroduced = false;
            introduceUntil = 0;
            previousFocus = 100;
        }
        if (focus < previousFocus && !focusIntroduced) {
            focusIntroduced = true;
            introduceUntil = state.time + 2.8;
        }
        previousFocus = focus;
        lastStage = state.stage;
        lastTime = state.time;
        hidden('[data-play-hud]', mode === 'intro' || ending || cutscene);
        hidden('.drive-controls', ending || cutscene);
        hidden('[data-pause]', !active && !paused);
        hidden('[data-pause-menu]', !paused);
        q('[data-pause]')?.setAttribute('aria-expanded', String(paused));
        hidden('[data-focus-intro]', !active || !focusIntroduced || state.time > introduceUntil);
        style('[data-focus-fill]', 'width', focus + '%');
        style('[data-focus-trail]', 'width', focus + '%');
        style('[data-focus-fill]', 'background', focus <= 20 ? '#d88e7e' : '#d2b783');
        hidden('[data-focus-alert]', !(active && state.stage === 1 && state.focusNotice));
        q('[data-play-hud]')?.classList.toggle('critical', active && focus <= 20);
        q('[data-play-hud]')?.classList.toggle('hit', active && !!state.focusNotice && state.focusNotice.life > 1.25);
        q('[data-focus-meter]')?.setAttribute('aria-valuenow', String(focus));
        text('[data-focus]', focus + '%');
        text('[data-status]', feedback.status);
        hidden('[data-interact]', state.stage !== 2);
        hidden('[data-orbit-controls]', state.stage !== 5);
        hidden('[data-orbit-help]', state.stage !== 5);
        hidden('[data-jump]', state.stage === 5);
        hidden('.balance-controls', state.stage === 5);
        hidden('[data-meeting-help]', state.stage !== 2);
        // In stage five the extinguisher fires on its own.
        hidden('[data-spray-help]', !state.hasExtinguisher || state.stage === 5);
        hidden('[data-spray]', !state.hasExtinguisher || state.stage === 5);
        hidden('[data-stage-menu]', state.completedStage === 0);
        for (const stage of [1, 2, 3, 4, 5]) {
            hidden(`[data-stage="${stage}"]`, stage >= 4 ? state.completedStage < stage - 1 : stage > state.completedStage);
        }
        const panel = feedback.panel;
        // The game-over panel waits until the end-of-run close-up has eased back to the usual framing.
        const closeUp = !!effects.deathShot && !effects.deathShot.done;
        hidden('[data-overlay]', cutscene || closeUp || (mode !== 'intro' && !panel));
        // On the title screen the scene draws the title and the start sign; the DOM keeps them for input and readers.
        q('[data-overlay]')?.classList.toggle('title-screen', mode === 'intro' && state.stage === 1 && !cutscene);
        if (mode === 'intro') {
            text('[data-title]', 'THE CHAIR');
            text('[data-desc]', t('intro.desc'));
            text('[data-start]', t('button.start'));
            hidden('[data-kicker]', true);
        } else if (panel) {
            text('[data-kicker]', panel.k);
            hidden('[data-kicker]', !panel.k);
            text('[data-title]', panel.title);
            text('[data-desc]', panel.desc);
            hidden('[data-desc]', !panel.desc);
            text('[data-start]', panel.button);
        }
        if (mode === 'won' && previousMode !== 'won') {
            const stats = root.querySelector<HTMLDetailsElement>('[data-stats]');
            if (stats) stats.open = false;
        }
        previousMode = mode;
        hidden('[data-stats]', mode !== 'won');
        text('[data-stats-text]', `${t('hud.focus')} ${focus}% · ${t('stats.paper')} ${state.paperHits} · ${t('stats.bin')} ${state.binFalls} · ${t('stats.light')} ${state.lightHits}${state.stage === 2 ? '' : ` · ${t('stats.door')} ${state.doorHits}`}`);
        q('.drive-controls')?.toggleAttribute('inert', !active);
    }
    return { draw };
}
