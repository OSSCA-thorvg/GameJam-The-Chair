import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadSource } from './support/load.mjs';

const { messageTexts, fitGlyphs, SIGN_FONT, LABEL_FONT, SPEECH_FONT, entries } = await loadSource(`
    export { messageTexts } from './src/i18n';
    export { fitGlyphs, SIGN_FONT, LABEL_FONT, SPEECH_FONT } from './src/render/fonts';
    import { isMessage, translate } from './src/i18n';
    export const entries = keys => keys.filter(isMessage).flatMap(key => [translate(key, 'en'), translate(key, 'ko')]);
`);

/** Code points mapped by a TrueType font's Unicode cmap (formats 4 and 12). */
function codepoints(path) {
    const view = new DataView(readFileSync(path).buffer.slice(0));
    const tables = view.getUint16(4);
    let cmap = -1;
    for (let i = 0; i < tables; i++) {
        const at = 12 + i * 16;
        if (String.fromCharCode(...[0, 1, 2, 3].map(k => view.getUint8(at + k))) === 'cmap') cmap = view.getUint32(at + 8);
    }
    assert.ok(cmap >= 0, `${path} has a cmap`);
    const found = new Set();
    for (let i = 0; i < view.getUint16(cmap + 2); i++) {
        const sub = cmap + view.getUint32(cmap + 4 + i * 8 + 4);
        const format = view.getUint16(sub);
        if (format === 4) {
            const segs = view.getUint16(sub + 6) / 2;
            for (let s = 0; s < segs; s++) {
                const end = view.getUint16(sub + 14 + s * 2), start = view.getUint16(sub + 16 + segs * 2 + s * 2);
                const delta = view.getInt16(sub + 16 + segs * 4 + s * 2), rangeAt = sub + 16 + segs * 6 + s * 2, range = view.getUint16(rangeAt);
                for (let c = start; c <= end && c !== 0xffff; c++) {
                    const glyph = range ? view.getUint16(rangeAt + range + (c - start) * 2) : (c + delta) & 0xffff;
                    if (glyph) found.add(c);
                }
            }
        } else if (format === 12) {
            for (let g = 0; g < view.getUint32(sub + 12); g++) {
                const at = sub + 16 + g * 12;
                for (let c = view.getUint32(at); c <= view.getUint32(at + 4); c++) found.add(c);
            }
        }
    }
    return found;
}

const FILES = {
    [SIGN_FONT]: 'src/assets/fonts/BlackHanSans-sign.ttf',
    [LABEL_FONT]: 'src/assets/fonts/DoHyeon-label.ttf',
    [SPEECH_FONT]: 'src/assets/fonts/Jua-speech.ttf',
};
const KEYS = [...readFileSync('src/i18n.ts', 'utf8').matchAll(/^\s*'([\w.]+)':\s*\{ en:/gm)].map(([, key]) => key);
const keysWith = (...prefixes) => KEYS.filter(key => prefixes.some(prefix => key.startsWith(prefix)));

// Which copy each face draws in the scene; the ♪ is drawn as a vector note, never as a glyph.
const ROLES = {
    [SIGN_FONT]: keysWith('copier.', 'opening.', 'button.start'),
    [LABEL_FONT]: keysWith('world.', 'interact.', 'building.meeting', 'stageLabel.'),
    [SPEECH_FONT]: keysWith('opening.', 'building.', 'cheer.', 'chair.', 'typing.', 'player.', 'npc.', 'person.', 'orbit.'),
};

test('every font subset carries the glyphs of the copy it draws in both languages', () => {
    assert.equal(entries(KEYS).length, messageTexts().length, 'every message key is found');
    for (const [font, keys] of Object.entries(ROLES)) {
        assert.ok(keys.length > 2, `${font} draws some copy`);
        const cmap = codepoints(FILES[font]);
        const missing = new Set();
        for (const text of entries(keys)) {
            for (const c of fitGlyphs(text).replace(/♪/g, '')) if (c.trim() && !cmap.has(c.codePointAt(0))) missing.add(c);
        }
        assert.deepEqual([...missing], [], `${font} is missing glyphs; run node scripts/subset-fonts.mjs`);
    }
});

test('the subsets keep Latin letters and digits for keys and English copy', () => {
    for (const path of Object.values(FILES)) {
        const cmap = codepoints(path);
        for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') assert.ok(cmap.has(c.codePointAt(0)), `${path} lacks ${c}`);
    }
});
