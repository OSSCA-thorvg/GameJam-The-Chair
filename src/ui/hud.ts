import type { GameState } from '../game/game';
import type { FeedbackState } from './feedback';
import type { EffectsState } from '../render/effects';
import type { Viewport } from '../render/renderer';
export function createHud(root: HTMLElement) {
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
    let previousMode = 'intro';
    let lastStage = 1;
    let lastTime = 0;
    let previousFocus = 100;
    let focusIntroduced = false;
    let introduceUntil = 0;
    function draw(state: GameState, feedback: FeedbackState, _effects: EffectsState, view: Viewport, renderer: string) {
        const { player: p, mode, focus, lessons } = state;
        const { cam, scale, vertical, width } = view;
        const active = mode === 'play';
        const paused = mode === 'pause';
        const touch = matchMedia('(pointer: coarse), (max-width: 650px)').matches;
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
        hidden('[data-play-hud]', mode === 'intro');
        hidden('[data-pause]', !active && !paused);
        hidden('[data-pause-menu]', !paused);
        q('[data-pause]')?.setAttribute('aria-expanded', String(paused));
        hidden('[data-stage-label]', !active || state.time > 2.2);
        text('[data-stage-label]', state.stage === 1 ? '01 사무실' : '02 건물 내부');
        hidden('[data-focus-intro]', !active || !focusIntroduced || state.time > introduceUntil);
        style('[data-focus-fill]', 'width', focus + '%');
        style('[data-focus-trail]', 'width', focus + '%');
        style('[data-focus-fill]', 'background', focus <= 20 ? '#d88e7e' : '#d2b783');
        q('[data-play-hud]')?.classList.toggle('hit', active && !!state.focusNotice && state.focusNotice.life > 1.25);
        q('[data-focus-meter]')?.setAttribute('aria-valuenow', String(focus));
        text('[data-focus]', focus + '%');
        text('[data-status]', feedback.status);
        text('[data-renderer]', renderer === 'thorvg' ? 'ThorVG WebCanvas' : 'Canvas2D');
        text('[data-speed]', String(Math.round(state.actualSpeed / 6)));
        text('[data-body]', `위치 ${Math.round(p.x)}, ${Math.round(p.y)}`);
        const panel = feedback.panel;
        hidden('[data-overlay]', mode !== 'intro' && !panel);
        if (mode === 'intro') {
            text('[data-title]', 'THE CHAIR');
            text('[data-desc]', '오늘도 정상 근무 중입니다.');
            text('[data-start]', '시작');
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
        text('[data-stats-text]', `집중도 ${focus}% · 종이 ${state.paperHits} · 휴지통 ${state.binFalls} · 빛 ${state.lightHits} · 회전문 ${state.doorHits}`);
        let cue = '';
        let cueX = p.x;
        let cueY = p.y - 115;
        let suggested = '';
        if (active) {
            if (state.balanceHint) {
                suggested = state.balanceHint;
                cue = state.balanceHint === 'q' ? (touch ? '↶' : 'Q ↶') : (touch ? '↷' : 'E ↷');
            } else if (!lessons.moved && p.x < 300) {
                cue = '→';
                suggested = 'right';
            } else if (!lessons.jumped && p.x > 155 && p.x < 300) {
                cue = '↑';
                suggested = 'jump';
                cueX = 225;
                cueY = 365;
            } else if (state.stage === 1 && !lessons.binJumped && p.x > 1400 && p.x < 1570) {
                cue = '↑';
                suggested = 'jump';
                cueX = 1510;
                cueY = 365;
            } else if (state.stage === 2 && !lessons.braked && p.x > 880 && p.x < 1020) {
                cue = '↓';
                suggested = 'brake';
                cueX = 980;
                cueY = 365;
            }
        }
        hidden('[data-balance]', !cue);
        text('[data-balance]', cue);
        style('[data-balance]', 'left', clamp((cueX - cam) * scale, 40, width - 40) + 'px');
        style('[data-balance]', 'top', Math.max(95, (cueY + vertical) * scale) + 'px');
        for (const key of ['left', 'right', 'brake', 'q', 'e']) {
            q(`[data-key="${key}"]`)?.classList.toggle('suggested', active && suggested === key);
        }
        q('[data-jump]')?.classList.toggle('suggested', active && suggested === 'jump');
        hidden('[data-rider]', !active || !feedback.reaction || !!cue);
        if (feedback.reaction) {
            text('[data-quote]', feedback.reaction.text);
            style('[data-rider]', 'left', clamp((p.x - cam) * scale, 65, width - 65) + 'px');
            style('[data-rider]', 'top', Math.max(110, (p.y - 110 + vertical) * scale) + 'px');
        }
        q('.drive-controls')?.toggleAttribute('inert', !active);
    }
    return { draw };
}
