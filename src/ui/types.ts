/** Seconds a rider reaction and a colleague's remark stay on screen. */
export const REACTION_LIFE = 1.8;
export const SPEECH_LIFE = 3.4;
export type Reaction = {
    text: string;
    face: string;
    life: number;
    priority: number;
};
export type Speech = {
    text: string;
    name: string;
    x: number;
    life: number;
};
