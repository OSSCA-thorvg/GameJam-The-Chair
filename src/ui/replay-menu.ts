// Replay section of the pause menu: recording settings, watching, saving and opening replays, and the error log.
import { normalizeReplaySettings, parseReplay, REPLAY_SETTING_RANGES, type Recorder, type ReplayFile, type ReplaySettings } from '../game/replay';
import { translate, type Locale, type Message } from '../i18n';
import { copyJson, downloadJson, saveReplaySettings, stamp, type ErrorLog } from './replay-store';

type Hooks = {
    recorder: Recorder;
    errorLog: ErrorLog;
    settings: () => ReplaySettings;
    setSettings: (settings: ReplaySettings) => void;
    watch: (file: ReplayFile) => void;
};

export function bindReplayMenu(root: HTMLElement, getLocale: () => Locale, hooks: Hooks) {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
    const t = (message: Message) => translate(message, getLocale());
    const message = q<HTMLElement>('[data-replay-message]');
    const say = (text: Message | string, raw = false) => { if (message) message.textContent = raw ? text : t(text as Message); };

    // Settings form: every field is written back immediately and persisted.
    const fields = [...root.querySelectorAll<HTMLInputElement>('[data-replay-setting]')];
    function fill() {
        const settings = hooks.settings();
        for (const field of fields) {
            const key = field.dataset.replaySetting as keyof ReplaySettings;
            if (key === 'enabled') field.checked = settings.enabled;
            else {
                const [min, max, integer] = REPLAY_SETTING_RANGES[key];
                Object.assign(field, { min: String(min), max: String(max), step: integer ? '1' : 'any', value: String(settings[key]) });
            }
        }
    }
    for (const field of fields) {
        field.addEventListener('change', () => {
            const raw: Record<string, unknown> = { ...hooks.settings() };
            for (const input of fields) raw[input.dataset.replaySetting!] = input.type === 'checkbox' ? input.checked : input.value;
            const settings = normalizeReplaySettings(raw);
            hooks.setSettings(settings);
            saveReplaySettings(settings);
            fill();
        }, options);
    }

    const latest = () => hooks.recorder.latest();
    const name = (file: ReplayFile) => `the-chair-replay-stage${file.start.stage}-${stamp()}.json`;
    q('[data-replay-watch]')?.addEventListener('click', () => {
        const file = latest();
        if (file) hooks.watch(file); else say('replay.none');
    }, options);
    q('[data-replay-download]')?.addEventListener('click', () => {
        const file = latest();
        if (file) downloadJson(name(file), file); else say('replay.none');
    }, options);
    q('[data-replay-copy]')?.addEventListener('click', async () => {
        const file = latest();
        if (!file) { say('replay.none'); return; }
        say(await copyJson(file) ? 'replay.copied' : 'replay.copyFailed');
    }, options);
    const fileInput = q<HTMLInputElement>('[data-replay-file]');
    q('[data-replay-open]')?.addEventListener('click', () => fileInput?.click(), options);
    fileInput?.addEventListener('change', async () => {
        const chosen = fileInput.files?.[0];
        fileInput.value = '';
        if (!chosen) return;
        try {
            hooks.watch(parseReplay(await chosen.text()));
        } catch (error) {
            say(`${t('replay.badFile')} (${error instanceof Error ? error.message : error})`, true);
        }
    }, options);

    const count = q<HTMLElement>('[data-error-count]');
    function showCount() { if (count) count.textContent = String(hooks.errorLog.size); }
    q('[data-error-download]')?.addEventListener('click', () => downloadJson(`the-chair-errors-${stamp()}.json`, hooks.errorLog.file()), options);
    q('[data-error-copy]')?.addEventListener('click', async () => say(await copyJson(hooks.errorLog.file()) ? 'replay.copied' : 'replay.copyFailed'), options);
    q('[data-error-clear]')?.addEventListener('click', () => hooks.errorLog.clear(), options);
    const stopCount = hooks.errorLog.onChange(showCount);

    fill();
    showCount();
    return {
        refresh() { fill(); showCount(); say('', true); },
        destroy() { controller.abort(); stopCount(); },
    };
}
