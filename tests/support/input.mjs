export function installInputEnvironment(t) {
    const names = [
        'window',
        'document',
        'Element',
        'HTMLElement',
        'MutationObserver',
    ];
    const saved = names.map(
        (name) =>
            /** @type {const} */ ([
                name,
                Object.getOwnPropertyDescriptor(globalThis, name),
            ]),
    );
    t.after(() => {
        for (const [name, descriptor] of saved) {
            if (descriptor) {
                Object.defineProperty(globalThis, name, descriptor);
            } else {
                delete globalThis[name];
            }
        }
    });
    const window = new EventTarget();
    class Element {}
    Object.assign(globalThis, {
        window,
        document: Object.assign(new EventTarget(), {
            querySelector: () => null,
        }),
        Element,
        HTMLElement: Element,
        MutationObserver: class {
            observe() {}
            disconnect() {}
        },
    });
    return {
        window,
        key(type, name, code = name, repeat = false) {
            const event = new Event(type, { cancelable: true });
            Object.assign(event, { key: name, code, repeat });
            window.dispatchEvent(event);
            return event;
        },
    };
}

export function inputButton(dataset = {}) {
    return Object.assign(new EventTarget(), {
        dataset,
        setPointerCapture() {},
    });
}
