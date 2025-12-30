/**
 * @fileoverview Seeded Random Number Generator for Dungeon Roguelike
 * 
 * This module provides deterministic random number generation using a
 * Mulberry32-variant algorithm. Using seeds allows for reproducible
 * dungeon generation and game runs.
 * 
 * @module game/seed
 */

// Re-export DungeonLayer from types for backwards compatibility
export type { DungeonLayer } from '../types/dungeon';

/**
 * Seeded random number generator using a variant of the Mulberry32 algorithm.
 * Provides deterministic random numbers for reproducible game runs.
 * 
 * @example
 * ```typescript
 * const rng = new Seed('my-game-seed');
 * const roll = rng.nextInt(1, 20); // Always same result for same seed
 * const item = rng.choice(['sword', 'shield', 'potion']);
 * ```
 */
export class Seed {
    /** Internal seed state (32-bit integer) */
    private seed: number

    /**
     * Creates a new seeded RNG instance.
     * 
     * @param seed - Either a string (will be hashed) or a number to use as the seed
     */
    constructor(seed: string | number) {
        if (typeof seed === 'string') {
            this.seed = this.hashString(seed);
        } else {
            this.seed = seed;
        }
    }

    /**
     * Hashes a string into a 32-bit integer for use as a seed.
     * Uses a simple but effective hash algorithm.
     * 
     * @param str - The string to hash
     * @returns A positive 32-bit integer hash
     * @private
     */
    private hashString(str: string): number {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash)
    }

    /**
     * Generates the next raw 32-bit unsigned integer in the sequence.
     * This is the core RNG function using Mulberry32 algorithm.
     * 
     * @returns A 32-bit unsigned integer (0 to 4294967295)
     */
    next(): number {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return (t ^ (t >>> 14)) >>> 0
    }

    /**
     * Generates a random float between 0 (inclusive) and 1 (exclusive).
     * 
     * @returns A float in the range [0, 1)
     */
    nextFloat(): number {
        return this.next() / 0xFFFFFFFF;
    }

    /**
     * Generates a random integer within a range (inclusive on both ends).
     * 
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     * @returns An integer in the range [min, max]
     * 
     * @example
     * ```typescript
     * const d20 = rng.nextInt(1, 20); // Roll a d20
     * const damage = rng.nextInt(5, 10); // 5-10 damage
     * ```
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.nextFloat() * (max - min + 1)) + min
    }

    /**
     * Selects a random element from an array.
     * 
     * @param array - The array to select from
     * @returns A randomly selected element
     * @template T - The type of elements in the array
     * 
     * @example
     * ```typescript
     * const enemy = rng.choice(['goblin', 'orc', 'troll']);
     * ```
     */
    choice<T>(array: T[]): T {
        return array[this.nextInt(0, array.length - 1)]
    }

    /**
     * Shuffles an array in place using the Fisher-Yates algorithm.
     * 
     * @param array - The array to shuffle (modified in place)
     * @returns The same array, now shuffled
     * @template T - The type of elements in the array
     * 
     * @example
     * ```typescript
     * const deck = ['A', 'B', 'C', 'D'];
     * rng.shuffle(deck); // deck is now randomly ordered
     * ```
     */
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Returns true with the given probability.
     * 
     * @param probability - Probability of returning true (0 to 1)
     * @returns true with the specified probability
     * 
     * @example
     * ```typescript
     * if (rng.chance(0.3)) {
     *   // 30% chance to execute
     * }
     * ```
     */
    chance(probability: number): boolean {
        return this.nextFloat() < probability;
    }

    /**
     * Returns true with the given percentage chance.
     * 
     * @param percent - Percentage chance of returning true (0 to 100)
     * @returns true with the specified percentage chance
     * 
     * @example
     * ```typescript
     * if (rng.percentChance(15)) {
     *   // 15% critical hit chance
     * }
     * ```
     */
    percentChance(percent: number): boolean {
        return this.nextFloat() * 100 < percent;
    }
}

/**
 * Global RNG instance for the game.
 * Initialize with initializeRNG() before use.
 * @private
 */
let globalRNG: Seed | null = null;

/**
 * Initializes the global RNG with a seed string.
 * Call this once at game start before any random operations.
 * 
 * @param seed - The seed string for reproducible generation
 * @returns The initialized Seed instance
 * 
 * @example
 * ```typescript
 * initializeRNG('my-dungeon-seed-123');
 * // Now all calls to getRNG() will use this seed
 * ```
 */
export function initializeRNG(seed: string): Seed {
    globalRNG = new Seed(seed);
    return globalRNG;
}

/**
 * Gets the global RNG instance.
 * 
 * @returns The global Seed instance
 * @throws Error if RNG hasn't been initialized with initializeRNG()
 */
export function getRNG(): Seed {
    if (!globalRNG) {
        throw new Error('RNG not initialized. Call initializeRNG() first.');
    }
    return globalRNG;
}

/**
 * Checks if the global RNG has been initialized.
 * Useful for fallback logic when RNG might not be available.
 * 
 * @returns true if initializeRNG() has been called
 */
export function isRNGInitialized(): boolean {
    return globalRNG !== null;
}

/**
 * Generates a random alphanumeric string of the specified length.
 * Uses the global RNG if initialized, otherwise uses Math.random().
 * 
 * @param length - The length of the string to generate
 * @returns A random string containing lowercase letters, numbers, underscores, and hyphens
 * 
 * @example
 * ```typescript
 * const sessionId = generateRandomString(16); // e.g., 'a3b_k9-x2m4n7p1'
 * ```
 */
export function generateRandomString(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('');
    if (isRNGInitialized()) {
        return Array.from({ length }, () => getRNG().choice(characters)).join('');
    }
    // Fallback to Math.random() if RNG not initialized
    return Array.from({ length }, () => 
        characters[Math.floor(Math.random() * characters.length)]
    ).join('');
}
