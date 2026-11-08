import { createRenderer } from './render/renderer';
import { previewScenes, type PreviewScene } from './preview-scenes';
import './style.css';
import './preview.css';

const root = document.querySelector<HTMLElement>('#chair-office-one')!;
const select = document.querySelector<HTMLSelectElement>('#motion')!;
const slider = document.querySelector<HTMLInputElement>('#time')!;
const value = document.querySelector<HTMLOutputElement>('#time-value')!;
const playButton = document.querySelector<HTMLButtonElement>('#play')!;
const markers = document.querySelector<HTMLElement>('#markers')!;
const backend = document.querySelector<HTMLElement>('#renderer')!;
const renderer = createRenderer(root);

for (const scene of previewScenes) select.add(new Option(scene.label, scene.id));
const requested = new URLSearchParams(location.search).get('motion');
const requestedTime = Number(new URLSearchParams(location.search).get('t'));
let scene: PreviewScene = previewScenes.find(item => item.id === requested) ?? previewScenes[0];
let time = 0;
let playing = false;
let previousFrame: number | null = null;
let scheduledFrame: number | null = null;

function render() {
    const { state, effects } = scene.sample(time);
    const width = root.querySelector('canvas')!.clientWidth;
    const worldWidth = width < 520 ? 540 : Math.max(760, width);
    renderer.draw(state, effects, scene.focusX - worldWidth / 2);
    slider.value = String(time);
    value.value = `${time.toFixed(2)} s`;
}

function pause() {
    playing = false;
    previousFrame = null;
    if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = null;
    playButton.textContent = 'Play';
    playButton.setAttribute('aria-label', 'Play animation');
}

function seek(next: number, persist = true) {
    time = Math.max(0, Math.min(scene.duration, next));
    render();
    if (persist) {
        const url = new URL(location.href);
        url.searchParams.set('t', time.toFixed(2));
        history.replaceState(null, '', url);
    }
}

function selectScene(next: PreviewScene, at = 0) {
    pause();
    scene = next;
    select.value = scene.id;
    slider.max = String(scene.duration);
    markers.replaceChildren();
    for (const marker of scene.markers) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${marker.label} · ${marker.at.toFixed(2)} s`;
        button.addEventListener('click', () => { pause(); seek(marker.at); });
        markers.append(button);
    }
    const url = new URL(location.href);
    url.searchParams.set('motion', scene.id);
    history.replaceState(null, '', url);
    seek(at);
}

function frame(ms: number) {
    scheduledFrame = null;
    if (!playing) return;
    if (previousFrame !== null) {
        const next = time + Math.max(0, (ms - previousFrame) / 1000);
        seek(next >= scene.duration ? next % scene.duration : next, false);
    }
    previousFrame = ms;
    scheduledFrame = requestAnimationFrame(frame);
}

select.addEventListener('change', () => {
    const next = previewScenes.find(item => item.id === select.value);
    if (next) selectScene(next);
});
slider.addEventListener('input', () => { pause(); seek(slider.valueAsNumber); });
document.querySelector('#previous')!.addEventListener('click', () => { pause(); seek(time - 1 / 60); });
document.querySelector('#next')!.addEventListener('click', () => { pause(); seek(time + 1 / 60); });
playButton.addEventListener('click', () => {
    if (playing) {
        pause();
        return;
    }
    playing = true;
    previousFrame = null;
    playButton.textContent = 'Pause';
    playButton.setAttribute('aria-label', 'Pause animation');
    scheduledFrame = requestAnimationFrame(frame);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
const resize = new ResizeObserver(() => requestAnimationFrame(render));
resize.observe(root);
window.addEventListener('pagehide', () => { resize.disconnect(); renderer.destroy(); });
selectScene(scene, Number.isFinite(requestedTime) ? requestedTime : 0);
void renderer.ready.then(() => {
    backend.textContent = renderer.info().renderer === 'thorvg' ? 'ThorVG' : 'Canvas 2D';
    render();
});
