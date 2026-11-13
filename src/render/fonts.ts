/**
 * Black Han Sans (SIL OFL 1.1, see src/assets/fonts/OFL-BlackHanSans.txt), subset to printable ASCII and the
 * stage-four billboard copy. ThorVG draws it as vector Text inside the scene, so actors pass in front of it.
 * Black Han Sans(OFL)를 간판 문구와 ASCII만 남겨 넣었다. ThorVG Text로 장면 안에 그려 캐릭터가 앞을 지나간다.
 */
export const SIGN_FONT = 'Black Han Sans';

/** CSS font stack for Canvas2D measuring and the Canvas2D fallback; same face once the document has loaded it. */
export const signFontCss = (size: number) => `${size}px "${SIGN_FONT}",Impact,"Arial Narrow",system-ui,sans-serif`;
