const NPC_COPY = {
    manager: { name: '박 과장', text: '벌써 퇴근하는 거야?' },
    cleaner: { name: '김 대리', text: '앗, 청소 물통 넘어간다!' },
    admin: { name: '총무팀', text: '쓰레기 분리배출 부탁드려요.' }
};
import type { GameEvent } from '../game/types';
import type { Reaction, Speech } from './types';
import type { GameState } from '../game/game';
export function createFeedback() {
    let reaction: Reaction | null = null;
    let speech: Speech | null = null;
    let status = '앞으로 가도, 뒤로 가도 정상 근무입니다.';
    let panel: {
        k: string;
        title: string;
        desc: string;
        button: string;
    } | null = null;
    function say(text: string, face = '😵', life = 3.2, priority = 0) {
        if (reaction && reaction.life > 0 && reaction.priority > priority) {
            return;
        }
        reaction = { text, face, life, priority };
        status = text;
    }
    function npc(text: string, name = '박 과장', x = 320) {
        speech = { text, name, x, life: 3.4 };
    }
    function overlay(k: string, title: string, desc: string, button: string) {
        panel = { k, title, desc, button };
    }
    function receive(event: GameEvent, state: GameState) {
        if (event.type === 'reset') {
            reaction = null;
            speech = null;
            panel = null;
            status = '오른쪽 사무실 출입문까지. 아직은 발로 굴러갑니다.';
        }
        if (event.type === 'tick') {
            if (reaction && (reaction.life -= event.dt) <= 0) {
                reaction = null;
            }
            if (speech && (speech.life -= event.dt) <= 0) {
                speech = null;
            }
        }
        if (event.type !== 'cue') {
            return;
        }
        const { bursts, paperHits, binFalls, lightHits, focus } = state;
        const person = event.person;
        const n = person ? { ...person, ...NPC_COPY[person.id] } : undefined;
        switch (event.id) {
            case 'head-hit':
                say('저장… 저장은 했나…!', '😵', 3, 5);
                break;
            case 'head-comment':
                npc('산재 처리는…');
                break;
            case 'head-game-over':
                overlay('GAME OVER · HEAD CONTACT', '머리가 먼저<br>퇴근했습니다.', '더러운 물 위에서는 브레이크도 미끄러워요.<br>공중에서는 Q E로 자세를 맞춰주세요.', '다시 정상 근무 ↻');
                break;
            case 'first-volley':
                say('보고서가 왜 얼굴로 출력돼…', '😳');
                break;
            case 'paper-hit':
                say('이거 이번 달 실적인데…', '😑', 2.6);
                break;
            case 'water-spilled':
                say('노트북 괜찮나?!', '😱', 2.6, 4);
                break;
            case 'water-comment':
                npc('앗! 청소 중이었는데…', '김 대리', 1000);
                break;
            case 'water-followup':
                say('아직 저장 안 했는데… 내 성과 자료!!', '😰', 3.2, 3);
                break;
            case 'bin-fall':
                say('노트북… 아직 저장 안 했는데!!', '😨', 5, 5);
                break;
            case 'bin-comment':
                npc('산재 처리는…', '총무팀', 1810);
                break;
            case 'bin-game-over':
                overlay('GAME OVER · TRASH BIN', '업무와 함께<br>분리배출됐습니다.', '휴지통에 빠지면 게임오버입니다.<br>가장자리 전에 점프해서 건너세요.', '다시 정상 근무 ↻');
                break;
            case 'focus-lost':
                say('앗 언제 여기까지 왔지?!', '😕', 3, 99);
                break;
            case 'focus-game-over':
                overlay('GAME OVER · 집중도 0%', '앗 언제 여기까지 왔지?!', '일에 집중하던 회사원이 드디어 주변을 알아차렸습니다.<br>집중도가 모두 소진되어 게임오버입니다.', '다시 정상 근무 ↻');
                break;
            case 'slipping':
                say('노트북에 물 들어가면… 이번 달 실적은?!', '😰', 3, 1);
                break;
            case 'rolling':
                if (!reaction) {
                    say('흔들려도… 마감은 지켜야지…', '😵');
                }
                break;
            case 'reverse-comment':
                if (n) {
                    npc('다시 출근하는 거야?', n.name, n.x);
                }
                break;
            case 'person-comment':
                if (!speech) {
                    if (n) {
                        npc(n.text, n.name, n.x);
                    }
                }
                break;
            case 'stage-clear':
                overlay('STAGE 01 CLEAR', '사무실 탈출.<br>노트북은 정상 작동.', `복사기 분사 ${bursts}회 · 종이 피격 ${paperHits}회 · 휴지통 ${binFalls}회 · 눈부심 ${lightHits}회 · 집중도 ${focus}%<br>다음 스테이지는 아직 열리지 않았습니다.`, '사무실 다시 굴리기 ↻');
                break;
            case 'light-hit':
                say('눈부셔… 실적 칸이 안 보여!', '😣', 2.7, 2);
                break;
            case 'light-comment':
                npc('밝은 미래가 보이죠?', '옆자리 동료', 2300);
                break;
        }
        if (event.id === 'focus-lost') {
            status = '집중도 0% · 앗 언제 여기까지 왔지?!';
        }
    }
    return { receive, snapshot: () => ({ reaction, speech, status, panel }) };
}
export type FeedbackState = ReturnType<ReturnType<typeof createFeedback>['snapshot']>;
