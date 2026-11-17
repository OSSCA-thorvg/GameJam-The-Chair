import { replayLength } from '../game/replay';
import { isMessage, translate } from '../i18n';
import { copyText, downloadJson, replayData, stamp } from './replay-store';

import type { Recorder, ReplayFile } from '../game/replay';
import type { Locale, Message } from '../i18n';
import type { ErrorLog } from './replay-store';
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
): {
    destroy(): void;
} {
    return new ReplayMenuBinding(root, getLocale, hooks).api();
}
class ReplayMenuBinding {
    private root!: HTMLElement;
    private getLocale!: () => Locale;
    private hooks!: Hooks;
    private controller!: AbortController;
    private options!: {
        signal: AbortSignal;
    };
    private message!: HTMLElement | null;
    private list!: HTMLOListElement | null;
    private menu!: HTMLDetailsElement | null;
    private pauseMenu!: HTMLElement | null;
    private t: (text: Message) => string = (text: Message) => {
        return translate(text, this.getLocale());
    };
    private say: (text: Message) => void = (text: Message) => {
        if (this.message) {
            this.message.textContent = this.t(text);
        }
    };
    private on: (selector: string, action: () => void) => void | undefined = (
        selector: string,
        action: () => void,
    ) => {
        return this.root
            .querySelector(selector)
            ?.addEventListener('click', action, this.options);
    };
    private stageName: (stage: number) => string = (stage: number) => {
        const key = `stageLabel.stage${stage}`;
        return isMessage(key) ? this.t(key) : String(stage);
    };
    private seconds: (file: ReplayFile) => string = (file: ReplayFile) => {
        return `${(replayLength(file) / 120).toFixed(1)}s`;
    };
    private clock: (time: string) => string = (time: string) => {
        const date = new Date(time);
        return Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleTimeString(this.getLocale(), {
                  hour: '2-digit',
                  minute: '2-digit',
              });
    };
    private observer!: MutationObserver;
    constructor(root: HTMLElement, getLocale: () => Locale, hooks: Hooks) {
        this.root = root;
        this.getLocale = getLocale;
        this.hooks = hooks;
        this.controller = new AbortController();
        this.options = { signal: this.controller.signal };
        this.message = this.root.querySelector<HTMLElement>(
            '[data-replay-message]',
        );
        this.list =
            this.root.querySelector<HTMLOListElement>('[data-replay-list]');
        this.menu =
            this.root.querySelector<HTMLDetailsElement>('[data-replay-menu]');
        this.pauseMenu =
            this.root.querySelector<HTMLElement>('[data-pause-menu]');
        this.menu?.addEventListener('toggle', this.render, this.options);
        this.observer = new MutationObserver(this.render);
        if (this.pauseMenu) {
            this.observer.observe(this.pauseMenu, {
                attributes: true,
                attributeFilter: ['hidden'],
            });
        }
        this.observer.observe(this.root, {
            attributes: true,
            attributeFilter: ['lang'],
        });
        this.on('[data-replay-watch]', () => {
            const file = this.hooks.recorder.latest();
            if (file) {
                this.hooks.watch(file);
            } else {
                this.say('replay.none');
            }
        });
        this.on('[data-replay-copy]', () => {
            copyText(
                JSON.stringify(
                    replayData(this.hooks.recorder, this.hooks.errorLog),
                ),
            )
                .then((copied) => {
                    this.say(copied ? 'replay.copied' : 'replay.copyFailed');
                })
                .catch(() => this.say('replay.copyFailed'));
        });
        this.on('[data-replay-download]', () =>
            downloadJson(
                `the-chair-replay-data-${stamp()}.json`,
                replayData(this.hooks.recorder, this.hooks.errorLog),
            ),
        );
    }
    private entries = (): Entry[] => {
        const attempts = this.hooks.recorder
            .attempts()
            .map((file, i): Entry => ({
                label: [
                    `#${i + 1}`,
                    this.stageName(file.start.stage),
                    this.seconds(file),
                    i === 0 && this.hooks.recorder.recording
                        ? this.t('replay.current')
                        : '',
                    file.error ? this.t('replay.error') : '',
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
        const errors = [...this.hooks.errorLog.entries]
            .reverse()
            .flatMap((entry): Entry[] =>
                entry.replay
                    ? [
                          {
                              label: `⚠ ${[this.clock(entry.time), this.stageName(entry.replay.start.stage), entry.message].filter(Boolean).join(' · ')}`,
                              error: true,
                              file: entry.replay,
                              download: () =>
                                  downloadJson(
                                      `the-chair-replay-error-${stamp()}.json`,
                                      {
                                          ...replayData(
                                              this.hooks.recorder,
                                              this.hooks.errorLog,
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
    };
    private render = () => {
        if (!this.list || !this.menu?.open) {
            return;
        }
        const button = (text: Message, symbol: string, action: () => void) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.textContent = symbol;
            element.title = this.t(text);
            element.setAttribute('aria-label', this.t(text));
            element.addEventListener('click', action);
            return element;
        };
        this.list.replaceChildren(
            ...this.entries().map((entry) => {
                const item = document.createElement('li');
                item.classList.toggle('replay-error', entry.error);
                const label = document.createElement('span');
                label.className = 'replay-label';
                label.textContent = label.title = entry.label;
                item.append(
                    label,
                    button('replay.watchThis', '▶', () =>
                        this.hooks.watch(entry.file),
                    ),
                    button('replay.downloadThis', '⬇', entry.download),
                );
                return item;
            }),
        );
    };
    api(): {
        destroy(): void;
    } {
        return {
            destroy: this.apiDestroy,
        };
    }
    private apiDestroy = () => {
        this.controller.abort();
        this.observer.disconnect();
    };
}
