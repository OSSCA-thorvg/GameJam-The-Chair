import { STAGE_FIVE } from '../../game/stages/orbit/data';

// Stage five's route is a straight line in play (every position is measured across and up from it), but it is
// drawn bending gently from side to side, so the camera keeps turning to follow it. Straight at the start (the
// stage four hand-off) and through the final approach into the Earth's shadow.

const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
};

/** Sideways offset of the drawn route at depth `z`. */
export function routeCurve(z: number) {
    const fade = smooth(z / 1500) * (1 - smooth((z - (STAGE_FIVE.checkpoint.z - 1300)) / 900));
    return fade * (700 * Math.sin(z / 2400) + 300 * Math.sin(z / 950 + 1));
}

/** Slope of the route at depth `z`: how far the camera is turned to follow it. */
export function routeHeading(z: number) {
    return (routeCurve(z + 1) - routeCurve(z - 1)) / 2;
}

/**
 * How far a point `dz` ahead of the chair is swung sideways by the bend, seen along the route's heading at the
 * chair; 0 at the chair itself, growing ahead of it.
 */
export function routeBend(travel: number, heading: number, dz: number) {
    return routeCurve(travel + dz) - routeCurve(travel) - heading * dz;
}
