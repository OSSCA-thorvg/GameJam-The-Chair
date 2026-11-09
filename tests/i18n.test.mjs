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
const { CHAIR_CHAT, CHAIR_DEPARTURE_LINES } = await load('src/game/stage2.ts');

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
    feedback.receive({ type: 'cue', id: 'light-comment', monitorIndex: 0 }, state);
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

test('new lift dialogue and forced clock-out remain localized through message IDs', () => {
    assert.deepEqual(CHAIR_CHAT.rush.map(line => translate(line.text, 'en')), [
        'Late! Hold on to your humans!',
        'The rookie is coming too!',
        'No brakes till clock-out!',
    ]);
    assert.equal(translate(CHAIR_DEPARTURE_LINES.companions[0].text, 'ko'), '잘 굴러왔네, 신입.');
    assert.equal(translate(CHAIR_DEPARTURE_LINES.abduction[0].text, 'ko'), '신입! 사람도 같이 퇴근이야!');
    let locale = 'en';
    const feedback = createFeedback(() => locale);
    feedback.receive({ type: 'cue', id: 'lift-game-over' }, createGame().getSnapshot());
    assert.equal(feedback.snapshot().panel.title, 'The mechanical room stayed upstairs.');
    locale = 'ko';
    assert.equal(feedback.snapshot().panel.k, '강제 퇴근');
    assert.equal(feedback.snapshot().panel.title, '기계실은 위에 남았습니다.');
});

test('printer sound and every localized menu attribute have both languages', async () => {
    assert.equal(translate('copier.printer', 'en'), 'PTUI! PTUI!!');
    assert.equal(translate('copier.printer', 'ko'), '퉤! 퉷!!');
    const markup = await readFile('src/scene.html', 'utf8');
    for (const [, encoded] of markup.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) {
        const message = encoded.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<');
        assert.ok(isMessage(message), `Unknown translation: ${message}`);
        assert.ok(translate(message, 'ko'));
        assert.doesNotMatch(translate(message, 'en'), /[가-힣]/);
    }
});
