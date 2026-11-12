// Phones are played in landscape. Turning to portrait pauses a running game (the CSS rotate hint covers
// the screen), and the first tap on Start asks the browser for fullscreen + a landscape lock where supported.
// 휴대폰은 가로로 플레이한다. 세로로 돌리면 진행 중인 게임을 멈추고, 시작 버튼을 누르면 가능할 때 전체 화면과 가로 고정을 요청한다.

type OrientationLock = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

export function bindOrientation(root: HTMLElement, game: { status(): { mode: string }; pause(): void }) {
    const portrait = matchMedia('(pointer: coarse) and (orientation: portrait)');
    const onChange = () => {
        if (portrait.matches && game.status().mode === 'play') game.pause();
    };
    portrait.addEventListener('change', onChange);

    const onStart = (event: Event) => {
        if (!matchMedia('(pointer: coarse)').matches) return;
        if (!(event.target instanceof Element) || !event.target.closest('[data-start],[data-resume]')) return;
        void goLandscape();
    };
    root.addEventListener('click', onStart);
    return () => {
        portrait.removeEventListener('change', onChange);
        root.removeEventListener('click', onStart);
    };
}

async function goLandscape() {
    try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
        await (screen.orientation as OrientationLock | undefined)?.lock?.('landscape');
    } catch {
        // Unsupported (e.g. iOS Safari): the rotate hint still asks the player to turn the phone.
    }
}
