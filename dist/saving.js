//LocalStorage json wrapper
const KEY_PREFIX = "entropic-threads-";
export function save(key, value) {
    try {
        if (typeof localStorage === "undefined")
            return;
        localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    }
    catch (error) { }
}
export function load(key, fallback) {
    try {
        if (typeof localStorage === "undefined")
            return fallback;
        const raw = localStorage.getItem(KEY_PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch (error) {
        return fallback;
    }
}
//# sourceMappingURL=saving.js.map