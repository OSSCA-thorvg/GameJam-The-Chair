import type { PreviewScene } from './preview-scenes';

/** Keep menu metadata available without recording unselected scenes. */
export function lazyPreviewScene(id: string, label: string, create: () => PreviewScene): PreviewScene {
    let cached: PreviewScene | undefined;
    const scene = () => cached ??= create();
    return {
        id, label,
        get duration() { return scene().duration; },
        get focusX() { return scene().focusX; },
        get follow() { return scene().follow; },
        get markers() { return scene().markers; },
        get opening() { return scene().opening; },
        get talk() { return scene().talk; },
        get title() { return scene().title; },
        sample(time) { return scene().sample(time); },
    };
}
