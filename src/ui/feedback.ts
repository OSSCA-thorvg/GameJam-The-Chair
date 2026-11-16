import { translate } from '../i18n';
import { REACTION_LIFE, SPEECH_LIFE } from './types';
import { ART } from '../render/art';

import type { Locale, Message } from '../i18n';
import type { Reaction, Speech } from './types';
import type { GameSnapshot } from '../game/game';
import type { GameEvent } from '../game/types';
const NPC_COPY = {
    manager: { name: 'person.manager', text: 'npc.manager.leave' },
    cleaner: { name: 'person.kim', text: 'npc.cleaner.mop' },
    admin: { name: 'person.admin', text: 'npc.admin.sort' },
} satisfies Record<
    string,
    {
        name: Message;
        text: Message;
    }
>;
const STAGE_CLEAR: Record<
    1 | 2 | 3 | 4 | 5,
    {
        status: Message;
        title: Message;
        button: Message;
    }
> = {
    1: {
        status: 'status.stage1Clear',
        title: 'panel.stage1Title',
        button: 'button.next',
    },
    2: {
        status: 'status.stage2Clear',
        title: 'panel.stage2Title',
        button: 'button.next',
    },
    5: {
        status: 'orbit.parked',
        title: 'orbit.parked',
        button: 'button.retryStage',
    },
    4: {
        status: 'status.stage4Clear',
        title: 'panel.stage4Title',
        button: 'button.retryStage',
    },
    3: {
        status: 'status.stage3Clear',
        title: 'panel.stage3Title',
        button: 'button.retryStage',
    },
};
export function createFeedback(getLocale: () => Locale = () => 'en'): {
    receive: (event: GameEvent, state: GameSnapshot) => void;
    snapshot: () => {
        reaction: {
            text: string;
            life: number;
            face: string;
            priority: number;
        } | null;
        speech: {
            text: string;
            name: string;
            x: number;
            life: number;
        } | null;
        status: string;
        panel: {
            k: string;
            title: string;
            button: string;
            desc: string;
        } | null;
    };
} {
    return new FeedbackRuntime(getLocale).api();
}
export type FeedbackState = ReturnType<
    ReturnType<typeof createFeedback>['snapshot']
>;
class FeedbackRuntime {
    private getLocale!: () => Locale;
    private reaction!:
        | (Omit<Reaction, 'text'> & {
              text: Message;
          })
        | null;
    private speech!:
        | (Omit<Speech, 'text' | 'name'> & {
              text: Message;
              name: Message;
          })
        | null;
    private status!: Message;
    private waterRemarked!: boolean;
    private panel!: {
        k: Message;
        title: Message;
        desc: string;
        button: Message;
    } | null;
    constructor(getLocale: () => Locale) {
        this.getLocale = getLocale;
        this.reaction = null;
        this.speech = null;
        this.status = 'empty';
        this.waterRemarked = false;
        this.panel = null;
    }
    private say = (text: Message) => {
        this.reaction = { text, face: '', life: REACTION_LIFE, priority: 1 };
    };
    private npc = (text: Message, name: Message, x: number) => {
        this.speech = { text, name, x, life: SPEECH_LIFE };
    };
    private overlay = (
        k: Message,
        title: Message,
        desc = '',
        button: Message = 'button.retry',
    ) => {
        this.reaction = null;
        this.panel = { k, title, desc, button };
    };
    private receive = (event: GameEvent, state: GameSnapshot) => {
        if (event.type === 'reset') {
            this.reaction = null;
            this.speech = null;
            this.panel = null;
            this.waterRemarked = false;
            this.status =
                state.stage === 2 || state.officeCheckpoint
                    ? 'status.startingCheckpoint'
                    : 'status.starting';
        }
        this.advanceFeedbackTimers(event);
        if (event.type !== 'cue') {
            return;
        }
        if (state.stage === 1) {
            this.receiveOfficeCue(event);
        }
        this.receiveSharedCue(event, state);
    };
    private receiveOfficeCue(event: CueEvent) {
        const person = event.person;
        if (event.id === 'person-comment' && person && !this.speech) {
            this.npc(
                NPC_COPY[person.id].text,
                NPC_COPY[person.id].name,
                person.x,
            );
        } else if (event.id === 'reverse-comment' && person) {
            this.npc('npc.return', NPC_COPY[person.id].name, person.x);
        } else if (event.id === 'light-comment') {
            this.npc(
                'npc.coworker.bright',
                'person.coworker',
                ART.monitors[event.monitorIndex].x,
            );
        }
        const remark = OFFICE_REMARKS[event.id];
        if (remark) {
            this.npc(remark.text, remark.name, remark.x);
        }
        const reaction = OFFICE_REACTIONS[event.id];
        if (reaction) {
            this.say(reaction);
        }
    }
    private receiveSharedCue(event: CueEvent, state: GameSnapshot) {
        const status = CUE_STATUS[event.id];
        if (status) {
            this.status = status;
        }
        const panel = CUE_PANELS[event.id];
        if (panel) {
            this.overlay(panel.k, panel.title);
        }
        if (['head-hit', 'bin-fall', 'focus-lost'].includes(event.id)) {
            this.reaction = null;
        }
        if (event.id === 'practice-cleared') {
            this.say('player.approved');
        }
        if (event.id === 'water-spilled' && !this.waterRemarked) {
            this.say('player.laptop');
            this.waterRemarked = true;
        }
        if (event.id === 'stage-clear') {
            const clear = STAGE_CLEAR[state.stage];
            this.status = clear.status;
            this.overlay('empty', clear.title, '', clear.button);
        }
    }
    private snapshot = () => {
        const t = (message: Message) => translate(message, this.getLocale());
        return {
            reaction: this.reaction
                ? { ...this.reaction, text: t(this.reaction.text) }
                : null,
            speech: this.speech
                ? {
                      ...this.speech,
                      text: t(this.speech.text),
                      name: t(this.speech.name),
                  }
                : null,
            status: t(this.status),
            panel: this.panel
                ? {
                      ...this.panel,
                      k: t(this.panel.k),
                      title: t(this.panel.title),
                      button: t(this.panel.button),
                  }
                : null,
        };
    };
    private advanceFeedbackTimers(event: GameEvent) {
        if (
            event.type === 'tick' &&
            this.reaction &&
            (this.reaction.life -= event.dt) <= 0
        ) {
            this.reaction = null;
        }
        if (
            event.type === 'tick' &&
            this.speech &&
            (this.speech.life -= event.dt) <= 0
        ) {
            this.speech = null;
        }
    }
    api(): {
        receive: (event: GameEvent, state: GameSnapshot) => void;
        snapshot: () => {
            reaction: {
                text: string;
                life: number;
                face: string;
                priority: number;
            } | null;
            speech: {
                text: string;
                name: string;
                x: number;
                life: number;
            } | null;
            status: string;
            panel: {
                k: string;
                title: string;
                button: string;
                desc: string;
            } | null;
        };
    } {
        return { receive: this.receive, snapshot: this.snapshot };
    }
}
type CueEvent = Extract<
    GameEvent,
    {
        type: 'cue';
    }
>;
type CueId = CueEvent['id'];
const OFFICE_REMARKS: Partial<
    Record<
        CueId,
        {
            text: Message;
            name: Message;
            x: number;
        }
    >
> = {
    'water-comment': {
        text: 'npc.cleaner.spill',
        name: NPC_COPY.cleaner.name,
        x: 1000,
    },
    'head-comment': {
        text: 'npc.manager.injury',
        name: NPC_COPY.manager.name,
        x: 320,
    },
    'bin-comment': {
        text: 'npc.admin.injury',
        name: NPC_COPY.admin.name,
        x: 1810,
    },
};
const OFFICE_REACTIONS: Partial<Record<CueId, Message>> = {
    'first-volley': 'player.firstVolley',
    'paper-hit': 'player.paperHit',
    'convoy-bump': 'player.bumpHit',
    'urgent-volley': 'player.urgentVolley',
    'bundle-hit': 'player.bundleHit',
    'light-hit': 'player.lightHit',
};
const CUE_STATUS: Partial<Record<CueId, Message>> = {
    checkpoint: 'status.checkpoint',
    'head-hit': 'status.headImpact',
    'bin-fall': 'status.binFall',
    'focus-lost': 'status.focusLost',
    'extinguisher-pickup': 'status.extinguisherPickup',
};
const CUE_PANELS: Partial<
    Record<
        CueId,
        {
            k: Message;
            title: Message;
        }
    >
> = {
    'head-game-over': { k: 'panel.headKicker', title: 'panel.headTitle' },
    'bin-game-over': { k: 'panel.binKicker', title: 'panel.binTitle' },
    'lift-game-over': { k: 'panel.liftKicker', title: 'panel.liftTitle' },
    'focus-game-over': { k: 'panel.focusKicker', title: 'panel.focusTitle' },
};
