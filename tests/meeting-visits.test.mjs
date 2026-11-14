import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './support/load.mjs';

const { createMeetingVisits } = await loadSource(`export { createMeetingVisits } from './src/render/meeting-visits';`);

test('each walk into the meeting room counts as a new visit, and a new stage starts the count over', () => {
    const visits = createMeetingVisits();
    const at = (kind, stage = 2) => visits.observe({ stage, corridor: { room: { kind } } });
    at('corridor');
    assert.equal(visits.snapshot(), 0);
    at('entering'); at('entering'); at('meeting');
    assert.equal(visits.snapshot(), 1, 'one visit however long the entry takes');
    visits.observe({ stage: 2 });
    at('corridor'); at('entering');
    assert.equal(visits.snapshot(), 2);
    at('corridor', 3);
    assert.equal(visits.snapshot(), 0);
});
