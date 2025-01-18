import { SemVer } from "./vers.ts";

export type NameVersion = Record<string, string>;

function jsrGetLatest(packageName: string): Promise<SemVer> {
  return get(`https://jsr.io/${packageName}/meta.json`);
}

function npmGetLatest(packageName: string): Promise<SemVer> {
  return get(`https://registry.npmjs.org/${packageName}`);
}

async function get(url: string): Promise<SemVer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`got response: ${res.statusText} for ${url}`);
  }
  const { versions } = await res.json() as {
    versions: Record<string, unknown>;
  };
  const vers = [];
  for (const v in versions) {
    vers.push(new SemVer(v));
  }

  return vers.reduce((a, b) => {
    return a.max(b);
  });
}

export type Available = {
  name: string;
  have: string;
  available: string;
  npm: boolean;
  updated?: boolean;
  isReplace?: boolean;
};

function matches(n: string, filter: string[] = []): boolean {
  if (filter.length === 0) {
    return true;
  }
  const ok = filter.find((m) => {
    const re = new RegExp(m);
    return re.test(n);
  });

  return ok !== undefined;
}

export function update(
  nv: NameVersion,
  to: Available[],
  filter: string[] = [],
): NameVersion {
  for (const b in nv) {
    if (matches(b, filter)) {
      const w = to.find((w) => w.name === b);
      if (w) {
        if (w.isReplace) {
          continue;
        }
        const old = nv[b];
        if (!old) {
          throw new Error(`no version for ${b}`);
        }
        const m = old.match(/\d+\.\d+\..*$/);
        const idx = m?.index || 0;
        const prefix = old.slice(0, idx);
        nv[b] = `${prefix}${w.available}`;
        if (w.have !== w.available) {
          w.updated = true;
        }
      }
    }
  }

  return nv;
}

export async function find(
  nv: NameVersion,
  npmHost = false,
): Promise<Available[]> {
  const a: Available[] = [];
  for (const name in nv) {
    const mn = nv[name];
    if(mn.startsWith("http") || mn.startsWith("./") || mn.startsWith("../")) {
      a.push({name, have: mn, available: mn, npm: npmHost, isReplace: true});
      continue;
    }
    const m = mn.match(/\d+\.\d+\..*$/);
    const idx = m?.index || 0;
    const have = new SemVer(mn.slice(idx));
    let npm = npmHost;
    let fn = npmHost ? npmGetLatest : jsrGetLatest;
    if (mn.startsWith("npm:@jsr/")) {
      fn = jsrGetLatest;
      npm = false;
    } else if (mn.startsWith("npm:")) {
      fn = npmGetLatest;
      npm = true;
    }
    const available = await fn(name);
    a.push({ name, have: have.string(), available: available.string(), npm });
  }
  return a;
}
