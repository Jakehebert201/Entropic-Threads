export type BuildInfo = {
  name: string;
  version: string;
  commit: string;
  branch: string;
  dirty: boolean;
  buildTime: string;
  env: string;
};

let cached: BuildInfo | null | undefined;

export async function getBuildInfo(): Promise<BuildInfo | null> {
  if (cached !== undefined) {
    return cached ?? null;
  }
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) {
      cached = null;
      return null;
    }
    const data = (await res.json()) as BuildInfo;
    cached = data;
    return data;
  } catch {
    cached = null;
    return null;
  }
}

export function formatBuildInfo(info: BuildInfo): string {
  const time = new Date(info.buildTime).toLocaleString();
  const dirty = info.dirty ? 'dirty' : 'clean';
  return `${info.version} (${info.commit}) • ${time} • ${info.env} • ${dirty}`;
}
