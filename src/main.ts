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
import { createOpening } from './ui/opening';
import { openingState } from './render/scene/opening/timeline';
import type { StageId } from './game/stages/building/data';
import type { Input } from './game/types';
import markup from './scene.html?raw';
import { bindOrientation } from './ui/orientation';
import { createPerfOverlay } from './ui/perf-overlay';
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
// `?debug=1&stage=<1-5>` skips the splash and starts that stage directly.
const launchParams = new URLSearchParams(location.search);
const requestedStage = Number(launchParams.get('stage'));
const directStage: StageId | null = [1, 2, 3, 4, 5].includes(requestedStage)
    && launchParams.get('debug') === '1' ? requestedStage as StageId : null;
let startupSplashVisible = directStage === null;
if (startupSplashVisible) {
    showStartupSplash(root, () => locale, () => { startupSplashVisible = false; });
}
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
const effects = createEffects();
const game = createGame({
    seed,
    progress: { deaths: savedDeaths, completedStage: savedCompletedStage },
    onAttemptStart(state) {
        recorder.onAttemptStart(state);
        keepBrowserData();
    },
    onCommand: recorder.onCommand,
    onStep(state) {
        recorder.onStep(state);
        effects.observe({ stage: state.stage, deaths: state.deaths, time: state.time, player: state.p });
    },
    onError(error) {
        recorder.onError(error);
        errorLog.add(error, lastStage, recorder.attempts()[0] ?? null);
        keepBrowserData();
    },
});
if (directStage !== null) game.startStage(directStage);
document.addEventListener('visibilitychange', () => { if (document.hidden) keepBrowserData(); });
window.addEventListener('pagehide', keepBrowserData);
const describeError = (value: unknown) => value instanceof Error ? { message: value.message, stack: value.stack } : { message: String(value) };
function logWindowError(value: unknown) {
    errorLog.add({ tick: -1, at: 'window', ...describeError(value) }, lastStage, recorder.latest(0));
    keepBrowserData();
}
window.addEventListener('error', event => logWindowError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => logWindowError(event.reason));
const feedback = createFeedback(() => locale);
const player = createReplayPlayer(root, () => locale, () => replaySettings, () => unbind.sync());
// The opening cutscene plays over the first fresh game after each page load.
const opening = createOpening(root, () => locale);
// The keycap hints go as soon as the player tries their key, so live presses are noted on the way to the game.
const hintedInput = { left: 'left', right: 'right', spray: 'spray' } as const;
const hintedGame: typeof game = {
    ...game,
    press(input) {
        if (input in hintedInput) effects.pressKey(hintedInput[input as keyof typeof hintedInput]);
        game.press(input);
    },
    jump() {
        effects.pressKey('jump');
        game.jump();
    },
};
const unbind = bindInput(root, hintedGame, {
    blocked: () => player.active || opening.active,
    onStart() {
        if (!opening.seen) opening.start(() => unbind.sync());
    },
});
function watchReplay(file: ReplayFile) {
    if (game.status().mode === 'play') game.pause();
    game.clearInput();
    player.open(file);
    unbind.sync();
}
bindOrientation(root, game);
bindReplayMenu(root, () => locale, { recorder, errorLog, watch: watchReplay });
const hud = createHud(root, () => locale);
let renderer: ReturnType<typeof createRenderer> | null = null;
try {
    renderer = createRenderer(root, () => locale);
}
catch (error) {
    console.error('Renderer unavailable', error);
}
// Developer metrics (F3 / ` / ?debug=1). Timing stays here and in the renderer, never in the game core.
const perf = createPerfOverlay(root, () => locale, {
    profile: stats => renderer?.profile(stats),
    layerOverrides: overrides => renderer?.layerOverrides(overrides),
    surface: () => renderer?.surface() ?? null,
});
let hudMs = 0;
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
            effects.observe(state);
            for (const event of events) {
                effects.receive(event);
                feedback.receive(event, state);
            }
        }
        const visual = replay ? player.effects() : effects.snapshot();
        const cutscene = replay ? null : opening.frame();
        const cues = replay ? player.feedback() : feedback.snapshot();
        if (cutscene) renderer?.draw(openingState(state, cutscene), visual, undefined, cutscene);
        else renderer?.draw(state, visual, undefined, undefined, cues);
        const hudStart = perf.enabled ? performance.now() : 0;
        hud.draw(state, cues, visual, !!cutscene);
        if (perf.enabled) hudMs = performance.now() - hudStart;
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
        opening.destroy();
        player.destroy();
        renderer?.destroy();
        perf.destroy();
        return;
    }
    // The startup splash completely covers the game. Keep its ThorVG animation at full quality while avoiding
    // a second, viewport-sized ThorVG render behind it. Resetting `last` makes the first visible frame start at dt 0.
    if (startupSplashVisible) {
        last = null;
        requestAnimationFrame(frame);
        return;
    }
    const dt = last === null ? 0 : Math.max(0, (ms - last) / 1000);
    last = ms;
    const profiling = perf.enabled;
    const simStart = profiling ? performance.now() : 0;
    let advanced = { ticks: 0, dropped: 0 };
    if (player.active) player.advance(dt);
    else if (opening.active) opening.advance(dt);
    else advanced = game.advance(dt);
    // The end-of-run close-up keeps going after the game has stopped ticking.
    if (!player.active && !opening.active) effects.advance(dt);
    const simMs = profiling ? performance.now() - simStart : 0;
    hudMs = 0;
    draw();
    if (profiling) perf.record({ frameMs: dt * 1000, simMs, ticks: advanced.ticks, droppedMs: advanced.dropped * 1000, hudMs });
    requestAnimationFrame(frame);
}
// Retain the existing browser debugging API without exposing live game state.
const officeStageOne = {
    skipOpening: () => opening.skip(),
    interact: game.interact, leaveMeeting: game.leaveMeeting, reset: game.reset, startStage: game.startStage, step: game.step, jump: game.jump, pause: game.pause, draw,
    advanceImpact: game.advanceImpact, advanceFocusLoss: game.advanceFocusLoss,
    setInput: (...v: Input[]) => game.setInput(...v),
    perf: { toggle: perf.toggle, snapshot: perf.snapshot, layers: perf.layers },
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
if (!startupSplashVisible) draw();
requestAnimationFrame(frame);
