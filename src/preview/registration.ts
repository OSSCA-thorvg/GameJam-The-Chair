import type { PreviewScene } from './types';

export type PreviewRegistration = Pick<PreviewScene, 'id' | 'label'> & { create(): PreviewScene };

export function cachePreviewRegistration(registration: PreviewRegistration): PreviewRegistration {
    let cached: PreviewScene | undefined;
    return {
        id: registration.id,
        label: registration.label,
        create: () => cached ??= registration.create(),
    };
}
