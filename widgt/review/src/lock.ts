/**
 * `npm run review:lock`: (re)writes review/contract.lock from the files in
 * `DEFAULT_LOCK_SCOPE` (gates.ts). Run by a human after changing anything in
 * that scope, never by the generator: it is what G4 checks against.
 */
import { writeFileSync } from 'node:fs';
import { abs, WIDGT_ROOT } from './config';
import { computeLock, DEFAULT_LOCK_FILE, serialiseLock } from './gates';
import { nodeFs } from './io/fs';

const lock = computeLock(nodeFs(WIDGT_ROOT));
writeFileSync(abs(WIDGT_ROOT, DEFAULT_LOCK_FILE), serialiseLock(lock));
console.log(`Wrote ${DEFAULT_LOCK_FILE} with ${String(Object.keys(lock).length)} files:`);
for (const path of Object.keys(lock)) console.log(`  ${path}`);
console.log('Commit it together with the contract change, so the history shows a human moved the goalposts.');
