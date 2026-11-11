// Replay section of the pause menu. Players can watch their last attempt and export the replay data;
// nothing here changes how replays are recorded. Developers open the exported data in /replay.html.
import type { Recorder, ReplayFile } from '../game/replay';
import { translate, type Locale, type Message } from '../i18n';
import { copyText, downloadJson, replayData, stamp, type ErrorLog } from './replay-store';

type Hooks = { recorder: Recorder; errorLog: ErrorLog; watch: (file: ReplayFile) => void };

export function bindReplayMenu(root: HTMLElement, getLocale: () => Locale, hooks: Hooks) {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const message = root.querySelector<HTMLElement>('[data-replay-message]');
    const say = (text: Message) => { if (message) message.textContent = translate(text, getLocale()); };
    const on = (selector: string, action: () => void) => root.querySelector(selector)?.addEventListener('click', action, options);

    on('[data-replay-watch]', () => {
        const file = hooks.recorder.latest();
        if (file) hooks.watch(file); else say('replay.none');
    });
    on('[data-replay-copy]', async () => {
        say(await copyText(JSON.stringify(replayData(hooks.recorder, hooks.errorLog))) ? 'replay.copied' : 'replay.copyFailed');
    });
    on('[data-replay-download]', () => downloadJson(`the-chair-replay-data-${stamp()}.json`, replayData(hooks.recorder, hooks.errorLog)));
    return { destroy() { controller.abort(); } };
}
