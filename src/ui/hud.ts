import { isStageUnlocked } from '../game/progression';
import { translate } from '../i18n';
import { STAGE_PRESENTATION, hideStageHud } from '../presentation/stages';

import type { GameSnapshot } from '../game/snapshot';
import type { Locale, Message } from '../i18n';
import type { FeedbackState } from './feedback';
import type { Mode } from '../game/types';
import type { EffectsState } from '../render/effects';
export function createHud(
    root: HTMLElement,
    getLocale: () => Locale = () => 'en',
): {
    draw: (
        state: GameSnapshot,
        feedback: FeedbackState,
        effects: EffectsState,
        cutscene?: boolean,
    ) => void;
} {
    return new HudRuntime(root, getLocale).api();
}
class HudRuntime {
    private root!: HTMLElement;
    private getLocale!: () => Locale;
    private q: (selector: string) => HTMLElement | null = (
        selector: string,
    ) => {
        return this.root.querySelector<HTMLElement>(selector);
    };
    private text: (selector: string, value: string) => void = (
        selector: string,
        value: string,
    ) => {
        const el = this.q(selector);
        if (el && el.textContent !== value) {
            el.textContent = value;
        }
    };
    private hidden: (selector: string, value: boolean) => void = (
        selector: string,
        value: boolean,
    ) => {
        const el = this.q(selector);
        if (el) {
            el.hidden = value;
        }
    };
    private style: (
        selector: string,
        key: string,
        value: string,
    ) => void | undefined = (selector: string, key: string, value: string) => {
        return this.q(selector)?.style.setProperty(key, value);
    };
    private previousMode!: Mode;
    private lastStage!: number;
    private lastTime!: number;
    private previousFocus!: number;
    private focusIntroduced!: boolean;
    private introduceUntil!: number;
    constructor(root: HTMLElement, getLocale: () => Locale) {
        this.root = root;
        this.getLocale = getLocale;
        this.previousMode = 'intro';
        this.lastStage = 1;
        this.lastTime = 0;
        this.previousFocus = 100;
        this.focusIntroduced = false;
        this.introduceUntil = 0;
    }
    private draw = (
        state: GameSnapshot,
        feedback: FeedbackState,
        effects: EffectsState,
        cutscene = false,
    ) => {
        const active = this.updateHud(state, cutscene, feedback, effects);
        this.q('.drive-controls')?.toggleAttribute('inert', !active);
    };
    private updateHud(
        state: GameSnapshot,
        cutscene: boolean,
        feedback: FeedbackState,
        effects: EffectsState,
    ) {
        const t = (message: Message) => translate(message, this.getLocale());
        const { mode, focus } = state;
        const active = mode === 'play' && !cutscene;
        const policy = STAGE_PRESENTATION[state.stage];
        const ending = hideStageHud(state);
        const paused = mode === 'pause';
        this.updateFocusIntro(state);
        this.hidden('[data-play-hud]', mode === 'intro' || ending || cutscene);
        this.hidden('.drive-controls', ending || cutscene);
        this.hidden('[data-pause]', !active && !paused);
        this.hidden('[data-pause-menu]', !paused);
        this.q('[data-pause]')?.setAttribute('aria-expanded', String(paused));
        this.drawFocusMeter(state, active);
        this.drawControlLabels(focus, feedback, policy, state);
        for (const stage of [1, 2, 3, 4, 5]) {
            this.hidden(
                `[data-stage="${stage}"]`,
                !isStageUnlocked(stage, state.completedStage),
            );
        }
        this.drawOverlay(feedback, effects, cutscene, mode, {
            state,
            t,
        });
        if (mode === 'won' && this.previousMode !== 'won') {
            const stats =
                this.root.querySelector<HTMLDetailsElement>('[data-stats]');
            if (stats) {
                stats.open = false;
            }
        }
        this.previousMode = mode;
        this.hidden('[data-stats]', mode !== 'won');
        this.text(
            '[data-stats-text]',
            `${t('hud.focus')} ${focus}% · ${t('stats.paper')} ${state.paperHits} · ${t('stats.bin')} ${state.binFalls} · ${t('stats.light')} ${state.lightHits}${state.stage === 2 ? '' : ` · ${t('stats.door')} ${state.doorHits}`}`,
        );
        return active;
    }
    private drawControlLabels(
        focus: number,
        feedback: FeedbackState,
        policy: (typeof STAGE_PRESENTATION)[GameSnapshot['stage']],
        state: GameSnapshot,
    ) {
        this.q('[data-focus-meter]')?.setAttribute(
            'aria-valuenow',
            String(focus),
        );
        this.text('[data-focus]', focus + '%');
        this.text('[data-status]', feedback.status);
        this.hidden('[data-interact]', !policy.controls.meeting);
        this.hidden('[data-orbit-controls]', !policy.controls.flight);
        this.hidden('[data-orbit-help]', !policy.controls.flight);
        this.hidden('[data-jump]', !policy.hud.jump);
        this.hidden('.balance-controls', !policy.hud.balance);
        this.hidden('[data-meeting-help]', !policy.controls.meeting);
        this.hidden(
            '[data-spray-help]',
            !state.hasExtinguisher || !policy.hud.manualSpray,
        );
        this.hidden(
            '[data-spray]',
            !state.hasExtinguisher || !policy.hud.manualSpray,
        );
        this.hidden('[data-stage-menu]', state.completedStage === 0);
    }
    private drawOverlay(
        feedback: FeedbackState,
        effects: EffectsState,
        cutscene: boolean,
        mode: string,
        {
            state,
            t,
        }: {
            state: GameSnapshot;
            t: (message: Message) => string;
        },
    ) {
        const panel = feedback.panel;
        this.updateOverlayContent(effects, cutscene, mode, panel, {
            state,
            t,
        });
    }
    private updateOverlayContent(
        effects: EffectsState,
        cutscene: boolean,
        mode: string,
        panel: {
            k: string;
            title: string;
            button: string;
            desc: string;
        } | null,
        {
            state,
            t,
        }: {
            state: GameSnapshot;
            t: (message: Message) => string;
        },
    ) {
        const closeUp = !!effects.deathShot && !effects.deathShot.done;
        this.hidden(
            '[data-overlay]',
            cutscene || closeUp || (mode !== 'intro' && !panel),
        );
        this.q('[data-overlay]')?.classList.toggle(
            'title-screen',
            mode === 'intro' && state.stage === 1 && !cutscene,
        );
        if (mode === 'intro') {
            this.text('[data-title]', 'THE CHAIR');
            this.text('[data-desc]', t('intro.desc'));
            this.text('[data-start]', t('button.start'));
            this.hidden('[data-kicker]', true);
        } else if (panel) {
            this.text('[data-kicker]', panel.k);
            this.hidden('[data-kicker]', !panel.k);
            this.text('[data-title]', panel.title);
            this.text('[data-desc]', panel.desc);
            this.hidden('[data-desc]', !panel.desc);
            this.text('[data-start]', panel.button);
        }
    }
    api(): {
        draw: (
            state: GameSnapshot,
            feedback: FeedbackState,
            effects: EffectsState,
            cutscene?: boolean,
        ) => void;
    } {
        return { draw: this.draw };
    }
    private drawFocusMeter(state: GameSnapshot, active: boolean) {
        const focus = state.focus;
        const policy = STAGE_PRESENTATION[state.stage];
        this.hidden(
            '[data-focus-intro]',
            !active ||
                !this.focusIntroduced ||
                state.time > this.introduceUntil,
        );
        this.style('[data-focus-fill]', 'width', focus + '%');
        this.style('[data-focus-trail]', 'width', focus + '%');
        this.style(
            '[data-focus-fill]',
            'background',
            focus <= 20 ? '#d88e7e' : '#d2b783',
        );
        this.hidden(
            '[data-focus-alert]',
            !(active && policy.hud.focusAlert && state.focusNotice),
        );
        this.q('[data-play-hud]')?.classList.toggle(
            'critical',
            active && focus <= 20,
        );
        this.q('[data-play-hud]')?.classList.toggle(
            'hit',
            active && !!state.focusNotice && state.focusNotice.life > 1.25,
        );
    }
    private updateFocusIntro(state: GameSnapshot) {
        const focus = state.focus;
        if (state.stage !== this.lastStage || state.time < this.lastTime) {
            this.focusIntroduced = false;
            this.introduceUntil = 0;
            this.previousFocus = 100;
        }
        if (focus < this.previousFocus && !this.focusIntroduced) {
            this.focusIntroduced = true;
            this.introduceUntil = state.time + 2.8;
        }
        this.previousFocus = focus;
        this.lastStage = state.stage;
        this.lastTime = state.time;
    }
}
