import type { SkyProjection, Point3 } from './sky-projection';
import { STAGE_FIVE } from '../../game/stages/orbit/data';

export function orbitDoor(view: SkyProjection, center: Point3) {
    const [z, y, x] = center;
    const { width, height } = STAGE_FIVE.door;
    const left = x - width / 2, right = x + width / 2, floor = y - 130, top = floor + height;
    const face = (points: Point3[], color: string) => view.polygon(points, color + 'ff');
    face([[z,floor,left],[z,top,left],[z,top,right],[z,floor,right]], '#e7b387');
    face([[z-4,floor+12,left+15],[z-4,top-16,left+15],[z-4,top-16,right-15],[z-4,floor+12,right-15]], '#ffe4ac');
    for (const edge of [left - 8, right + 8]) view.rod([z-12,floor,edge],[z-12,top+12,edge], 9, '#aa7f64');
    view.rod([z-12,top+12,left-8],[z-12,top+12,right+8], 9, '#cc9e78');
    // The ordinary office door opens out of the frame; the far room keeps its ceiling lights.
    face([[z-15,floor,right],[z-15,top,right],[z-125,top,right+90],[z-125,floor,right+90]], '#bd8d69');
    face([[z-20,floor+22,right+12],[z-20,top-28,right+12],[z-116,top-28,right+76],[z-116,floor+22,right+76]], '#ce9f77');
    view.rod([z-80,floor+130,right+52],[z-80,floor+145,right+52], 3, '#fff0ba');
    for (let i = 0; i < 3; i++) view.rod([z-9,top-50-i*40,left+40+i*12], [z-9,top-50-i*40,right-40-i*12], 4, '#fff8d8');
    view.polygon([[z-140,floor-5,left-100],[z+200,floor-5,left],[z+200,floor-5,right],[z-140,floor-5,right+100]], '#f6d5a477');
}
