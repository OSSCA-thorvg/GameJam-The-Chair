import type { Vector } from '../types';
import type { Point3, SkyProjection } from './sky-projection';
import { PLAYER_OUTLINES } from './player-art';

const OUTLINE: Vector[] = [...PLAYER_OUTLINES.hair.slice(0, 3), [15, -92], [6, -91], [-2, -84], [-10, -77]];
type Section = { z: number; crownDrop: number; napeLift: number; round: number };
// Rounded temples and a slightly off-centre crown preserve the swept side silhouette from behind.
const SECTIONS: Section[] = [
    { z: -14.2, crownDrop: 3.4, napeLift: 4, round: 2.3 },
    { z: -11, crownDrop: 1.2, napeLift: 1.5, round: .8 },
    { z: -5, crownDrop: 0, napeLift: 0, round: 0 },
    { z: 4, crownDrop: .6, napeLift: .7, round: 0 },
    { z: 11, crownDrop: 2, napeLift: 2, round: .8 },
    { z: 14.2, crownDrop: 4.5, napeLift: 4.5, round: 2.3 },
];

function vertex(section: Section, [x, y]: Vector, bob: number): Point3 {
    const crown = Math.max(0, Math.min(1, (-y - 85) / 15));
    const nape = Math.max(0, Math.min(1, (y + 85) / 8));
    return [x + section.round * Math.max(0, -x / 15),
        -y - 35 + bob - section.crownDrop * crown + section.napeLift * nape,
        section.z * (1 - crown * .16 - nape * .12)];
}

export function endingHair(view: SkyProjection, bob: number) {
    const area = OUTLINE.reduce((sum, p, i) => {
        const next = OUTLINE[(i + 1) % OUTLINE.length];
        return sum - p[0] * next[1] + next[0] * p[1];
    }, 0);
    const outline = area > 0 ? OUTLINE : [...OUTLINE].reverse();
    const rings = SECTIONS.map(section => outline.map(point => vertex(section, point, bob)));
    view.polygon([...rings[0]].reverse(), '#3c424f');
    view.polygon(rings[rings.length - 1], '#3c424f');
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < outline.length; i++) {
        const next = (i + 1) % outline.length;
        const color = r === 1 ? '#434b59' : r === 4 ? '#353c49' : '#3c424f';
        view.polygon([rings[r][i], rings[r][next], rings[r + 1][next], rings[r + 1][i]], color);
    }
    sweptPart(view, bob);
}

function sweptPart(view: SkyProjection, bob: number) {
    const point = (section: Section, along: number): Point3 => {
        const p = vertex(section, [-15 + along * 10, -87 - along * 13], bob);
        return [p[0] - .2, p[1], p[2]];
    };
    // A short diagonal lock sits on the rear surface, rather than floating above a flat end cap.
    for (let i = 1; i < 4; i++) {
        const u = .12 + (i - 1) * .13;
        view.polygon([point(SECTIONS[i], u), point(SECTIONS[i + 1], u + .13),
            point(SECTIONS[i + 1], u + .22), point(SECTIONS[i], u + .09)], '#505968');
    }
}
