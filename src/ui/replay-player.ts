// Plays a recorded attempt back inside the game view: play/pause, frame steps, speed, seek with markers, loop.
import { FIXED_STEP } from '../game/level';
import { viewState } from '../game/game';
import { buildTimeline, seekTimeline, type ReplayCursor, type ReplayFile, type ReplaySettings, type Timeline } from '../game/replay';
import type { GameEvent } from '../game/types';
import { translate, type Locale, type Message } from '../i18n';
import { createEffects } from '../render/effects';
import { createFeedback } from './feedback';
import { buildPersonalBoxTrack, personalBoxAt } from './personal-box-replay';

const SPEEDS = [.25, .5, 1, 2, 4];
// Death and clear screens stay up briefly before the recorded retry, like they did for the player.
const HOLD_SECONDS = 1;

// `closable: false` keeps the player open (the replay tool page has no game to return to).
export function createReplayPlayer(root: HTMLElement, getLocale: () => Locale, getSettings: () => ReplaySettings, onClose: () => void, { closable = true } = {}) {
    const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
    const bar = q<HTMLElement>('[data-replay-bar]');
    const playButton = q<HTMLButtonElement>('[data-replay-play]');
    const seekInput = q<HTMLInputElement>('[data-replay-seek]');
    const speedSelect = q<HTMLSelectElement>('[data-replay-speed]');
    const loopButton = q<HTMLButtonElement>('[data-replay-loop]');
    const timeLabel = q<HTMLElement>('[data-replay-time]');
    const noteLabel = q<HTMLElement>('[data-replay-note]');
    const markerTrack = q<HTMLElement>('[data-replay-markers]');
    const t = (message: Message) => translate(message, getLocale());

    let timeline: Timeline | null = null;
    let cursor: ReplayCursor | null = null;
    let playing = false;
    let loop = false;
    let speed = 1;
    let acc = 0;
    let hold = 0;
    let heldTick = -1;
    let effects = createEffects();
    let feedback = createFeedback(getLocale);
    let pending: GameEvent[] = [];
    let personalBoxTrack: ReturnType<typeof buildPersonalBoxTrack> = [];

    function receive(events: readonly GameEvent[]) {
        if (!cursor) return;
        const state = cursor.state;
        effects.observe({ stage: state.stage, deaths: state.deaths, time: state.time, player: state.p });
        if (!events.length) return;
        const view = viewState(cursor.state);
        for (const event of events) {
            effects.receive(event);
            feedback.receive(event, view);
        }
        pending.push(...events);
    }

    // One fixed step of playback. Commands at this tick apply first; returns false at the end.
    // Manual frame steps skip the pause on death and clear screens. A recorded error ends playback there
    // (the timeline already reports it) instead of escaping into the page's frame loop.
    function stepOnce(manual = false): boolean {
        try {
            return advanceCursor(manual);
        } catch {
            return false;
        }
    }

    function advanceCursor(manual: boolean): boolean {
        if (!cursor) return false;
        while (cursor.pending() === 'command') {
            const mode = cursor.state.mode;
            if (!manual && (mode === 'dead' || mode === 'won') && heldTick !== cursor.state.tick) {
                heldTick = cursor.state.tick;
                hold = HOLD_SECONDS;
                return true;
            }
            receive(cursor.next() ?? []);
        }
        const events = cursor.next();
        if (!events) return false;
        receive(events);
        return true;
    }

    // Jumps to `tick`, re-running a short stretch before it so particles, speech and camera have settled.
    function seek(tick: number) {
        if (!timeline) return;
        const target = Math.max(timeline.startTick, Math.min(timeline.endTick, Math.round(tick)));
        const warmup = Math.round(getSettings().warmupSeconds / FIXED_STEP);
        cursor = seekTimeline(timeline, target - warmup);
        effects = createEffects();
        effects.restorePersonalBox(personalBoxAt(personalBoxTrack, cursor.state.tick));
        feedback = createFeedback(getLocale);
        pending = [];
        hold = 0;
        heldTick = -1;
        acc = 0;
        while (cursor.state.tick < target && cursor.pending() !== 'end') receive(cursor.next() ?? []);
        pending = [];
        sync();
    }

    function sync() {
        if (!timeline || !cursor) return;
        const tick = cursor.state.tick;
        if (seekInput) seekInput.value = String(tick);
        if (timeLabel) timeLabel.textContent = `${((tick - timeline.startTick) * FIXED_STEP).toFixed(2)} / ${((timeline.endTick - timeline.startTick) * FIXED_STEP).toFixed(2)} s`;
        if (playButton) {
            playButton.textContent = playing ? '❚❚' : '▶';
            playButton.setAttribute('aria-label', t(playing ? 'replay.pause' : 'replay.play'));
        }
        loopButton?.setAttribute('aria-pressed', String(loop));
    }

    function notes() {
        if (!timeline) return '';
        const seconds = (tick: number) => ((tick - timeline!.startTick) * FIXED_STEP).toFixed(2) + 's';
        const parts: string[] = [];
        if (timeline.versionMismatch) parts.push(t('replay.otherVersion'));
        if (timeline.divergedAt !== null) parts.push(`${t('replay.diverged')} ${seconds(timeline.divergedAt)}`);
        if (timeline.error) parts.push(`${t('replay.errorAt')} ${seconds(timeline.error.tick)}: ${timeline.error.message}`);
        if (timeline.file.truncated) parts.push(t('replay.truncated'));
        return parts.join(' · ');
    }

    function drawMarkers() {
        if (!markerTrack || !timeline) return;
        markerTrack.replaceChildren();
        const span = Math.max(1, timeline.endTick - timeline.startTick);
        for (const marker of timeline.markers) {
            const dot = document.createElement('i');
            dot.className = `replay-marker replay-marker-${marker.kind}`;
            dot.style.left = `${((marker.tick - timeline.startTick) / span) * 100}%`;
            dot.title = `${marker.kind} · ${((marker.tick - timeline.startTick) * FIXED_STEP).toFixed(2)}s`;
            markerTrack.append(dot);
        }
    }

    function setPlaying(value: boolean) {
        playing = value;
        acc = 0;
        sync();
    }

    const controller = new AbortController();
    const options = { signal: controller.signal };
    playButton?.addEventListener('click', () => {
        if (!playing && cursor && timeline && cursor.state.tick >= timeline.endTick) seek(timeline.startTick);
        setPlaying(!playing);
    }, options);
    q('[data-replay-prev]')?.addEventListener('click', () => { setPlaying(false); if (cursor) seek(cursor.state.tick - 1); }, options);
    q('[data-replay-next]')?.addEventListener('click', () => { setPlaying(false); stepOnce(true); sync(); }, options);
    q('[data-replay-exit]')?.addEventListener('click', () => close(), options);
    loopButton?.addEventListener('click', () => { loop = !loop; sync(); }, options);
    seekInput?.addEventListener('input', () => seek(Number(seekInput.value)), options);
    speedSelect?.addEventListener('change', () => { speed = Number(speedSelect.value) || 1; }, options);
    window.addEventListener('keydown', e => {
        if (!timeline || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        const handled: Record<string, () => void> = {
            ' ': () => playButton?.click(),
            ArrowLeft: () => q<HTMLButtonElement>('[data-replay-prev]')?.click(),
            ArrowRight: () => q<HTMLButtonElement>('[data-replay-next]')?.click(),
            ...(closable ? { Escape: () => close() } : {}),
        };
        const action = handled[e.key];
        if (!action) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        action();
    }, { ...options, capture: true });

    function open(file: ReplayFile) {
        timeline = buildTimeline(file, getSettings().keyframeInterval);
        personalBoxTrack = buildPersonalBoxTrack(timeline);
        speed = getSettings().playbackSpeed;
        if (speedSelect) {
            speedSelect.replaceChildren(...[...new Set([...SPEEDS, speed])].sort((a, b) => a - b).map(value => {
                const option = document.createElement('option');
                option.value = String(value);
                option.textContent = `${value}×`;
                option.selected = value === speed;
                return option;
            }));
        }
        if (seekInput) {
            seekInput.min = String(timeline.startTick);
            seekInput.max = String(timeline.endTick);
            seekInput.step = '1';
        }
        if (noteLabel) noteLabel.textContent = notes();
        drawMarkers();
        seek(timeline.startTick);
        if (bar) bar.hidden = false;
        root.classList.add('replaying');
        setPlaying(true);
        playButton?.focus();
        return timeline;
    }

    function close() {
        if (!timeline) return;
        timeline = null;
        cursor = null;
        playing = false;
        if (bar) bar.hidden = true;
        root.classList.remove('replaying');
        onClose();
    }

    return {
        open,
        close,
        get active() { return !!timeline; },
        get timeline() { return timeline; },
        get tick() { return cursor?.state.tick ?? 0; },
        /** The raw core state at the current position (read-only). */
        get state() { return cursor?.state ?? null; },
        get playing() { return playing; },
        seek(tick: number) { seek(tick); },
        setPlaying,
        advance(dt: number) {
            if (!timeline || !playing || !Number.isFinite(dt) || dt < 0) return;
            acc += Math.min(dt, .25) * speed;
            while (acc >= FIXED_STEP) {
                acc -= FIXED_STEP;
                if (hold > 0) {
                    hold -= FIXED_STEP;
                    continue;
                }
                if (!stepOnce()) {
                    if (loop) seek(timeline.startTick);
                    else { playing = false; break; }
                }
            }
            sync();
        },
        view() { return cursor ? viewState(cursor.state) : null; },
        drainEvents() { return pending.splice(0); },
        effects: () => effects.snapshot(),
        feedback: () => feedback.snapshot(),
        destroy() { controller.abort(); },
    };
}

export type ReplayPlayer = ReturnType<typeof createReplayPlayer>;
