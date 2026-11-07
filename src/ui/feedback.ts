import type { GameEvent } from '../game/types';
import type { Reaction, Speech } from './types';
import type { GameState } from '../game/game';
export function createFeedback() {
    let reaction: Reaction | null = null;
    const speech: Speech | null = null;
    let status = '';
    let waterRemarked = false;
    let panel: { k: string; title: string; desc: string; button: string } | null = null;
    function say(text: string) {
        reaction = { text, face: '', life: 1.8, priority: 1 };
    }
    function overlay(k: string, title: string, desc = '', button = '다시') {
        reaction = null;
        panel = { k, title, desc, button };
    }
    function receive(event: GameEvent, state: GameState) {
        if (event.type === 'reset') {
            reaction = null;
            panel = null;
            waterRemarked = false;
            status = state.stage === 2 || state.officeCheckpoint ? '체크포인트에서 시작합니다.' : '시작합니다.';
        }
        if (event.type === 'tick' && reaction && (reaction.life -= event.dt) <= 0) {
            reaction = null;
        }
        if (event.type !== 'cue') return;
        switch (event.id) {
            case 'practice-cleared':
                say('결재 완료');
                break;
            case 'checkpoint':
                status = '체크포인트 저장.';
                break;
            case 'water-spilled':
                if (!waterRemarked) {
                    say('노트북은?!');
                    waterRemarked = true;
                }
                break;
            case 'head-hit':
                reaction = null;
                status = '머리 충돌.';
                break;
            case 'head-game-over':
                overlay('머리 충돌', '머리가 먼저 퇴근했습니다.', Math.sin(state.player.a) >= 0 ? 'Q ↶' : 'E ↷');
                break;
            case 'bin-fall':
                reaction = null;
                status = '휴지통 추락.';
                break;
            case 'bin-game-over':
                overlay('휴지통 추락', '업무와 함께 분리배출.');
                break;
            case 'focus-lost':
                reaction = null;
                status = '집중도 소진.';
                break;
            case 'focus-game-over':
                overlay('집중도 소진', '앗, 여기가 어디지?');
                break;
            case 'stage-clear':
                status = state.stage === 1 ? '사무실 탈출.' : '기계실 도착.';
                overlay('', state.stage === 1 ? '퇴근 처리 중…' : '출장 처리 완료.', '', state.stage === 1 ? '다음' : '다시');
                break;
        }
    }
    return { receive, snapshot: () => ({ reaction, speech, status, panel }) };
}
export type FeedbackState = ReturnType<ReturnType<typeof createFeedback>['snapshot']>;
