import { createGame } from './game/game';
import { createEffects } from './render/effects';
import { createRenderer } from './render/renderer';
import { createFeedback } from './ui/feedback';
import { createHud } from './ui/hud';
import { bindInput } from './ui/input';
import type { Input } from './game/types';
import markup from './scene.html?raw';
import './style.css';
const app = document.querySelector('#app');
if (!app) {
    throw new Error('Game mount is unavailable.');
}
app.innerHTML = markup;
const root = document.getElementById('chair-office-one')!;
let savedDeaths = 0;
try {
    const saved = JSON.parse(localStorage.getItem('the-chair-office-v1') || 'null');
    if (Number.isFinite(saved?.deaths)) {
        savedDeaths = Math.max(0, saved.deaths);
    }
}
catch {
}
const game = createGame(savedDeaths);
const effects = createEffects();
const feedback = createFeedback();
const unbind = bindInput(root, game);
const hud = createHud(root);
let renderer: ReturnType<typeof createRenderer> | null = null;
try {
    renderer = createRenderer(root);
}
catch (error) {
    console.error('Renderer unavailable', error);
}
let presentationErrorReported = false;
function draw() {
    const state = game.getSnapshot();
    const events = game.drainEvents();
    if (state.deaths !== savedDeaths) {
        savedDeaths = state.deaths;
        try {
            localStorage.setItem('the-chair-office-v1', JSON.stringify({ deaths: savedDeaths }));
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
        hud.draw(state, feedback.snapshot(), visual, view, renderer?.info().renderer ?? 'canvas2d');
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
    reset: game.reset, startStage: game.startStage, step: game.step, jump: game.jump, pause: game.pause, draw,
    advanceImpact: game.advanceImpact, advanceFocusLoss: game.advanceFocusLoss,
    setInput: (...v: Input[]) => game.setInput(...v),
    state: () => ({ ...game.getSnapshot(), ...effects.snapshot(), ...renderer?.info(), reaction: feedback.snapshot().reaction })
};
(window as Window & {
    officeStageOne?: typeof officeStageOne;
}).officeStageOne = officeStageOne;
draw();
requestAnimationFrame(frame);
