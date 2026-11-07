import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' });
    return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
const { resolveLocale, translate, isMessage } = await load('src/i18n.ts');
const { createFeedback } = await load('src/ui/feedback.ts');
const { createGame } = await load('src/game/game.ts');

test('language detection respects supported browser preferences and falls back to English', () => {
    assert.equal(resolveLocale(['ko-KR', 'en-US']), 'ko');
    assert.equal(resolveLocale(['en-GB', 'ko']), 'en');
    assert.equal(resolveLocale(['fr-FR', 'ko-KR']), 'ko');
    assert.equal(resolveLocale(['fr-FR']), 'en');
    assert.equal(resolveLocale([]), 'en');
});

test('switching language translates an active conversation without restarting or extending it', () => {
    let locale = 'ko';
    const game = createGame();
    const state = game.getSnapshot();
    const feedback = createFeedback(() => locale);
    feedback.receive({ type: 'cue', id: 'light-hit' }, state);
    feedback.receive({ type: 'cue', id: 'light-comment' }, state);
    feedback.receive({ type: 'tick', dt: .5 }, state);
    const before = feedback.snapshot();
    locale = 'en';
    const after = feedback.snapshot();
    assert.equal(after.speech.text, 'A bright future, right?');
    assert.equal(after.speech.name, 'Coworker');
    assert.equal(after.reaction.text, "Too bright… I can't see my numbers!");
    assert.equal(after.speech.life, before.speech.life);
    assert.equal(after.reaction.life, before.reaction.life);
    assert.equal(after.speech.x, before.speech.x);
    assert.deepEqual(game.getSnapshot(), state);
    locale = 'ko';
    assert.equal(feedback.snapshot().speech.text, '밝은 미래가 보이죠?');
});

test('English is the default and failure panels change language while already displayed', () => {
    const state = createGame().getSnapshot();
    const english = createFeedback();
    english.receive({ type: 'cue', id: 'person-comment', person: { id: 'manager', x: 320, said: true } }, state);
    assert.equal(english.snapshot().speech.text, 'Leaving already?');
    let locale = 'en';
    const feedback = createFeedback(() => locale);
    feedback.receive({ type: 'cue', id: 'head-game-over' }, state);
    assert.equal(feedback.snapshot().panel.title, 'Your head clocked out first.');
    assert.equal(feedback.snapshot().panel.button, 'Retry');
    locale = 'ko';
    assert.equal(feedback.snapshot().panel.title, '머리가 먼저 퇴근했습니다.');
    assert.equal(feedback.snapshot().panel.button, '다시');
});

test('printer sound and every localized menu attribute have both languages', async () => {
    assert.equal(translate('PTUI! PTUI!!', 'en'), 'PTUI! PTUI!!');
    assert.equal(translate('PTUI! PTUI!!', 'ko'), '퉤! 퉷!!');
    const markup = await readFile('src/scene.html', 'utf8');
    for (const [, encoded] of markup.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) {
        const message = encoded.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<');
        assert.ok(isMessage(message), `Unknown translation: ${message}`);
        assert.ok(translate(message, 'ko'));
        assert.doesNotMatch(translate(message, 'en'), /[가-힣]/);
    }
});
