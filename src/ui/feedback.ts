import { translate, type Locale, type Message } from '../i18n';
import type { GameEvent } from '../game/types';
import type { Reaction, Speech } from './types';
import type { GameState } from '../game/game';
import { ART } from '../render/art';
const NPC_COPY = {
    manager: { name: 'person.manager', text: 'npc.manager.leave' },
    cleaner: { name: 'person.kim',     text: 'npc.cleaner.mop' },
    admin:   { name: 'person.admin',   text: 'npc.admin.sort' }
} satisfies Record<string, { name: Message; text: Message }>;
const STAGE_CLEAR: Record<1 | 2 | 3 | 4, { status: Message; title: Message; button: Message }> = {
    1: { status: 'status.stage1Clear', title: 'panel.stage1Title', button: 'button.next' },
    2: { status: 'status.stage2Clear', title: 'panel.stage2Title', button: 'button.next' },
    4: { status: 'status.stage4Clear', title: 'panel.stage4Title', button: 'button.retryStage' },
    3: { status: 'status.stage3Clear', title: 'panel.stage3Title', button: 'button.retryStage' },
};
export function createFeedback(getLocale: () => Locale = () => 'en') {
    let reaction: (Omit<Reaction, 'text'> & { text: Message }) | null = null;
    let speech: (Omit<Speech, 'text' | 'name'> & { text: Message; name: Message }) | null = null;
    let status: Message = 'empty';
    let waterRemarked = false;
    let panel: { k: Message; title: Message; desc: string; button: Message } | null = null;
    function say(text: Message) {
        reaction = { text, face: '', life: 1.8, priority: 1 };
    }
    function npc(text: Message, name: Message, x: number) {
        speech = { text, name, x, life: 3.4 };
    }
    function overlay(k: Message, title: Message, desc = '', button: Message = 'button.retry') {
        reaction = null;
        panel = { k, title, desc, button };
    }
    function receive(event: GameEvent, state: GameState) {
        if (event.type === 'reset') {
            reaction = null;
            speech = null;
            panel = null;
            waterRemarked = false;
            status = state.stage === 2 || state.officeCheckpoint ? 'status.startingCheckpoint' : 'status.starting';
        }
        if (event.type === 'tick' && reaction && (reaction.life -= event.dt) <= 0) {
            reaction = null;
        }
        if (event.type === 'tick' && speech && (speech.life -= event.dt) <= 0) {
            speech = null;
        }
        if (event.type !== 'cue') return;
        if (state.stage === 1) {
            const person = event.person;
            switch (event.id) {
                case 'person-comment':
                    if (person && !speech) npc(NPC_COPY[person.id].text, NPC_COPY[person.id].name, person.x);
                    break;
                case 'reverse-comment':
                    if (person) npc('npc.return', NPC_COPY[person.id].name, person.x);
                    break;
                case 'water-comment':
                    npc('npc.cleaner.spill', NPC_COPY.cleaner.name, 1000);
                    break;
                case 'head-comment':
                    npc('npc.manager.injury', NPC_COPY.manager.name, 320);
                    break;
                case 'bin-comment':
                    npc('npc.admin.injury', NPC_COPY.admin.name, 1810);
                    break;
                case 'light-comment':
                    npc('npc.coworker.bright', 'person.coworker', ART.monitors[event.monitorIndex].x);
                    break;
                case 'first-volley':
                    say('player.firstVolley');
                    break;
                case 'paper-hit':
                    say('player.paperHit');
                    break;
                case 'convoy-bump':
                    say('player.bumpHit');
                    break;
                case 'urgent-volley':
                    say('player.urgentVolley');
                    break;
                case 'bundle-hit':
                    say('player.bundleHit');
                    break;
                case 'light-hit':
                    say('player.lightHit');
                    break;
            }
        }
        switch (event.id) {
            case 'practice-cleared':
                say('player.approved');
                break;
            case 'checkpoint':
                status = 'status.checkpoint';
                break;
            case 'water-spilled':
                if (!waterRemarked) {
                    say('player.laptop');
                    waterRemarked = true;
                }
                break;
            case 'head-hit':
                reaction = null;
                status = 'status.headImpact';
                break;
            case 'head-game-over':
                overlay('panel.headKicker', 'panel.headTitle');
                break;
            case 'bin-fall':
                reaction = null;
                status = 'status.binFall';
                break;
            case 'bin-game-over':
                overlay('panel.binKicker', 'panel.binTitle');
                break;
            case 'lift-game-over':
                overlay('panel.liftKicker', 'panel.liftTitle');
                break;
            case 'focus-lost':
                reaction = null;
                status = 'status.focusLost';
                break;
            case 'focus-game-over':
                overlay('panel.focusKicker', 'panel.focusTitle');
                break;
            case 'extinguisher-pickup':
                status = 'status.extinguisherPickup';
                break;
            case 'stage-clear': {
                const clear = STAGE_CLEAR[state.stage];
                status = clear.status;
                overlay('empty', clear.title, '', clear.button);
                break;
            }
        }
    }
    function snapshot() {
        const t = (message: Message) => translate(message, getLocale());
        return {
            reaction: reaction ? { ...reaction, text: t(reaction.text) } : null,
            speech: speech ? { ...speech, text: t(speech.text), name: t(speech.name) } : null,
            status: t(status),
            panel: panel ? { ...panel, k: t(panel.k), title: t(panel.title), button: t(panel.button) } : null
        };
    }
    return { receive, snapshot };
}
export type FeedbackState = ReturnType<ReturnType<typeof createFeedback>['snapshot']>;
