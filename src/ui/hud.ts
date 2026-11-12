import { translate, type Locale, type Message } from '../i18n';
import type { GameState } from '../game/game';
import type { Mode } from '../game/types';
import type { FeedbackState } from './feedback';
import type { EffectsState } from '../render/effects';
import type { Viewport } from '../render/renderer';
import { LEVEL } from '../game/level';
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
    function draw(state: GameState, feedback: FeedbackState, _effects: EffectsState, view: Viewport) {
        const t = (message: Message) => translate(message, getLocale());
        const { player: p, mode, focus } = state;
        const { cam, scale, vertical, width } = view;
        const active = mode === 'play';
        const ending = state.stage === 4 && (state.sky.phase === 'reveal' || state.sky.phase === 'depth');
        const paused = mode === 'pause';
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
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
        hidden('[data-play-hud]', mode === 'intro' || ending);
        hidden('.drive-controls', ending);
        hidden('[data-pause]', !active && !paused);
        hidden('[data-pause-menu]', !paused);
        q('[data-pause]')?.setAttribute('aria-expanded', String(paused));
        hidden('[data-stage-label]', !active || state.time > 2.2);
        text('[data-stage-label]', t(state.stage === 1 ? 'stageLabel.stage1' : state.stage === 2 ? 'stageLabel.stage2' : state.stage === 3 ? 'stageLabel.stage3' : 'stageLabel.stage4'));
        hidden('[data-focus-intro]', !active || !focusIntroduced || state.time > introduceUntil);
        style('[data-focus-fill]', 'width', focus + '%');
        style('[data-focus-trail]', 'width', focus + '%');
        style('[data-focus-fill]', 'background', focus <= 20 ? '#d88e7e' : '#d2b783');
        q('[data-play-hud]')?.classList.toggle('hit', active && !!state.focusNotice && state.focusNotice.life > 1.25);
        q('[data-focus-meter]')?.setAttribute('aria-valuenow', String(focus));
        text('[data-focus]', focus + '%');
        text('[data-status]', feedback.status);
        hidden('[data-interact]', state.stage !== 2);
        hidden('[data-meeting-help]', state.stage !== 2);
        hidden('[data-spray-help]', !state.hasExtinguisher);
        hidden('[data-spray]', !state.hasExtinguisher);
        hidden('[data-stage-menu]', state.completedStage === 0);
        for (const stage of [1, 2, 3, 4]) {
            hidden(`[data-stage="${stage}"]`, stage === 4 ? state.completedStage < 3 : stage > state.completedStage);
        }
        const panel = feedback.panel;
        hidden('[data-overlay]', mode !== 'intro' && !panel);
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
        hidden('[data-rider]', !active || state.stage === 2 || !feedback.reaction);
        if (feedback.reaction) {
            text('[data-quote]', feedback.reaction.text);
            const halfWidth = (q('[data-rider]')?.offsetWidth ?? 0) / 2 + 10;
            style('[data-rider]', 'left', clamp((p.x - cam) * scale, halfWidth, width - halfWidth) + 'px');
            style('[data-rider]', 'top', Math.max(110, (p.y - 110 + vertical) * scale) + 'px');
        }
        const speech = feedback.speech;
        const speechX = speech ? (speech.x - cam) * scale : 0;
        const speaking = state.stage === 1 && !!speech && ['play', 'impact', 'dead'].includes(mode)
            && speechX > 0 && speechX < width;
        hidden('[data-npc]', !speaking);
        if (speaking && speech) {
            text('[data-name]', speech.name);
            text('[data-line]', speech.text);
            const bubble = q('[data-npc]');
            const halfWidth = (bubble?.offsetWidth ?? 0) / 2 + 10;
            const left = clamp(speechX, halfWidth, width - halfWidth);
            style('[data-npc]', 'left', left + 'px');
            style('[data-npc]', '--tail-x', (speechX - left + (bubble?.offsetWidth ?? 0) / 2) + 'px');
            style('[data-npc]', 'top', mode === 'dead' ? '105px' : Math.max(110, (LEVEL.floor - 177 + vertical) * scale) + 'px');
        }
        q('.drive-controls')?.toggleAttribute('inert', !active);
    }
    return { draw };
}
