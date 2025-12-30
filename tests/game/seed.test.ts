import { describe, it, expect } from 'vitest';
import { Seed } from '../../src/game/seed';

describe('Seed', () => {
    describe('constructor', () => {
        it('should create a seed from a string', () => {
            const seed = new Seed('test');
            expect(seed).toBeDefined();
        });

        it('should create a seed from a number', () => {
            const seed = new Seed(12345);
            expect(seed).toBeDefined();
        });
    });

    describe('determinism', () => {
        it('should produce the same sequence for the same string seed', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('test');
            
            // Test multiple calls in sequence
            for (let i = 0; i < 10; i++) {
                expect(seed1.next()).toBe(seed2.next());
            }
        });

        it('should produce the same sequence for the same numeric seed', () => {
            const seed1 = new Seed(42);
            const seed2 = new Seed(42);
            
            for (let i = 0; i < 10; i++) {
                expect(seed1.next()).toBe(seed2.next());
            }
        });

        it('should produce different sequences for different seeds', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('different');
            
            // Collect sequences and compare - they should differ
            const sequence1: number[] = [];
            const sequence2: number[] = [];
            
            for (let i = 0; i < 10; i++) {
                sequence1.push(seed1.next());
                sequence2.push(seed2.next());
            }
            
            // At least one value should differ (comparing sequences, not individual values)
            expect(sequence1).not.toEqual(sequence2);
        });
    });

    describe('next()', () => {
        it('should return a 32-bit unsigned integer', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                const value = seed.next();
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(0xFFFFFFFF);
                expect(Number.isInteger(value)).toBe(true);
            }
        });

        it('should advance the sequence on each call', () => {
            const seed = new Seed('test');
            const values = new Set<number>();
            
            for (let i = 0; i < 100; i++) {
                values.add(seed.next());
            }
            
            // Should have many unique values (not all the same)
            expect(values.size).toBeGreaterThan(90);
        });
    });

    describe('nextFloat()', () => {
        it('should return a value between 0 (inclusive) and 1 (exclusive)', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                const value = seed.nextFloat();
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(1);
            }
        });
    });

    describe('nextInt()', () => {
        it('should return values within the specified range (inclusive)', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                const value = seed.nextInt(5, 15);
                expect(value).toBeGreaterThanOrEqual(5);
                expect(value).toBeLessThanOrEqual(15);
                expect(Number.isInteger(value)).toBe(true);
            }
        });

        it('should return the only value when min equals max', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 10; i++) {
                expect(seed.nextInt(7, 7)).toBe(7);
            }
        });

        it('should work with negative ranges', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                const value = seed.nextInt(-10, -5);
                expect(value).toBeGreaterThanOrEqual(-10);
                expect(value).toBeLessThanOrEqual(-5);
            }
        });

        it('should work with ranges crossing zero', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                const value = seed.nextInt(-5, 5);
                expect(value).toBeGreaterThanOrEqual(-5);
                expect(value).toBeLessThanOrEqual(5);
            }
        });
    });

    describe('choice()', () => {
        it('should return an element from the array', () => {
            const seed = new Seed('test');
            const options = ['a', 'b', 'c', 'd', 'e'];
            
            for (let i = 0; i < 50; i++) {
                const value = seed.choice(options);
                expect(options).toContain(value);
            }
        });

        it('should return the only element for single-element arrays', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 10; i++) {
                expect(seed.choice(['only'])).toBe('only');
            }
        });

        it('should be deterministic with the same seed', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('test');
            const options = [1, 2, 3, 4, 5];
            
            for (let i = 0; i < 20; i++) {
                expect(seed1.choice(options)).toBe(seed2.choice(options));
            }
        });
    });

    describe('shuffle()', () => {
        it('should return an array with the same elements', () => {
            const seed = new Seed('test');
            const original = [1, 2, 3, 4, 5];
            const shuffled = seed.shuffle([...original]); // Pass a copy
            
            expect(shuffled).toHaveLength(original.length);
            expect(shuffled.sort()).toEqual(original.sort());
        });

        it('should modify the array in place', () => {
            const seed = new Seed('test');
            const array = [1, 2, 3, 4, 5];
            const result = seed.shuffle(array);
            
            expect(result).toBe(array); // Same reference
        });

        it('should handle empty arrays', () => {
            const seed = new Seed('test');
            const empty: number[] = [];
            const result = seed.shuffle(empty);
            
            expect(result).toEqual([]);
            expect(result).toBe(empty);
        });

        it('should handle single-element arrays', () => {
            const seed = new Seed('test');
            const single = [42];
            const result = seed.shuffle(single);
            
            expect(result).toEqual([42]);
        });

        it('should be deterministic with the same seed', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('test');
            
            const result1 = seed1.shuffle([1, 2, 3, 4, 5]);
            const result2 = seed2.shuffle([1, 2, 3, 4, 5]);
            
            expect(result1).toEqual(result2);
        });
    });

    describe('chance()', () => {
        it('should always return false for probability 0', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                expect(seed.chance(0)).toBe(false);
            }
        });

        it('should always return true for probability 1', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                expect(seed.chance(1)).toBe(true);
            }
        });

        it('should be deterministic with the same seed', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('test');
            
            for (let i = 0; i < 50; i++) {
                expect(seed1.chance(0.5)).toBe(seed2.chance(0.5));
            }
        });
    });

    describe('percentChance()', () => {
        it('should always return false for 0 percent', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                expect(seed.percentChance(0)).toBe(false);
            }
        });

        it('should always return true for 100 percent', () => {
            const seed = new Seed('test');
            
            for (let i = 0; i < 100; i++) {
                expect(seed.percentChance(100)).toBe(true);
            }
        });

        it('should be deterministic with the same seed', () => {
            const seed1 = new Seed('test');
            const seed2 = new Seed('test');
            
            for (let i = 0; i < 50; i++) {
                expect(seed1.percentChance(50)).toBe(seed2.percentChance(50));
            }
        });
    });
})