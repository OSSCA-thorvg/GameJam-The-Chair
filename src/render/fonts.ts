// All three faces are SIL OFL 1.1 (licences in src/assets/fonts), subset by
// scripts/subset-fonts.mjs.
export const SIGN_FONT = 'Black Han Sans';
export const LABEL_FONT = 'Do Hyeon';
export const SPEECH_FONT = 'Jua';
export type FontName =
    typeof SIGN_FONT | typeof LABEL_FONT | typeof SPEECH_FONT;

export const fontCss = (font: string, size: number) =>
    `${size}px "${font}",system-ui,sans-serif`;

export const fitGlyphs = (content: string) =>
    content.replace(/…/g, '...').replace(/·/g, '.');
