export function canonicalJson(value) {
    return JSON.stringify(value, (_key, entry) => {
        if (
            entry === null ||
            typeof entry !== 'object' ||
            Array.isArray(entry)
        ) {
            return entry;
        }
        return Object.fromEntries(
            Object.keys(entry)
                .sort()
                .map((key) => [key, entry[key]]),
        );
    });
}
