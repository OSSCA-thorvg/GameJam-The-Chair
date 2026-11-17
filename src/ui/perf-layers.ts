import { translate } from '../i18n';

import type { Locale } from '../i18n';
import type { LayerInfo, LayerOverrides } from '../render/perf';
type Row = {
    el: HTMLElement;
    info: HTMLElement;
    hide: HTMLButtonElement;
    flat: HTMLButtonElement;
    text: string;
    seen: number;
};
type Action = 'hide' | 'flat';
const KEEP_MS = 3000;
export function createLayerPanel(
    getLocale: () => Locale,
    overrides: LayerOverrides,
): {
    element: HTMLDetailsElement;
    update: (
        layers: LayerInfo[],
        canvasArea: number,
        renderMs: number,
        now: number,
    ) => void;
    applyLocale: () => void;
    set: (key: string, action: Action, on: boolean) => void;
    clear: () => void;
    keys: () => string[];
    destroy(): void;
} {
    return new LayerPanelRuntime(getLocale, overrides).api();
}
class LayerPanelRuntime {
    private getLocale!: () => Locale;
    private overrides!: LayerOverrides;
    private root!: HTMLDetailsElement;
    private summary!: HTMLElement;
    private label!: HTMLSpanElement;
    private reset!: HTMLButtonElement;
    private list!: HTMLDivElement;
    private rows!: Map<string, Row>;
    constructor(getLocale: () => Locale, overrides: LayerOverrides) {
        this.getLocale = getLocale;
        this.overrides = overrides;
        this.root = document.createElement('details');
        this.root.className = 'perf-layers';
        this.summary = document.createElement('summary');
        this.label = document.createElement('span');
        this.reset = document.createElement('button');
        this.reset.type = 'button';
        this.reset.dataset.perfLayerReset = '';
        this.summary.append(this.label, this.reset);
        this.list = document.createElement('div');
        this.list.className = 'perf-layer-list';
        this.root.append(this.summary, this.list);
        this.rows = new Map<string, Row>();
        this.root.addEventListener('click', (event) => {
            const button =
                event.target instanceof Element
                    ? event.target.closest('button')
                    : null;
            if (!button) {
                return;
            }
            button.blur();
            if (button.dataset.perfLayerReset !== undefined) {
                event.preventDefault();
                this.clear();
                return;
            }
            const key = button.closest<HTMLElement>('.perf-layer')?.dataset.key;
            const action = button.dataset.action as Action | undefined;
            if (key && action) {
                this.set(
                    key,
                    action,
                    button.getAttribute('aria-pressed') !== 'true',
                );
            }
        });
    }
    private row = (key: string) => {
        let r = this.rows.get(key);
        if (r) {
            return r;
        }
        const el = document.createElement('div');
        el.className = 'perf-layer';
        el.dataset.key = key;
        const name = document.createElement('b');
        name.textContent = key;
        name.title = key;
        const info = document.createElement('span');
        const button = (action: Action) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.action = action;
            b.setAttribute('aria-pressed', 'false');
            return b;
        };
        const hide = button('hide');
        const flat = button('flat');
        el.append(name, info, hide, flat);
        this.list.append(el);
        r = { el, info, hide, flat, text: '', seen: 0 };
        this.rows.set(key, r);
        this.applyLocaleTo(r);
        return r;
    };
    private applyLocaleTo = (r: Row) => {
        const locale = this.getLocale();
        r.hide.textContent = translate('perf.hide', locale);
        r.hide.title = translate('perf.hideHint', locale);
        r.flat.textContent = translate('perf.flatten', locale);
        r.flat.title = translate('perf.flattenHint', locale);
    };
    private applyLocale = () => {
        this.reset.textContent = translate(
            'perf.resetLayers',
            this.getLocale(),
        );
        for (const r of this.rows.values()) {
            this.applyLocaleTo(r);
        }
    };
    private set = (key: string, action: Action, on: boolean) => {
        this.row(key);
        const target =
            action === 'hide' ? this.overrides.hidden : this.overrides.flat;
        const other =
            action === 'hide' ? this.overrides.flat : this.overrides.hidden;
        if (on) {
            target.add(key);
            other.delete(key);
        } else {
            target.delete(key);
        }
        this.syncButtons();
    };
    private clear = () => {
        this.overrides.hidden.clear();
        this.overrides.flat.clear();
        this.syncButtons();
    };
    private syncButtons = () => {
        for (const [key, r] of this.rows) {
            r.hide.setAttribute(
                'aria-pressed',
                String(this.overrides.hidden.has(key)),
            );
            r.flat.setAttribute(
                'aria-pressed',
                String(this.overrides.flat.has(key)),
            );
            r.el.classList.toggle(
                'off',
                this.overrides.hidden.has(key) || this.overrides.flat.has(key),
            );
        }
    };
    private update = (
        layers: LayerInfo[],
        canvasArea: number,
        renderMs: number,
        now: number,
    ) => {
        const merged = this.summarizeLayers(layers, now, canvasArea);
        this.syncButtons();
        const active = this.overrides.hidden.size + this.overrides.flat.size;
        this.label.textContent =
            `${translate('perf.layers', this.getLocale())} ${merged.size}` +
            `${active ? ` · ${active} off` : ''} · render ${renderMs.toFixed(1)} ms`;
    };
    private summarizeLayers(
        layers: LayerInfo[],
        now: number,
        canvasArea: number,
    ) {
        const merged = new Map<
            string,
            {
                shapes: number;
                area: number;
                effects: Set<string>;
                uses: number;
            }
        >();
        for (const layer of layers) {
            const m = merged.get(layer.key) ?? {
                shapes: 0,
                area: 0,
                effects: new Set<string>(),
                uses: 0,
            };
            m.shapes += layer.shapes;
            m.area += layer.area;
            m.uses++;
            for (const effect of layer.effects) {
                m.effects.add(effect);
            }
            merged.set(layer.key, m);
        }
        for (const [key, m] of merged) {
            const r = this.row(key);
            r.seen = now;
            const pct =
                canvasArea > 0 ? Math.round((m.area / canvasArea) * 100) : 0;
            const text = `${m.uses > 1 ? `×${m.uses} ` : ''}${m.shapes} shp ${pct}% ${[...m.effects].join(' ')}`;
            if (text !== r.text) {
                r.text = text;
                r.info.textContent = text;
            }
        }
        for (const [key, r] of this.rows) {
            const overridden =
                this.overrides.hidden.has(key) || this.overrides.flat.has(key);
            if (overridden && !merged.has(key)) {
                if (r.text !== '—') {
                    r.info.textContent = r.text = '—';
                }
                continue;
            }
            if (!overridden && now - r.seen > KEEP_MS) {
                r.el.remove();
                this.rows.delete(key);
            }
        }
        return merged;
    }
    api(): {
        element: HTMLDetailsElement;
        update: (
            layers: LayerInfo[],
            canvasArea: number,
            renderMs: number,
            now: number,
        ) => void;
        applyLocale: () => void;
        set: (key: string, action: Action, on: boolean) => void;
        clear: () => void;
        keys: () => string[];
        destroy(): void;
    } {
        return {
            element: this.root,
            update: this.update,
            applyLocale: this.applyLocale,
            set: this.set,
            clear: this.clear,
            keys: this.apiKeys,
            destroy: this.apiDestroy,
        };
    }
    private apiKeys = () => {
        return [...this.rows.keys()];
    };
    private apiDestroy = () => {
        for (const r of this.rows.values()) {
            r.el.remove();
        }
        this.rows.clear();
    };
}
