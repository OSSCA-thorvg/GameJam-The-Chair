import { createFeedback } from './feedback';
import { buildPersonalBoxTrack, personalBoxAt } from './personal-box-replay';
import { viewState } from '../game/game';
import { FIXED_STEP } from '../game/level';
import { buildTimeline, seekTimeline } from '../game/replay';
import { translate } from '../i18n';
import { createEffects } from '../render/effects';

import type {
    ReplayCursor,
    ReplayFile,
    ReplaySettings,
    Timeline,
} from '../game/replay';
import type { GameSnapshot } from '../game/snapshot';
import type { GameEvent } from '../game/types';
import type { Locale, Message } from '../i18n';
import type { Effects } from '../render/effects';
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const HOLD_SECONDS = 1;
export function createReplayPlayer(
    root: HTMLElement,
    getLocale: () => Locale,
    getSettings: () => ReplaySettings,
    onClose: () => void,
    { closable = true } = {},
): ReplayPlayer {
    return new ReplayPlayerRuntime(
        root,
        getLocale,
        getSettings,
        onClose,
        closable,
    ).api();
}
export type ReplayPlayer = {
    open(file: ReplayFile): Timeline;
    close(): void;
    readonly active: boolean;
    readonly timeline: Timeline | null;
    readonly tick: number;
    readonly state: ReplayCursor['state'] | null;
    readonly playing: boolean;
    seek(tick: number): void;
    setPlaying(value: boolean): void;
    advance(dt: number): void;
    view(): ReturnType<typeof viewState> | null;
    drainEvents(): GameEvent[];
    effects(): ReturnType<ReturnType<typeof createEffects>['snapshot']>;
    feedback(): ReturnType<ReturnType<typeof createFeedback>['snapshot']>;
    destroy(): void;
};
class ReplayPlayerRuntime {
    private root!: HTMLElement;
    private getLocale!: () => Locale;
    private getSettings!: () => ReplaySettings;
    private onClose!: () => void;
    private closable!: boolean;
    private q: <T extends HTMLElement>(selector: string) => T | null = <
        T extends HTMLElement,
    >(
        selector: string,
    ) => {
        return this.root.querySelector<T>(selector);
    };
    private bar!: HTMLElement | null;
    private playButton!: HTMLButtonElement | null;
    private seekInput!: HTMLInputElement | null;
    private speedSelect!: HTMLSelectElement | null;
    private loopButton!: HTMLButtonElement | null;
    private timeLabel!: HTMLElement | null;
    private noteLabel!: HTMLElement | null;
    private markerTrack!: HTMLElement | null;
    private t: (message: Message) => string = (message: Message) => {
        return translate(message, this.getLocale());
    };
    private timeline!: Timeline | null;
    private cursor!: ReplayCursor | null;
    private playing!: boolean;
    private loop!: boolean;
    private speed!: number;
    private acc!: number;
    private hold!: number;
    private heldTick!: number;
    private effects!: Effects;
    private feedback!: {
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
    };
    private pending!: GameEvent[];
    private personalBoxTrack!: ReturnType<typeof buildPersonalBoxTrack>;
    private controller!: AbortController;
    private options!: {
        signal: AbortSignal;
    };
    constructor(
        root: HTMLElement,
        getLocale: () => Locale,
        getSettings: () => ReplaySettings,
        onClose: () => void,
        closable: boolean,
    ) {
        this.root = root;
        this.getLocale = getLocale;
        this.getSettings = getSettings;
        this.onClose = onClose;
        this.closable = closable;
        this.bindPlaybackControls();
        this.q('[data-replay-next]')?.addEventListener(
            'click',
            () => {
                this.setPlaying(false);
                this.stepOnce(true);
                this.sync();
            },
            this.options,
        );
        this.q('[data-replay-exit]')?.addEventListener(
            'click',
            () => this.close(),
            this.options,
        );
        this.loopButton?.addEventListener(
            'click',
            () => {
                this.loop = !this.loop;
                this.sync();
            },
            this.options,
        );
        this.seekInput?.addEventListener(
            'input',
            () => this.seek(Number(this.seekInput?.value)),
            this.options,
        );
        this.speedSelect?.addEventListener(
            'change',
            () => {
                this.speed = Number(this.speedSelect?.value) || 1;
            },
            this.options,
        );
        window.addEventListener(
            'keydown',
            (e) => {
                if (
                    !this.timeline ||
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLSelectElement
                ) {
                    return;
                }
                const handled: Partial<Record<string, () => void>> = {
                    ' ': () => this.playButton?.click(),
                    ArrowLeft: () =>
                        this.q<HTMLButtonElement>(
                            '[data-replay-prev]',
                        )?.click(),
                    ArrowRight: () =>
                        this.q<HTMLButtonElement>(
                            '[data-replay-next]',
                        )?.click(),
                    ...(this.closable ? { Escape: () => this.close() } : {}),
                };
                const action = handled[e.key];
                if (!action) {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                action();
            },
            { ...this.options, capture: true },
        );
    }
    private receive = (events: readonly GameEvent[]) => {
        if (!this.cursor) {
            return;
        }
        const state = this.cursor.state;
        this.effects.observe({
            stage: state.stage,
            deaths: state.deaths,
            time: state.time,
            player: state.p,
            mode: state.mode,
        });
        if (!events.length) {
            return;
        }
        const view = viewState(this.cursor.state);
        for (const event of events) {
            this.effects.receive(event);
            this.feedback.receive(event, view);
        }
        this.pending.push(...events);
    };
    private stepOnce = (manual = false): boolean => {
        try {
            return this.advanceCursor(manual);
        } catch {
            return false;
        }
    };
    private advanceCursor = (manual: boolean): boolean => {
        if (!this.cursor) {
            return false;
        }
        while (this.cursor.pending() === 'command') {
            const mode = this.cursor.state.mode;
            if (
                !manual &&
                (mode === 'dead' || mode === 'won') &&
                this.heldTick !== this.cursor.state.tick
            ) {
                this.heldTick = this.cursor.state.tick;
                this.hold = HOLD_SECONDS;
                return true;
            }
            this.receive(this.cursor.next() ?? []);
        }
        const events = this.cursor.next();
        if (!events) {
            return false;
        }
        this.receive(events);
        return true;
    };
    private seek = (tick: number) => {
        if (!this.timeline) {
            return;
        }
        const target = Math.max(
            this.timeline.startTick,
            Math.min(this.timeline.endTick, Math.round(tick)),
        );
        const warmup = Math.round(
            this.getSettings().warmupSeconds / FIXED_STEP,
        );
        this.cursor = seekTimeline(this.timeline, target - warmup);
        this.effects = createEffects();
        this.effects.restorePersonalBox(
            personalBoxAt(this.personalBoxTrack, this.cursor.state.tick),
        );
        this.feedback = createFeedback(this.getLocale);
        this.pending = [];
        this.hold = 0;
        this.heldTick = -1;
        this.acc = 0;
        while (
            this.cursor.state.tick < target &&
            this.cursor.pending() !== 'end'
        ) {
            this.receive(this.cursor.next() ?? []);
        }
        this.pending = [];
        this.sync();
    };
    private sync = () => {
        if (!this.timeline || !this.cursor) {
            return;
        }
        const tick = this.cursor.state.tick;
        if (this.seekInput) {
            this.seekInput.value = String(tick);
        }
        if (this.timeLabel) {
            this.timeLabel.textContent = `${((tick - this.timeline.startTick) * FIXED_STEP).toFixed(2)} / ${((this.timeline.endTick - this.timeline.startTick) * FIXED_STEP).toFixed(2)} s`;
        }
        if (this.playButton) {
            this.playButton.textContent = this.playing ? '❚❚' : '▶';
            this.playButton.setAttribute(
                'aria-label',
                this.t(this.playing ? 'replay.pause' : 'replay.play'),
            );
        }
        this.loopButton?.setAttribute('aria-pressed', String(this.loop));
    };
    private notes = () => {
        if (!this.timeline) {
            return '';
        }
        const seconds = (tick: number) =>
            ((tick - this.timeline!.startTick) * FIXED_STEP).toFixed(2) + 's';
        const parts: string[] = [];
        if (this.timeline.versionMismatch) {
            parts.push(this.t('replay.otherVersion'));
        }
        if (this.timeline.divergedAt !== null) {
            parts.push(
                `${this.t('replay.diverged')} ${seconds(this.timeline.divergedAt)}`,
            );
        }
        if (this.timeline.error) {
            parts.push(
                `${this.t('replay.errorAt')} ${seconds(this.timeline.error.tick)}: ${this.timeline.error.message}`,
            );
        }
        if (this.timeline.file.truncated) {
            parts.push(this.t('replay.truncated'));
        }
        return parts.join(' · ');
    };
    private drawMarkers = () => {
        if (!this.markerTrack || !this.timeline) {
            return;
        }
        this.markerTrack.replaceChildren();
        const span = Math.max(
            1,
            this.timeline.endTick - this.timeline.startTick,
        );
        for (const marker of this.timeline.markers) {
            const dot = document.createElement('i');
            dot.className = `replay-marker replay-marker-${marker.kind}`;
            dot.style.left = `${((marker.tick - this.timeline.startTick) / span) * 100}%`;
            dot.title = `${marker.kind} · ${((marker.tick - this.timeline.startTick) * FIXED_STEP).toFixed(2)}s`;
            this.markerTrack.append(dot);
        }
    };
    private setPlaying = (value: boolean) => {
        this.playing = value;
        this.acc = 0;
        this.sync();
    };
    private open = (file: ReplayFile) => {
        this.timeline = buildTimeline(
            file,
            this.getSettings().keyframeInterval,
        );
        this.personalBoxTrack = buildPersonalBoxTrack(this.timeline);
        this.speed = this.getSettings().playbackSpeed;
        if (this.speedSelect) {
            this.speedSelect.replaceChildren(
                ...[...new Set([...SPEEDS, this.speed])]
                    .sort((a, b) => a - b)
                    .map((value) => {
                        const option = document.createElement('option');
                        option.value = String(value);
                        option.textContent = `${value}×`;
                        option.selected = value === this.speed;
                        return option;
                    }),
            );
        }
        if (this.seekInput) {
            this.seekInput.min = String(this.timeline.startTick);
            this.seekInput.max = String(this.timeline.endTick);
            this.seekInput.step = '1';
        }
        if (this.noteLabel) {
            this.noteLabel.textContent = this.notes();
        }
        this.drawMarkers();
        this.seek(this.timeline.startTick);
        if (this.bar) {
            this.bar.hidden = false;
        }
        this.root.classList.add('replaying');
        this.setPlaying(true);
        this.playButton?.focus();
        return this.timeline;
    };
    private close = () => {
        if (!this.timeline) {
            return;
        }
        this.timeline = null;
        this.cursor = null;
        this.playing = false;
        if (this.bar) {
            this.bar.hidden = true;
        }
        this.root.classList.remove('replaying');
        this.onClose();
    };
    private bindPlaybackControls() {
        this.bar = this.q<HTMLElement>('[data-replay-bar]');
        this.playButton = this.q<HTMLButtonElement>('[data-replay-play]');
        this.seekInput = this.q<HTMLInputElement>('[data-replay-seek]');
        this.speedSelect = this.q<HTMLSelectElement>('[data-replay-speed]');
        this.loopButton = this.q<HTMLButtonElement>('[data-replay-loop]');
        this.timeLabel = this.q<HTMLElement>('[data-replay-time]');
        this.noteLabel = this.q<HTMLElement>('[data-replay-note]');
        this.markerTrack = this.q<HTMLElement>('[data-replay-markers]');
        this.timeline = null;
        this.cursor = null;
        this.playing = false;
        this.loop = false;
        this.speed = 1;
        this.acc = 0;
        this.hold = 0;
        this.heldTick = -1;
        this.effects = createEffects();
        this.feedback = createFeedback(this.getLocale);
        this.pending = [];
        this.personalBoxTrack = [];
        this.controller = new AbortController();
        this.options = { signal: this.controller.signal };
        this.playButton?.addEventListener(
            'click',
            () => {
                if (
                    !this.playing &&
                    this.cursor &&
                    this.timeline &&
                    this.cursor.state.tick >= this.timeline.endTick
                ) {
                    this.seek(this.timeline.startTick);
                }
                this.setPlaying(!this.playing);
            },
            this.options,
        );
        this.q('[data-replay-prev]')?.addEventListener(
            'click',
            () => {
                this.setPlaying(false);
                if (this.cursor) {
                    this.seek(this.cursor.state.tick - 1);
                }
            },
            this.options,
        );
    }
    api(): ReplayPlayer {
        const readActive = () => {
            return !!this.timeline;
        };
        const readTimeline = () => {
            return this.timeline;
        };
        const readTick = () => {
            return this.cursor?.state.tick ?? 0;
        };
        const readState = () => {
            return this.cursor?.state ?? null;
        };
        const readPlaying = () => {
            return this.playing;
        };
        return {
            open: this.open,
            close: this.close,
            get active() {
                return readActive();
            },
            get timeline() {
                return readTimeline();
            },
            get tick() {
                return readTick();
            },
            get state() {
                return readState();
            },
            get playing() {
                return readPlaying();
            },
            seek: this.apiSeek,
            setPlaying: this.setPlaying,
            advance: this.apiAdvance,
            view: this.apiView,
            drainEvents: this.apiDrainEvents,
            effects: this.apiEffects,
            feedback: this.apiFeedback,
            destroy: this.apiDestroy,
        };
    }
    private apiSeek = (tick: number) => {
        this.seek(tick);
    };
    private apiAdvance = (dt: number) => {
        if (!this.timeline || !this.playing || !Number.isFinite(dt) || dt < 0) {
            return;
        }
        this.effects.advance(Math.min(dt, 0.25) * this.speed);
        this.acc += Math.min(dt, 0.25) * this.speed;
        while (this.acc >= FIXED_STEP) {
            this.acc -= FIXED_STEP;
            if (this.hold > 0) {
                this.hold -= FIXED_STEP;
                continue;
            }
            if (!this.stepOnce()) {
                if (this.loop) {
                    this.seek(this.timeline.startTick);
                } else {
                    this.playing = false;
                    break;
                }
            }
        }
        this.sync();
    };
    private apiView = () => {
        return this.cursor ? viewState(this.cursor.state) : null;
    };
    private apiDrainEvents = () => {
        return this.pending.splice(0);
    };
    private apiEffects = () => {
        return this.effects.snapshot();
    };
    private apiFeedback = () => {
        return this.feedback.snapshot();
    };
    private apiDestroy = () => {
        this.controller.abort();
    };
}
