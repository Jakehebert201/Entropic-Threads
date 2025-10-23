//LocalStorage json wrapper
const KEY_PREFIX = "entropic-threads-";

export function save<T>(key: string, value :T){
    try{
        if(typeof localStorage === "undefined")return
            localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    }catch(error){}
}

export function load<T>(key: string, fallback: T):T{
    try{
        if(typeof localStorage === "undefined")return fallback;
        const raw = localStorage.getItem(KEY_PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    }catch(error){
        return fallback;
    }
}
