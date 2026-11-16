import { replayLength, type Recorder, type ReplayFile } from '../game/replay';
import { isMessage, translate, type Locale, type Message } from '../i18n';
import {
    copyText,
    downloadJson,
    replayData,
    stamp,
    type ErrorLog,
} from './replay-store';

type Hooks = {
    recorder: Recorder;
    errorLog: ErrorLog;
    watch: (file: ReplayFile) => void;
};
type Entry = {
    label: string;
    error: boolean;
    file: ReplayFile;
    download: () => void;
};

export function bindReplayMenu(
    root: HTMLElement,
    getLocale: () => Locale,
    hooks: Hooks,
) {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const message = root.querySelector<HTMLElement>('[data-replay-message]');
    const list = root.querySelector<HTMLOListElement>('[data-replay-list]');
    const menu = root.querySelector<HTMLDetailsElement>('[data-replay-menu]');
    const pauseMenu = root.querySelector<HTMLElement>('[data-pause-menu]');
    const t = (text: Message) => translate(text, getLocale());
    const say = (text: Message) => {
        if (message) message.textContent = t(text);
    };
    const on = (selector: string, action: () => void) =>
        root
            .querySelector(selector)
            ?.addEventListener('click', action, options);

    const stageName = (stage: number) => {
        const key = `stageLabel.stage${stage}`;
        return isMessage(key) ? t(key) : String(stage);
    };
    const seconds = (file: ReplayFile) =>
        `${(replayLength(file) / 120).toFixed(1)}s`;
    const clock = (time: string) => {
        const date = new Date(time);
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString(getLocale(), {
                  hour: '2-digit',
                  minute: '2-digit',
              });
    };

    function entries(): Entry[] {
        const attempts = hooks.recorder.attempts().map((file, i): Entry => ({
            label: [
                `#${i + 1}`,
                stageName(file.start.stage),
                seconds(file),
                i === 0 && hooks.recorder.recording ? t('replay.current') : '',
                file.error ? t('replay.error') : '',
            ]
                .filter(Boolean)
                .join(' · '),
            error: !!file.error,
            file,
            download: () =>
                downloadJson(
                    `the-chair-replay-stage${file.start.stage}-${stamp()}.json`,
                    file,
                ),
        }));
        const errors = [...hooks.errorLog.entries]
            .reverse()
            .flatMap((entry): Entry[] =>
                entry.replay
                    ? [
                          {
                              label: `⚠ ${[clock(entry.time), stageName(entry.replay.start.stage), entry.message].filter(Boolean).join(' · ')}`,
                              error: true,
                              file: entry.replay,
                              download: () =>
                                  downloadJson(
                                      `the-chair-replay-error-${stamp()}.json`,
                                      {
                                          ...replayData(
                                              hooks.recorder,
                                              hooks.errorLog,
                                          ),
                                          attempts: [],
                                          errors: [entry],
                                      },
                                  ),
                          },
                      ]
                    : [],
            );
        return [...attempts, ...errors];
    }

    function render() {
        if (!list || !menu?.open) return;
        const button = (text: Message, symbol: string, action: () => void) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.textContent = symbol;
            element.title = t(text);
            element.setAttribute('aria-label', t(text));
            element.addEventListener('click', action);
            return element;
        };
        list.replaceChildren(
            ...entries().map((entry) => {
                const item = document.createElement('li');
                item.classList.toggle('replay-error', entry.error);
                const label = document.createElement('span');
                label.className = 'replay-label';
                label.textContent = label.title = entry.label;
                item.append(
                    label,
                    button('replay.watchThis', '▶', () =>
                        hooks.watch(entry.file),
                    ),
                    button('replay.downloadThis', '⬇', entry.download),
                );
                return item;
            }),
        );
    }

    menu?.addEventListener('toggle', render, options);
    const observer = new MutationObserver(render);
    if (pauseMenu) {
        observer.observe(pauseMenu, {
            attributes: true,
            attributeFilter: ['hidden'],
        });
    }
    observer.observe(root, { attributes: true, attributeFilter: ['lang'] });

    on('[data-replay-watch]', () => {
        const file = hooks.recorder.latest();
        if (file) hooks.watch(file);
        else say('replay.none');
    });
    on('[data-replay-copy]', () => {
        copyText(JSON.stringify(replayData(hooks.recorder, hooks.errorLog)))
            .then((copied) => {
                say(copied ? 'replay.copied' : 'replay.copyFailed');
            })
            .catch(() => say('replay.copyFailed'));
    });
    on('[data-replay-download]', () =>
        downloadJson(
            `the-chair-replay-data-${stamp()}.json`,
            replayData(hooks.recorder, hooks.errorLog),
        ),
    );
    return {
        destroy() {
            controller.abort();
            observer.disconnect();
        },
    };
}
