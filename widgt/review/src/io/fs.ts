import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * The read-only slice of a file system the pure checks need. Paths are POSIX
 * paths relative to the widgt root, so checks behave the same on every OS and
 * can run against an in-memory tree in tests.
 */
export interface ReadonlyFs {
  exists(path: string): boolean;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  /** Every file under `dir`, recursively and sorted. Empty when `dir` is missing. */
  listFiles(dir: string): string[];
}

/** A {@link ReadonlyFs} backed by the real disk, rooted at `root`. */
export function nodeFs(root: string): ReadonlyFs {
  const abs = (path: string): string => join(root, ...path.split('/'));
  return {
    exists: (path) => existsSync(abs(path)),
    readText: (path) => readFileSync(abs(path), 'utf8'),
    readBytes: (path) => new Uint8Array(readFileSync(abs(path))),
    listFiles: (dir) => {
      const start = abs(dir);
      if (!existsSync(start) || !statSync(start).isDirectory()) return [];
      const entries = readdirSync(start, { recursive: true, withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const relative = join(entry.parentPath, entry.name).slice(start.length + 1);
          return posix.join(dir, ...relative.split(/[\\/]/));
        })
        .sort();
    },
  };
}

/** A {@link ReadonlyFs} over an in-memory map of path -> content, for tests. */
export function memoryFs(files: Readonly<Record<string, string | Uint8Array>>): ReadonlyFs {
  const get = (path: string): string | Uint8Array => {
    const content = files[path];
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  };
  return {
    exists: (path) => path in files || Object.keys(files).some((file) => file.startsWith(`${path}/`)),
    readText: (path) => {
      const content = get(path);
      return typeof content === 'string' ? content : new TextDecoder().decode(content);
    },
    readBytes: (path) => {
      const content = get(path);
      return typeof content === 'string' ? new TextEncoder().encode(content) : content;
    },
    listFiles: (dir) =>
      Object.keys(files)
        .filter((file) => file.startsWith(`${dir}/`))
        .sort(),
  };
}
