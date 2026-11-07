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
        const GOAL = state.level.goal;
        text('[data-stage-label]', `THE CHAIR · STAGE 0${state.stage}`);
        text('[data-stage-title]', state.stage === 1 ? '01 · 사무실 탈출' : '02 · 회의실과 건물 내부');
        text('[data-reset]', state.stage === 2 ? '체크포인트 R' : '재시작 R');
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
        if (state.stage === 2) {
            text('[data-hint]', p.x < 620 ? '의자끼리 쿵! 밀어서 길을 만드세요' : p.x < 900 ? (state.door.open ? '초록불 → 회전문 통과!' : '↻ 회전 중 · 넓은 바닥에서 기다려요') : p.x < 1950 ? '비상계단 · ↓ 제동으로 속도 조절' : p.x < 2350 ? '서랍을 오른쪽으로 밀고, 올라서서 환풍구로 점프!' : p.x < 2700 ? '깃발에 저장 완료 · 움직이는 발판을 기다려요' : p.x < 3400 ? '놓쳐도 괜찮아요 · 아래 경사로로 복귀 ↗' : '기계실 도착! 회사원은 여전히 업무 중');
            text('[data-focus-note]', `체크포인트 ${state.checkpoint}/4 · 실패하면 깃발에서 재개`);
            text('.help', '← → / A D 이동 · Space / ↑ 점프 · Q E 균형 · ↓ / S 제동 · R 체크포인트 · P 정지');
        } else text('.help', '← → / A D 전후진 · Space / ↑ 점프 · Q E 균형 · ↓ / S 제동 · 휴지통은 점프로 피하세요 · R 재시작 · P 정지');
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
