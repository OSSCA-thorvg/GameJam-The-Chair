type OrientationLock = ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
};

export function bindOrientation(
    root: HTMLElement,
    game: { status(): { mode: string }; pause(): void },
) {
    const portrait = matchMedia(
        '(pointer: coarse) and (orientation: portrait)',
    );
    const onChange = () => {
        if (portrait.matches && game.status().mode === 'play') game.pause();
    };
    portrait.addEventListener('change', onChange);

    const onStart = (event: Event) => {
        if (!matchMedia('(pointer: coarse)').matches) return;
        if (
            !(event.target instanceof Element) ||
            !event.target.closest('[data-start],[data-resume]')
        ) {
            return;
        }
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
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen?.({
                navigationUI: 'hide',
            });
        }
        await (screen.orientation as OrientationLock | undefined)?.lock?.(
            'landscape',
        );
    } catch {}
}
