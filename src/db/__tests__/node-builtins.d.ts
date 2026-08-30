/**
 * The Node built-ins these tests use, declared locally.
 *
 * Deliberately not `@types/node`. Adding it would put `Buffer`, `process` and
 * the rest into the type space of the whole app — where they typecheck and then
 * crash, because React Native has none of them. This file names exactly the
 * surface the repository tests touch and nothing else.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
}

declare module 'node:path' {
  export function join(...segments: string[]): string;
}

declare module 'node:sqlite' {
  export type SQLValue = string | number | bigint | null | Uint8Array;

  export interface StatementSync {
    all(...params: SQLValue[]): unknown[];
    get(...params: SQLValue[]): unknown;
    run(...params: SQLValue[]): { changes: number; lastInsertRowid: number };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare const process: { cwd(): string };
