import { spawn } from 'node:child_process';

export interface RunOptions {
  readonly cwd?: string;
  /** Extra environment variables, merged over `process.env`. */
  readonly env?: Readonly<Record<string, string>>;
  /** Written to the child's stdin, which is then closed. */
  readonly input?: string;
  readonly timeoutMs?: number;
}

export interface RunResult {
  /** Exit code; 127 when the command could not be started, 124 on timeout. */
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs external commands. Injected everywhere so tests never spawn processes. */
export interface CommandRunner {
  run(command: string, args: readonly string[], options?: RunOptions): Promise<RunResult>;
}

/** A {@link CommandRunner} backed by `child_process.spawn` (no shell). */
export function nodeRunner(defaultCwd: string): CommandRunner {
  return {
    run: (command, args, options = {}) =>
      new Promise((resolve) => {
        const child = spawn(command, [...args], {
          cwd: options.cwd ?? defaultCwd,
          env: { ...process.env, ...options.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const out: Buffer[] = [];
        const err: Buffer[] = [];
        let timedOut = false;
        const timer =
          options.timeoutMs === undefined
            ? undefined
            : setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
              }, options.timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
        child.on('error', (error) => {
          clearTimeout(timer);
          resolve({ code: 127, stdout: '', stderr: error.message });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            code: timedOut ? 124 : (code ?? 1),
            stdout: Buffer.concat(out).toString('utf8'),
            stderr: Buffer.concat(err).toString('utf8'),
          });
        });
        child.stdin.on('error', () => undefined);
        child.stdin.end(options.input ?? '');
      }),
  };
}
