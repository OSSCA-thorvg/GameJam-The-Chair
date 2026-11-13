// All three faces are SIL OFL 1.1 (licences in src/assets/fonts), subset by scripts/subset-fonts.mjs.
/** Black Han Sans: billboards and the copiers' shouting. */
export const SIGN_FONT = 'Black Han Sans';
/** Do Hyeon: wayfinding signs and on-screen prompts. */
export const LABEL_FONT = 'Do Hyeon';
/** Jua: speech bubbles. */
export const SPEECH_FONT = 'Jua';
export type FontName = typeof SIGN_FONT | typeof LABEL_FONT | typeof SPEECH_FONT;

export const fontCss = (font: string, size: number) => `${size}px "${font}",system-ui,sans-serif`;

/** None of the faces carries these, so they become drawable lookalikes. */
export const fitGlyphs = (content: string) => content.replace(/…/g, '...').replace(/·/g, '.');
