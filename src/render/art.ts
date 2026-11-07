// Safe artwork controls: these values are never read by game/game.ts.
// Keep artwork aligned with the fixed gameplay colliders; use debugCollisions to inspect them.
export const ART = {
    palette: { ink: '#292d38', wall: '#adb3c1', floor: '#b9bbc0', paper: '#f4ecd7', wood: '#d7ad72', steel: '#9098a3', skin: '#e4cba6', shirt: '#f1eee4' },
    monitor: { desk: 2210, x: 2281, y: 275 },
    binBottom: 520,
    player: { offsetX: 0, offsetY: 0, scale: 1 },
    debugCollisions: false
};
export const EFFECT_STYLE = {
    paperDuration: 2.4, glareDuration: 1.65, copierFlashDuration: .55, splashCount: 48, speckColor: '#7c8870'
};
