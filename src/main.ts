import { isMessage, resolveLocale, translate, type Locale } from './i18n';
import { createGame } from './game/game';
import { createEffects } from './render/effects';
import { createRenderer } from './render/renderer';
import { createFeedback } from './ui/feedback';
import { createHud } from './ui/hud';
import { bindInput } from './ui/input';
import { showStartupSplash } from './ui/splash';
import type { StageId } from './game/stage2';
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
    document.title = `The Chair · ${translate('Business as usual.', locale)}`;
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
    if (saved?.completedStage === 1 || saved?.completedStage === 2 || saved?.completedStage === 3) {
        savedCompletedStage = saved.completedStage;
    }
    if (Number.isFinite(saved?.deaths)) {
        savedDeaths = Math.max(0, saved.deaths);
    }
}
catch {
}
const game = createGame(savedDeaths, savedCompletedStage);
const effects = createEffects();
const feedback = createFeedback(() => locale);
const unbind = bindInput(root, game);
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
    const state = game.getSnapshot();
    const events = game.drainEvents();
    if (state.deaths !== savedDeaths || state.completedStage !== savedCompletedStage) {
        savedDeaths = state.deaths;
        savedCompletedStage = state.completedStage;
        try {
            localStorage.setItem('the-chair-office-v1', JSON.stringify({ deaths: savedDeaths, completedStage: savedCompletedStage }));
        }
        catch {
        }
    }
    // Presentation receives detached snapshots. A missing HUD or renderer cannot stop simulation.
    try {
        for (const event of events) {
            effects.receive(event);
            feedback.receive(event, state);
        }
        const visual = effects.snapshot();
        const view = renderer?.draw(state, visual) ?? { cam: 0, scale: 1, vertical: 0, width: 800 };
        hud.draw(state, feedback.snapshot(), visual, view);
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
        renderer?.destroy();
        return;
    }
    const dt = last === null ? 0 : Math.max(0, (ms - last) / 1000);
    last = ms;
    game.advance(dt);
    draw();
    requestAnimationFrame(frame);
}
// Retain the existing browser debugging API without exposing live game state.
const officeStageOne = {
    interact: game.interact, leaveMeeting: game.leaveMeeting, reset: game.reset, startStage: game.startStage, step: game.step, jump: game.jump, pause: game.pause, draw,
    advanceImpact: game.advanceImpact, advanceFocusLoss: game.advanceFocusLoss,
    setInput: (...v: Input[]) => game.setInput(...v),
    state: () => ({ ...game.getSnapshot(), ...effects.snapshot(), ...renderer?.info(), reaction: feedback.snapshot().reaction })
};
(window as Window & {
    officeStageOne?: typeof officeStageOne;
}).officeStageOne = officeStageOne;
draw();
requestAnimationFrame(frame);
