const AC_ID = /\bAC-\d+(?:\.\d+)?\b/;

/** The first AC ID in `text` (`AC-4.3`, or `AC-5` without a sub-ID), or `null`. */
export function acIdOf(text: string): string | null {
  return AC_ID.exec(text)?.[0] ?? null;
}

/** The AC ID of a test: from its own title first, then from enclosing describe titles. */
export function acIdOfTitlePath(titlePath: readonly string[]): string | null {
  for (const title of [...titlePath].reverse()) {
    const id = acIdOf(title);
    if (id !== null) return id;
  }
  return null;
}
