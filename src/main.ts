import { isMessage, resolveLocale, translate, type Locale } from './i18n';
import { createGame } from './game/game';
import { createEffects } from './render/effects';
import { createRenderer } from './render/renderer';
import { createFeedback } from './ui/feedback';
import { createHud } from './ui/hud';
import { bindInput } from './ui/input';
import { createRecorder, REPLAY_DEFAULTS, type ReplayFile } from './game/replay';
import { createErrorLog, replayData, saveBrowserData } from './ui/replay-store';
import { bindReplayMenu } from './ui/replay-menu';
import { createReplayPlayer } from './ui/replay-player';
import { showStartupSplash } from './ui/splash';
import type { StageId } from './game/stages/building/data';
import type { Input } from './game/types';
import markup from './scene.html?raw';
import './style.css';
const app = document.querySelector('#app');
if (!app) {
    throw new Error('Game mount is unavailable.');
}
app.innerHTML = markup;
const root = document.getElementById('chair-office-one')!;
let locale: Locale = resolveLocale(navigator.languages);
try {
    const savedLocale = localStorage.getItem('the-chair-locale');
    if (savedLocale === 'en' || savedLocale === 'ko') locale = savedLocale;
} catch {}
function applyLocale() {
    document.documentElement.lang = locale;
    root.lang = locale;
    document.title = `The Chair · ${translate('intro.desc', locale)}`;
    for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
        const message = element.dataset.i18n;
        if (message !== undefined && isMessage(message)) element.textContent = translate(message, locale);
    }
    for (const element of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
        const message = element.dataset.i18nAria;
        if (message !== undefined && isMessage(message)) element.setAttribute('aria-label', translate(message, locale));
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-locale]')) {
        button.setAttribute('aria-pressed', String(button.dataset.locale === locale));
    }
}
applyLocale();
showStartupSplash(root, () => locale);
for (const button of root.querySelectorAll<HTMLButtonElement>('[data-locale]')) {
    button.addEventListener('click', () => {
        const selected = button.dataset.locale;
        if (selected !== 'en' && selected !== 'ko') return;
        locale = selected;
        try { localStorage.setItem('the-chair-locale', locale); } catch {}
        applyLocale();
    });
}
let savedDeaths = 0;
let savedCompletedStage: 0 | StageId = 0;
try {
    const saved = JSON.parse(localStorage.getItem('the-chair-office-v1') || 'null');
    if (saved?.completedStage === 1 || saved?.completedStage === 2 || saved?.completedStage === 3 || saved?.completedStage === 4) {
        savedCompletedStage = saved.completedStage;
    }
    if (Number.isFinite(saved?.deaths)) {
        savedDeaths = Math.max(0, saved.deaths);
    }
}
catch {
}
const seed = crypto.getRandomValues(new Uint32Array(1))[0];
// Replays: every attempt is recorded (start state + commands) so it can be watched, exported or attached to
// errors. Recording settings are fixed game config; players cannot change them.
const replaySettings = REPLAY_DEFAULTS;
const recorder = createRecorder(() => replaySettings, seed);
const errorLog = createErrorLog(replaySettings.maxErrors);
// The newest data stays in this browser so the replay tool (/replay.html) can open it directly.
const keepBrowserData = () => saveBrowserData(replayData(recorder, errorLog));
let lastStage: number | null = null;
const game = createGame({
    seed,
    progress: { deaths: savedDeaths, completedStage: savedCompletedStage },
    onAttemptStart(state) {
        recorder.onAttemptStart(state);
        keepBrowserData();
    },
    onCommand: recorder.onCommand,
    onStep: recorder.onStep,
    onError(error) {
        recorder.onError(error);
        errorLog.add(error, lastStage, recorder.attempts()[0] ?? null);
        keepBrowserData();
    },
});
document.addEventListener('visibilitychange', () => { if (document.hidden) keepBrowserData(); });
window.addEventListener('pagehide', keepBrowserData);
const describeError = (value: unknown) => value instanceof Error ? { message: value.message, stack: value.stack } : { message: String(value) };
function logWindowError(value: unknown) {
    errorLog.add({ tick: -1, at: 'window', ...describeError(value) }, lastStage, recorder.latest(0));
    keepBrowserData();
}
window.addEventListener('error', event => logWindowError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => logWindowError(event.reason));
const effects = createEffects();
const feedback = createFeedback(() => locale);
const player = createReplayPlayer(root, () => locale, () => replaySettings, () => unbind.sync());
const unbind = bindInput(root, game, { blocked: () => player.active });
function watchReplay(file: ReplayFile) {
    if (game.getSnapshot().mode === 'play') game.pause();
    game.clearInput();
    player.open(file);
    unbind.sync();
}
bindReplayMenu(root, () => locale, { recorder, errorLog, watch: watchReplay });
const hud = createHud(root, () => locale);
let renderer: ReturnType<typeof createRenderer> | null = null;
try {
    renderer = createRenderer(root, () => locale);
}
catch (error) {
    console.error('Renderer unavailable', error);
}
let presentationErrorReported = false;
function draw() {
    const live = game.getSnapshot();
    const liveEvents = game.drainEvents();
    lastStage = live.stage;
    const replay = player.active ? player.view() : null;
    const state = replay ?? live;
    const events = replay ? player.drainEvents() : liveEvents;
    if (live.deaths !== savedDeaths || live.completedStage !== savedCompletedStage) {
        savedDeaths = live.deaths;
        savedCompletedStage = live.completedStage;
        try {
            localStorage.setItem('the-chair-office-v1', JSON.stringify({ deaths: savedDeaths, completedStage: savedCompletedStage }));
        }
        catch {
        }
    }
    // Presentation receives detached snapshots. A missing HUD or renderer cannot stop simulation.
    try {
        // The replay player feeds its own effects and feedback, so live and replayed cues never mix.
        if (!replay) {
            for (const event of events) {
                effects.receive(event);
                feedback.receive(event, state);
            }
        }
        const visual = replay ? player.effects() : effects.snapshot();
        const view = renderer?.draw(state, visual) ?? { cam: 0, scale: 1, vertical: 0, width: 800 };
        hud.draw(state, replay ? player.feedback() : feedback.snapshot(), visual, view);
    }
    catch (error) {
        if (!presentationErrorReported) {
            console.error('Presentation failed', error);
            presentationErrorReported = true;
        }
    }
}
let last: number | null = null;
function frame(ms: number) {
    if (!root.isConnected) {
        unbind();
        player.destroy();
        renderer?.destroy();
        return;
    }
    const dt = last === null ? 0 : Math.max(0, (ms - last) / 1000);
    last = ms;
    if (player.active) player.advance(dt);
    else game.advance(dt);
    draw();
    requestAnimationFrame(frame);
}
// Retain the existing browser debugging API without exposing live game state.
const officeStageOne = {
    interact: game.interact, leaveMeeting: game.leaveMeeting, reset: game.reset, startStage: game.startStage, step: game.step, jump: game.jump, pause: game.pause, draw,
    advanceImpact: game.advanceImpact, advanceFocusLoss: game.advanceFocusLoss,
    setInput: (...v: Input[]) => game.setInput(...v),
    state: () => ({ ...game.getSnapshot(), ...effects.snapshot(), ...renderer?.info(), reaction: feedback.snapshot().reaction }),
    replay: {
        latest: () => recorder.latest(),
        watch: watchReplay,
        close: () => player.close(),
        status: () => ({ active: player.active, tick: player.tick, view: player.view(), timeline: player.timeline && { start: player.timeline.startTick, end: player.timeline.endTick, markers: player.timeline.markers, divergedAt: player.timeline.divergedAt, error: player.timeline.error } }),
        data: () => replayData(recorder, errorLog),
    },
};
(window as Window & {
    officeStageOne?: typeof officeStageOne;
}).officeStageOne = officeStageOne;
draw();
requestAnimationFrame(frame);
