import { translate, type Locale, type Message } from '../i18n';
import type { GameEvent } from '../game/types';
import type { Reaction, Speech } from './types';
import type { GameState } from '../game/game';
import { ART } from '../render/art';
const NPC_COPY = {
    manager: { name: "Manager Park", text: "Leaving already?" },
    cleaner: { name: "Kim", text: "Watch the mop bucket!" },
    admin: { name: "Admin", text: "Please sort your trash." }
} satisfies Record<string, { name: Message; text: Message }>;
export function createFeedback(getLocale: () => Locale = () => 'en') {
    let reaction: (Omit<Reaction, 'text'> & { text: Message }) | null = null;
    let speech: (Omit<Speech, 'text' | 'name'> & { text: Message; name: Message }) | null = null;
    let status: Message = '';
    let waterRemarked = false;
    let panel: { k: Message; title: Message; desc: string; button: Message } | null = null;
    function say(text: Message) {
        reaction = { text, face: '', life: 1.8, priority: 1 };
    }
    function npc(text: Message, name: Message, x: number) {
        speech = { text, name, x, life: 3.4 };
    }
    function overlay(k: Message, title: Message, desc = '', button: Message = 'Retry') {
        reaction = null;
        panel = { k, title, desc, button };
    }
    function receive(event: GameEvent, state: GameState) {
        if (event.type === 'reset') {
            reaction = null;
            speech = null;
            panel = null;
            waterRemarked = false;
            status = state.stage === 2 || state.officeCheckpoint ? "Starting from checkpoint." : "Starting.";
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
                    if (person) npc("Back to work already?", NPC_COPY[person.id].name, person.x);
                    break;
                case 'water-comment':
                    npc("Hey! I was cleaning…", NPC_COPY.cleaner.name, 1000);
                    break;
                case 'head-comment':
                    npc("About that workplace injury claim…", NPC_COPY.manager.name, 320);
                    break;
                case 'bin-comment':
                    npc("About that workplace injury claim…", NPC_COPY.admin.name, 1810);
                    break;
                case 'light-comment':
                    npc("A bright future, right?", "Coworker", ART.monitors[event.monitorIndex].x);
                    break;
                case 'first-volley':
                    say("Why is this report printing into my face…");
                    break;
                case 'paper-hit':
                    say("Those are my monthly results…");
                    break;
                case 'light-hit':
                    say("Too bright… I can't see my numbers!");
                    break;
            }
        }
        switch (event.id) {
            case 'practice-cleared':
                say("Approved");
                break;
            case 'checkpoint':
                status = "Checkpoint saved.";
                break;
            case 'water-spilled':
                if (!waterRemarked) {
                    say("My laptop?!");
                    waterRemarked = true;
                }
                break;
            case 'head-hit':
                reaction = null;
                status = "Head impact.";
                break;
            case 'head-game-over':
                overlay("Head impact", "Your head clocked out first.");
                break;
            case 'bin-fall':
                reaction = null;
                status = "Trash bin fall.";
                break;
            case 'bin-game-over':
                overlay("Trash bin fall", "Recycled along with your work.");
                break;
            case 'focus-lost':
                reaction = null;
                status = "Focus depleted.";
                break;
            case 'focus-game-over': {
                const focusMsgs: Message[] = [
                    "...Why am I even here?",
                    "Wait, where even is this?",
                    "Wait, how far did I go?"
                ];
                overlay("Focus depleted", focusMsgs[Math.floor(Math.random() * focusMsgs.length)]);
                break;
            }
            case 'spray-empty':
                status = "Extinguisher empty.";
                break;
            case 'stage-clear':
                status = state.stage === 1 ? "Office escaped." : state.stage === 2 ? "Mechanical room reached." : "Rooftop cleared.";
                overlay('', state.stage === 1 ? "Clocking out…" : state.stage === 2 ? "Business trip complete." : "Officially resigned.", '', state.stage === 3 ? "Retry stage" : "Next");
                break;
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
