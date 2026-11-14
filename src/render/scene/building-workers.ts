import type { RenderCtx } from '../context';
import type { Vector } from '../types';

type WorkerRole = 'facilitator' | 'jacket' | 'vest';

type HairStyle = 'parted' | 'bun' | 'bob' | 'crop' | 'wavy';
type OfficeAppearance = {
    hairstyle: HairStyle;
    hair: string;
    shirt: string;
    sleeve: string;
    skin: string;
    glasses: boolean;
};
const HAIRSTYLES = ['parted', 'bun', 'bob', 'crop', 'wavy'] satisfies HairStyle[];
const HAIR_COLORS = ['#343c48', '#654238', '#302f3a', '#9a9c9c', '#624c3c', '#a27754', '#3c414b', '#443731'];
const SKIN_COLORS = ['#e5c8a5', '#ddbd9d', '#d4a581', '#c69c7e', '#b88e73', '#8f654f'];
const SHIRTS = [
    { shirt: '#627fa2', sleeve: '#8aa5c1' },
    { shirt: '#a46b62', sleeve: '#c28b7d' },
    { shirt: '#b39b5c', sleeve: '#d2bd80' },
    { shirt: '#627d6e', sleeve: '#8ca58e' },
    { shirt: '#8c719a', sleeve: '#af92b7' },
    { shirt: '#d1c3a3', sleeve: '#e4d8bd' },
    { shirt: '#9c5364', sleeve: '#bf7c89' },
    { shirt: '#577e8c', sleeve: '#85a7ae' },
];

export function officeAppearance(seed: number, officeIndex: number, seatIndex: number): OfficeAppearance {
    const worker = officeIndex * 2 + seatIndex + 1;
    const roll = (trait: number) => {
        let value = seed ^ Math.imul(worker, 0x9e3779b1) ^ trait;
        value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
        value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
        return (value ^ value >>> 16) >>> 0;
    };
    return {
        hairstyle: HAIRSTYLES[roll(1) % HAIRSTYLES.length],
        hair: HAIR_COLORS[roll(2) % HAIR_COLORS.length],
        ...SHIRTS[roll(3) % SHIRTS.length],
        skin: SKIN_COLORS[roll(4) % SKIN_COLORS.length],
        glasses: roll(5) % 2 === 0,
    };
}
const HAIR_SHAPES: Record<HairStyle, Vector[]> = {
    parted: [[-15,-4],[-16,-11],[-10,-19],[1,-22],[12,-16],[16,-9],[5,-13],[-7,-5],[-10,4],[-14,1]],
    bun: [[-15,-4],[-16,-11],[-10,-19],[1,-22],[12,-16],[16,-9],[5,-13],[-7,-5],[-10,4],[-14,1]],
    bob: [[-16,15],[-18,-6],[-13,-19],[0,-22],[12,-17],[17,-7],[8,-10],[-3,-12],[-6,4],[-6,17]],
    crop: [[-14,1],[-15,-10],[-9,-17],[5,-18],[12,-13],[14,-8],[4,-9],[-8,-7],[-10,3]],
    wavy: [[-16,1],[-18,-9],[-13,-18],[-6,-16],[0,-23],[6,-18],[13,-19],[17,-9],[7,-12],[3,-8],[-3,-12],[-8,-3],[-10,5]],
};

export function head(ctx: RenderCtx, x: number, y: number, facing: number, hair: string, hairstyle: HairStyle = 'parted', glasses = false, skin = '#ddbd9d') {
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);
    if (hairstyle === 'bun') ctx.ellipse(x - facing * 13, y + 6, 8, 9, hair);
    if (hairstyle === 'bob') shape([[-17,-10],[-8,-13],[-4,16],[-16,17]], hair);
    shape([[-11, -13], [6, -16], [12, -8], [14, -1], [17, 1], [13, 3],
        [11, 11], [0, 15], [-10, 10], [-13, 1]], skin);
    shape(HAIR_SHAPES[hairstyle], hair);
    shape([[7, -2], [11, -2], [11, 0], [7, 0]], '#4c4951');
    if (glasses) {
        // Side on the lens is edge-on: a thin line just in front of the face, frame tips at its ends, and the arm
        // running back to the ear (as the 3D rider's glasses look from the side).
        const rod = (ax: number, ay: number, bx: number, by: number, width: number, color: string) =>
            ctx.rod(x + facing * ax, y + ay, x + facing * bx, y + by, width, color);
        rod(-8, -4, 14.6, -3, 1.6, '#374958');
        rod(15.2, -6.5, 15.2, 3.5, 1.6, '#9cc4d4');
        rod(15.2, -6.8, 15.2, -5.6, 2, '#374958');
        rod(15.2, 2.6, 15.2, 3.8, 2, '#374958');
    }
}

function facilitatorArms(ctx: RenderCtx, x: number, y: number, facing: number, fabric: string, light: string, palm?: Vector) {
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);
    shape([[-13,-63],[12,-65],[16,-42],[-9,-39]], '#b1a17d');
    shape([[-9,-59],[9,-61],[12,-45],[-7,-43]], '#e0d4bb');
    shape([[-4,-62],[5,-63],[6,-59],[-3,-58]], '#8c9296');
    shape([[-18,-73],[-14,-62],[-7,-56],[-9,-51],[-16,-55],[-23,-68]], light);
    shape([[-11,-57],[-5,-55],[-6,-50],[-13,-52]], '#d7b493');
    if (palm) {
        const elbowX = x + (palm[0] - x) * .56;
        const elbowY = y - 72;
        ctx.rod(x + facing * 13, y - 79, elbowX, elbowY, 9, fabric);
        ctx.rod(elbowX, elbowY, palm[0], palm[1], 7, light);
        ctx.ellipse(palm[0], palm[1], 4, 3.2, '#ddbd9d');
    } else {
        shape([[14,-80],[21,-74],[29,-69],[36,-72],[38,-68],[29,-63],[19,-66],[12,-72]], fabric);
        shape([[34,-71],[40,-75],[44,-73],[40,-67],[36,-67]], '#ddbd9d');
    }
}

export function worker(ctx: RenderCtx, x: number, y: number, role: WorkerRole, facing = 1, palm?: Vector) {
    const facilitator = role === 'facilitator';
    const vest = role === 'vest';
    const fabric = facilitator ? '#715c75' : vest ? '#877b70' : '#5b6b83';
    const light = facilitator ? '#88718a' : vest ? '#9b8c7d' : '#72829a';
    const hair = facilitator ? '#4f414d' : vest ? '#494755' : '#424b5a';
    const stride = palm ? 5 : 0;
    const shape = (points: Vector[], color: string) =>
        ctx.polygon(points.map(([px, py]) => [x + facing * px, y + py]), color);

    ctx.ellipse(x, y + 1, 25, 3, '#35465624');
    shape([[-13,-45],[12,-45],[16+stride,-4],[6+stride,-4],[0,-35],[-6,-4],[-16-stride,-4]], '#485467');
    shape([[-16-stride,-7],[-6,-7],[-4,0],[-22-stride,0],[-22-stride,-3]], '#34404c');
    shape([[6+stride,-7],[16+stride,-7],[23+stride,-2],[23+stride,0],[6+stride,0]], '#34404c');
    const hem = facilitator ? -35 : -43;
    shape([[-17,-84],[-8,-90],[10,-90],[20,-83],[16,-67],[19,hem],[-17,hem],[-15,-63],[-23,-68]], fabric);
    shape([[-17,-84],[-8,-90],[-5,hem],[-17,hem],[-15,-63],[-23,-68]], light);
    shape([[-9,-89],[11,-89],[2,-67]], '#e8e3d3');
    shape([[-6,-98],[7,-98],[9,-89],[1,-84],[-6,-90]], '#b99a80');
    head(ctx, x, y - 105, facing, hair, facilitator ? 'bun' : 'parted');

    if (facilitator) {
        facilitatorArms(ctx, x, y, facing, fabric, light, palm);
    } else if (vest) {
        shape([[0,-85],[4,-84],[3,-75],[0,-74],[-2,-78]], '#a76e56');
        shape([[-17,-77],[-23,-61],[-13,-54],[6,-58],[4,-64],[-11,-62],[-8,-74]], '#e9e3d6');
        shape([[13,-79],[20,-70],[15,-59],[8,-60],[10,-69],[7,-77]], '#e9e3d6');
        shape([[9,-69],[6,-77],[8,-86],[13,-85],[13,-77],[15,-70]], '#ddbd9d');
    } else {
        shape([[-16,-78],[-22,-60],[-13,-54],[2,-56],[0,-63],[-10,-62],[-8,-75]], light);
        shape([[15,-79],[21,-64],[16,-55],[-5,-55],[-6,-62],[11,-63],[8,-75]], fabric);
        shape([[-8,-64],[-1,-62],[-1,-57],[-9,-58]], '#ddbd9d');
        shape([[5,-62],[12,-63],[14,-58],[7,-57]], '#ddbd9d');
    }
}

export function typingWorker(ctx: RenderCtx, x: number, y: number, look: OfficeAppearance) {
    const { shirt, sleeve, skin } = look;
    const tap = Math.sin(ctx.t * 16 + x * .07) * 1.4;
    ctx.rect(x - 21, y - 39, 11, 37, '#556673');
    ctx.polygon([[x-13,y-42],[x+3,y-44],[x+10,y-30],[x+7,y-1],[x-13,y-1]], shirt);
    ctx.polygon([[x-12,y-39],[x-5,y-40],[x-3,y-1],[x-13,y-1]], sleeve);
    ctx.polygon([[x-5,y-51],[x+6,y-51],[x+8,y-42],[x+1,y-38],[x-5,y-43]], skin);
    head(ctx, x, y - 58, 1, look.hair, look.hairstyle, look.glasses, skin);
    ctx.rect(x - 29, y, 74, 7, '#a7a18e');
    ctx.rod(x-3,y-34,x+6,y-14,8,sleeve);
    ctx.rod(x+6,y-14,x+24,y-5+tap,5,skin);
    ctx.ellipse(x+26,y-4+tap,4,2.5,skin);
    ctx.rect(x + 17, y - 3, 17, 3, '#455665');
    ctx.polygon([[x+30,y-35],[x+46,y-36],[x+44,y-14],[x+28,y-13]], '#526674');
    ctx.rod(x+36,y-14,x+36,y-3,3,'#526674');
    ctx.rect(x + 31, y - 3, 12, 3, '#526674');
}
