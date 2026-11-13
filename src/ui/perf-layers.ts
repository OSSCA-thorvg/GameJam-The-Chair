import { translate, type Locale } from '../i18n';
import type { LayerInfo, LayerOverrides } from '../render/perf';

/**
 * Layer list for the performance overlay. Each layer scene drawn recently gets a row with its size and
 * effects and two switches: hide (not drawn) and flatten (drawn as plain shapes, without the scene and its
 * opacity, blend, blur, clip or mask). Watching `render` while flipping them shows what a layer costs.
 */

type Row = { el: HTMLElement; info: HTMLElement; hide: HTMLButtonElement; flat: HTMLButtonElement; text: string; seen: number };
type Action = 'hide' | 'flat';

/** Rows stay this long after their layer was last drawn, so short-lived layers can still be switched. */
const KEEP_MS = 3000;

export function createLayerPanel(getLocale: () => Locale, overrides: LayerOverrides) {
    const root = document.createElement('details');
    root.className = 'perf-layers';
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.dataset.perfLayerReset = '';
    summary.append(label, reset);
    const list = document.createElement('div');
    list.className = 'perf-layer-list';
    root.append(summary, list);
    const rows = new Map<string, Row>();

    function row(key: string) {
        let r = rows.get(key);
        if (r) return r;
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
        list.append(el);
        r = { el, info, hide, flat, text: '', seen: 0 };
        rows.set(key, r);
        applyLocaleTo(r);
        return r;
    }

    function applyLocaleTo(r: Row) {
        const locale = getLocale();
        r.hide.textContent = translate('perf.hide', locale);
        r.hide.title = translate('perf.hideHint', locale);
        r.flat.textContent = translate('perf.flatten', locale);
        r.flat.title = translate('perf.flattenHint', locale);
    }

    function applyLocale() {
        reset.textContent = translate('perf.resetLayers', getLocale());
        for (const r of rows.values()) applyLocaleTo(r);
    }

    function set(key: string, action: Action, on: boolean) {
        row(key);
        const target = action === 'hide' ? overrides.hidden : overrides.flat;
        const other = action === 'hide' ? overrides.flat : overrides.hidden;
        if (on) {
            target.add(key);
            other.delete(key);
        } else {
            target.delete(key);
        }
        syncButtons();
    }

    function clear() {
        overrides.hidden.clear();
        overrides.flat.clear();
        syncButtons();
    }

    function syncButtons() {
        for (const [key, r] of rows) {
            r.hide.setAttribute('aria-pressed', String(overrides.hidden.has(key)));
            r.flat.setAttribute('aria-pressed', String(overrides.flat.has(key)));
            r.el.classList.toggle('off', overrides.hidden.has(key) || overrides.flat.has(key));
        }
    }

    root.addEventListener('click', event => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (!button) return;
        // Keep focus off overlay buttons so Space and arrows go back to the game.
        button.blur();
        if (button.dataset.perfLayerReset !== undefined) {
            event.preventDefault();
            clear();
            return;
        }
        const key = button.closest<HTMLElement>('.perf-layer')?.dataset.key;
        const action = button.dataset.action as Action | undefined;
        if (key && action) set(key, action, button.getAttribute('aria-pressed') !== 'true');
    });

    /** Refresh rows from this frame's layers (a few times a second). */
    function update(layers: LayerInfo[], canvasArea: number, renderMs: number, now: number) {
        // A key drawn twice in one frame (a reused LayerSpec) is shown as one row.
        const merged = new Map<string, { shapes: number; area: number; effects: Set<string>; uses: number }>();
        for (const layer of layers) {
            const m = merged.get(layer.key) ?? { shapes: 0, area: 0, effects: new Set<string>(), uses: 0 };
            m.shapes += layer.shapes;
            m.area += layer.area;
            m.uses++;
            for (const effect of layer.effects) m.effects.add(effect);
            merged.set(layer.key, m);
        }
        for (const [key, m] of merged) {
            const r = row(key);
            r.seen = now;
            const pct = canvasArea > 0 ? Math.round(m.area / canvasArea * 100) : 0;
            const text = `${m.uses > 1 ? `×${m.uses} ` : ''}${m.shapes} shp ${pct}% ${[...m.effects].join(' ')}`;
            if (text !== r.text) {
                r.text = text;
                r.info.textContent = text;
            }
        }
        for (const [key, r] of rows) {
            const overridden = overrides.hidden.has(key) || overrides.flat.has(key);
            if (overridden && !merged.has(key)) {
                if (r.text !== '—') r.info.textContent = r.text = '—';
                continue;
            }
            if (!overridden && now - r.seen > KEEP_MS) {
                r.el.remove();
                rows.delete(key);
            }
        }
        syncButtons();
        const active = overrides.hidden.size + overrides.flat.size;
        label.textContent = `${translate('perf.layers', getLocale())} ${merged.size}` +
            `${active ? ` · ${active} off` : ''} · render ${renderMs.toFixed(1)} ms`;
    }

    return {
        element: root,
        update,
        applyLocale,
        set,
        clear,
        /** Keys currently listed, in first-seen order. */
        keys: () => [...rows.keys()],
        destroy() {
            for (const r of rows.values()) r.el.remove();
            rows.clear();
        },
    };
}
