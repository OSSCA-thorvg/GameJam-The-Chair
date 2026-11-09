import type { Animation, Canvas } from '@thorvg/webcanvas';
import splashData from '../../assets/powred.by.thorvg.1.json?raw';
import { loadThorvg } from '../render/thorvg';
import { SPLASH_DURATION } from './splash-meta';

const WIDTH = 960;
const HEIGHT = 540;

export function createSplashPlayer(element: HTMLCanvasElement) {
    let canvas: Canvas | null = null;
    let animation: Animation | null = null;
    let disposed = false;
    const ready = (async () => {
        const TVG = await loadThorvg();
        if (disposed) return;
        const nextAnimation = new TVG.Animation();
        try {
            nextAnimation.load(splashData);
            const picture = nextAnimation.picture;
            if (!picture) throw new Error('Splash picture is unavailable.');
            picture.size(WIDTH, HEIGHT);
            const nextCanvas = new TVG.Canvas(element, { width: WIDTH, height: HEIGHT });
            nextCanvas.add(picture);
            if (disposed) {
                nextCanvas.destroy();
                nextAnimation.dispose();
                return;
            }
            animation = nextAnimation;
            canvas = nextCanvas;
            draw(0);
        } catch (error) {
            nextAnimation.dispose();
            throw error;
        }
    })();

    function draw(seconds: number) {
        if (!animation || !canvas) return;
        animation.seek(Math.max(0, Math.min(SPLASH_DURATION - 1 / 30, seconds)));
        canvas.update().render();
    }

    return {
        ready,
        draw,
        destroy() {
            disposed = true;
            canvas?.destroy();
            animation?.dispose();
            canvas = null;
            animation = null;
        },
    };
}

export function showStartupSplash(getLocale: () => 'en' | 'ko') {
    const screen = document.createElement('div');
    screen.className = 'startup-splash';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-label', 'Powered by ThorVG');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'startup-splash-skip';
    skip.textContent = getLocale() === 'ko' ? '건너뛰기' : 'Skip';
    screen.append(canvas, skip);
    document.body.append(screen);
    const player = createSplashPlayer(canvas);
    let started: number | null = null;
    let frameId = 0;
    let closed = false;
    const finish = () => {
        if (closed) return;
        closed = true;
        cancelAnimationFrame(frameId);
        player.destroy();
        screen.remove();
        document.querySelector<HTMLButtonElement>('[data-start]')?.focus();
    };
    skip.addEventListener('click', finish);
    screen.addEventListener('keydown', event => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            finish();
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
        }
    });
    skip.focus();
    function tick(ms: number) {
        if (closed) return;
        started ??= ms;
        const elapsed = (ms - started) / 1000;
        if (elapsed >= SPLASH_DURATION) return finish();
        player.draw(elapsed);
        frameId = requestAnimationFrame(tick);
    }
    void player.ready.then(() => {
        if (!closed) frameId = requestAnimationFrame(tick);
    }).catch(error => {
        console.error('Splash unavailable', error);
        finish();
    });
    return finish;
}
