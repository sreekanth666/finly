import * as Crypto from 'expo-crypto';

/**
 * UUID v4 rather than an autoincrementing integer, so a restored backup or a
 * future sync can never collide with rows minted on another device (§5).
 *
 * Behind a function so tests and fixtures can substitute a deterministic source.
 */
export const newId = (): string => Crypto.randomUUID();
