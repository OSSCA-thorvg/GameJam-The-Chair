// Replay tool (/replay.html): a developer page to open replay data exported from the game (or saved in this
// browser), play it back with seek and frame steps, check hashes and errors, and inspect the state.
import { FIXED_STEP } from './game/level';
import { normalizeReplaySettings, readReplaySources, REPLAY_DEFAULTS, type ReplaySettings, type ReplaySource } from './game/replay';
import { CONFIG_VERSION } from './game/stages/index';
import { isMessage, resolveLocale, translate, type Locale, type Message } from './i18n';
import { createRenderer } from './render/renderer';
import { createReplayPlayer } from './ui/replay-player';
import { copyText, downloadJson, loadBrowserData, stamp } from './ui/replay-store';
import './style.css';
import './preview.css';
import './replay-tool.css';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const locale: Locale = resolveLocale(navigator.languages);
const t = (message: Message) => translate(message, locale);
document.documentElement.lang = locale;
for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n!;
    if (isMessage(key)) element.textContent = t(key);
}
for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = element.dataset.i18nAria!;
    if (isMessage(key)) element.setAttribute('aria-label', t(key));
}

const root = $('#chair-office-one');
const status = $('#status');
const sourcesSelect = $<HTMLSelectElement>('#sources');
let settings: ReplaySettings = { ...REPLAY_DEFAULTS };
let sources: ReplaySource[] = [];
let selected: ReplaySource | null = null;

const renderer = (() => {
    try { return createRenderer(root, () => locale); } catch (error) { console.error(error); return null; }
})();
const player = createReplayPlayer(root, () => locale, () => settings, () => {}, { closable: false });

// Viewer options only change how this page plays a replay, never the recording.
const viewerInputs = { keyframeInterval: $<HTMLInputElement>('#keyframe'), warmupSeconds: $<HTMLInputElement>('#warmup'), playbackSpeed: $<HTMLInputElement>('#speed') };
for (const [key, input] of Object.entries(viewerInputs)) {
    input.value = String(settings[key as keyof typeof viewerInputs]);
    input.addEventListener('change', () => {
        const before = settings.keyframeInterval;
        settings = normalizeReplaySettings({ ...settings, [key]: input.value });
        for (const [other, field] of Object.entries(viewerInputs)) field.value = String(settings[other as keyof typeof viewerInputs]);
        if (key === 'keyframeInterval' && settings.keyframeInterval !== before && selected) {
            const tick = player.tick;
            open(selected);
            player.seek(tick);
            player.setPlaying(false);
        }
    });
}

function load(text: string, origin: string) {
    try {
        const result = readReplaySources(text);
        sources = result.sources;
        sourcesSelect.replaceChildren(...sources.map((source, i) => new Option(source.label, String(i))));
        status.textContent = `${t('tool.loaded')}: ${origin} · ${sources.length}`;
        if (sources.length) {
            sourcesSelect.selectedIndex = 0;
            open(sources[0]);
        }
    } catch (error) {
        status.textContent = `${t('replay.badFile')} (${error instanceof Error ? error.message : error})`;
    }
}

function open(source: ReplaySource) {
    selected = source;
    const timeline = player.open(source.file);
    $('#empty').hidden = true;
    const seconds = (tick: number) => ((tick - timeline.startTick) * FIXED_STEP).toFixed(2) + 's';
    const facts: [string, string][] = [
        ['version', `${source.file.version || '—'}${timeline.versionMismatch ? ` ≠ ${CONFIG_VERSION}` : ' ✓'}`],
        ['seed', String(source.file.seed ?? '—')],
        ['stage', `${source.file.start.stage} · flag ${source.file.start.checkpoint}`],
        ['ticks', `${timeline.startTick} → ${timeline.endTick} (${seconds(timeline.endTick)})`],
        ['commands', String(source.file.commands.length) + (source.file.truncated ? ' (cut)' : '')],
        ['hashes', `${source.file.hashes.length} · ${timeline.divergedAt === null ? 'match' : `differ at ${timeline.divergedAt}`}`],
        ['keyframes', String(timeline.keyframes.length)],
    ];
    fill($('#file-info'), facts);
    const error = timeline.error ?? source.file.error;
    const errorInfo = $('#error-info');
    errorInfo.hidden = !error;
    errorInfo.textContent = error ? [`${error.at} @ tick ${error.tick}`, error.message, source.error?.time ?? '', error.stack ?? ''].filter(Boolean).join('\n') : '';
    $('#markers').replaceChildren(...timeline.markers.map(marker => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tool-marker tool-marker-${marker.kind}`;
        button.textContent = `${marker.kind} · ${seconds(marker.tick)}`;
        button.addEventListener('click', () => { player.seek(marker.tick); player.setPlaying(false); });
        return button;
    }));
    lastShown = -1;
}

function fill(list: HTMLElement, facts: [string, string][]) {
    list.replaceChildren(...facts.flatMap(([name, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = name;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
    }));
}

// Commands around the current tick; the next one to apply is highlighted. Click to jump there.
function showCommands(tick: number) {
    if (!selected) return;
    const commands = selected.file.commands;
    let next = commands.findIndex(([at]) => at >= tick);
    if (next < 0) next = commands.length;
    const from = Math.max(0, next - 4);
    $('#commands').replaceChildren(...commands.slice(from, next + 8).map(([at, command], i) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        const { type, ...rest } = command;
        button.textContent = `${at} · ${type}${Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''}`;
        if (from + i === next) item.className = 'next';
        button.addEventListener('click', () => { player.seek(at); player.setPlaying(false); });
        item.append(button);
        return item;
    }));
}

let lastShown = -1;
function showState() {
    const state = player.state;
    if (!state || state.tick === lastShown) return;
    lastShown = state.tick;
    const p = state.p;
    const n = (value: number) => value.toFixed(1);
    fill($('#state-info'), [
        ['tick', `${state.tick} · ${state.time.toFixed(2)}s`],
        ['mode', `${state.mode}${state.lossReason ? ` (${state.lossReason})` : ''}`],
        ['stage', `${state.stage} · flag ${state.checkpoint}`],
        ['player', `x ${n(p.x)} y ${n(p.y)} · v ${n(p.vx)}, ${n(p.vy)} · a ${p.a.toFixed(2)}`],
        ['ground', String(state.ground)],
        ['focus', String(state.focus)],
        ['keys', state.keys.join(', ') || '—'],
        ['deaths', String(state.deaths)],
    ]);
    showCommands(state.tick);
}

$('#open-file').addEventListener('click', () => $<HTMLInputElement>('#file').click());
$<HTMLInputElement>('#file').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) load(await file.text(), file.name);
});
function loadBrowser() {
    const text = loadBrowserData();
    if (text) load(text, t('tool.browserData'));
    else status.textContent = t('tool.noBrowserData');
}
$('#browser-data').addEventListener('click', loadBrowser);
$('#load-paste').addEventListener('click', () => load($<HTMLTextAreaElement>('#paste').value, t('tool.paste')));
sourcesSelect.addEventListener('change', () => {
    const source = sources[Number(sourcesSelect.value)];
    if (source) open(source);
});
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', async event => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) load(await file.text(), file.name);
});
$('#download-replay').addEventListener('click', () => {
    if (selected) downloadJson(`the-chair-replay-stage${selected.file.start.stage}-${stamp()}.json`, selected.file);
});
$('#copy-state').addEventListener('click', async () => {
    if (player.state) status.textContent = t(await copyText(JSON.stringify(player.state, null, 2)) ? 'replay.copied' : 'replay.copyFailed');
});

let last: number | null = null;
function frame(ms: number) {
    const dt = last === null ? 0 : (ms - last) / 1000;
    last = ms;
    player.advance(dt);
    const view = player.view();
    if (view && renderer) renderer.draw(view, player.effects());
    player.drainEvents();
    showState();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (loadBrowserData()) loadBrowser();

// Debug handle for automated checks.
(window as Window & { replayTool?: unknown }).replayTool = { load, player, sources: () => sources };
