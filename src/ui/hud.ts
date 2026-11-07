import { LEVEL } from '../game/level';
import type { GameState } from '../game/game';
import type { FeedbackState } from './feedback';
import type { EffectsState } from '../render/effects';
import type { Viewport } from '../render/renderer';
export function createHud(root: HTMLElement) {
    const q = (s: string) => root.querySelector<HTMLElement>(s);
    const text = (s: string, v: string) => {
        const el = q(s);
        if (el) {
            el.textContent = v;
        }
    };
    const hidden = (s: string, v: boolean) => {
        const el = q(s);
        if (el) {
            el.hidden = v;
        }
    };
    const style = (s: string, k: string, v: string) => {
        const el = q(s);
        if (el) {
            el.style.setProperty(k, v);
        }
    };
    function draw(state: GameState, feedback: FeedbackState, effects: EffectsState, view: Viewport, renderer: string) {
        const { player: p, focus, focusNotice, focusBlocked, lossReason, inBin, dirty, slip, soaked, cleaning, monitor, mode } = state;
        const { reaction, speech, status, panel } = feedback;
        const { glare } = effects;
        const { cam, scale, vertical, width } = view;
        const F = LEVEL.floor;
        const GOAL = LEVEL.goal;
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        text('[data-status]', status);
        text('[data-pause]', mode === 'pause' ? '계속 P' : '일시정지 P');
        text('[data-renderer]', renderer === 'thorvg' ? 'ThorVG WebCanvas' : 'Canvas2D 호환 모드');
        if (mode !== 'intro') {
            hidden('[data-overlay]', !panel);
        }
        if (panel) {
            text('[data-kicker]', panel.k);
            text('[data-start]', panel.button);
            const title = q('[data-title]');
            const desc = q('[data-desc]');
            if (title) {
                title.innerHTML = panel.title;
            }
            if (desc) {
                desc.innerHTML = panel.desc;
            }
        }
        text('[data-focus]', focus + '%');
        style('[data-focus-fill]', 'width', focus + '%');
        style('[data-focus-fill]', 'background', focus <= 20 ? '#d88e7e' : '#d2b783');
        q('[data-focus-meter]')?.setAttribute('aria-valuenow', String(focus));
        text('[data-focus-note]', lossReason === 'focus' ? '집중도 소진 · 게임오버' : focusNotice ? ({ paper: '종이', water: '오물', light: '불빛' }[focusNotice.kind] + ' 방해 −20%') : focusBlocked ? '방해 중 · 회복 대기' : '방해 없으면 2초마다 +1%');
        text('[data-speed]', String(Math.round(Math.abs(p.vx) / 6)));
        text('[data-body]', lossReason === 'focus' ? '집중도 소진' : glare > 0 ? '눈부심 · 잠깐 대기' : inBin ? '휴지통 추락 · 실패' : dirty ? '쓰레기범벅' : slip ? '오수 · 미끄러짐' : soaked ? '물범벅 · 업무 진행' : '정상 근무');
        style('[data-progress]', 'width', clamp(p.x / GOAL * 100, 0, 100) + '%');
        text('[data-hint]', inBin ? '휴지통 추락 · 재시작하세요' : slip ? '미끄러운 바닥 · 제동 거리 증가' : p.x < 720 ? '복사기는 가까이 가면 종이를 뱉어요' : p.x < 1300 ? (cleaning.spilled ? '젖은 바닥 · 미리 감속하세요' : '청소 물통 주의 · 가까이 가면 촤악!') : p.x < 1850 ? '휴지통은 점프로! 빠지면 게임오버' : p.x < 2220 ? (monitor.active ? '모니터 빛이 켜졌어요 · 꺼질 때 통과!' : monitor.warning ? '모니터 빛 예고 · 미리 제동하세요' : '빛이 꺼졌어요 · 지금 통과!') : '조금만 더… 오른쪽 출입문!');
        hidden('[data-rider]', !reaction || !['play', 'impact', 'focuslost'].includes(mode));
        if (reaction) {
            text('[data-face]', reaction.face);
            text('[data-quote]', reaction.text);
        }
        hidden('[data-npc]', true);
        if (speech && mode === 'play') {
            const x = (speech.x - cam) * scale;
            const y = (F - 177 + vertical) * scale;
            if (x > 50 && x < width - 50) {
                hidden('[data-npc]', false);
                style('[data-npc]', 'left', x + 'px');
                style('[data-npc]', 'top', y + 'px');
                text('[data-name]', speech.name);
                text('[data-line]', speech.text);
            }
        }
    }
    return { draw };
}
