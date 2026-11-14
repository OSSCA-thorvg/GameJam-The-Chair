// The city seen through the office windows, shared by the office itself and the opening's wall clock so the two
// shots always show the same sky and the same buildings at the same hour. `dusk` runs from 0 (6 pm sunset) to
// 1 (night); at 1 the colours are exactly the night the game is played in.

// At sunset no window is lit or dark yet, so both match the building and the towers show no windows at all.
const SUNSET = { skyTop: '#f3a467', skyBottom: '#fbe3a7', building: '#9a6853', lit: '#9a6853', unlit: '#9a6853', frame: '#69788c' };
const NIGHT = { skyTop: '#202940', skyBottom: '#202940', building: '#425069', lit: '#e2cea1', unlit: '#334056', frame: '#69788c' };

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, u: number) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * u));

export type WindowView = typeof NIGHT;

/** The window view's colours at `dusk`. */
export function windowView(dusk: number): WindowView {
    const keys = Object.keys(NIGHT) as (keyof WindowView)[];
    return Object.fromEntries(keys.map(key => [key, mix(SUNSET[key], NIGHT[key], dusk)])) as WindowView;
}

/** The evening tint laid over the whole office in the opening (a multiply layer): its colour and strength. */
export function officeTint(dusk: number) {
    return { color: mix('#f4b98c', '#2e3766', dusk), strength: .5 + dusk * .38 };
}

/**
 * `color` as it ends up under the office's evening tint, so a view drawn outside the office (the clock shot)
 * matches the office windows exactly.
 */
export function underOfficeTint(color: string, dusk: number) {
    const { color: tint, strength } = officeTint(dusk);
    const t = rgb(tint);
    return hex(rgb(color).map((v, i) => v * (1 - strength + strength * t[i] / 255)));
}
