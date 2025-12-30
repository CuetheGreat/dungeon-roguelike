/**
 * @fileoverview Shared Game Constants
 * 
 * Central location for game-wide constants to avoid duplication
 * and ensure consistency across modules.
 * 
 * @module game/constants
 */

/**
 * Experience required to reach each level.
 * Index corresponds to level (XP_PER_LEVEL[1] = XP needed for level 2).
 * @const
 */
export const XP_PER_LEVEL: readonly number[] = [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3
    600,    // Level 4
    1000,   // Level 5
    1500,   // Level 6
    2100,   // Level 7
    2800,   // Level 8
    3600,   // Level 9
    4500,   // Level 10
    5500,   // Level 11
    6600,   // Level 12
    7800,   // Level 13
    9100,   // Level 14
    10500,  // Level 15
    12000,  // Level 16
    13600,  // Level 17
    15300,  // Level 18
    17100,  // Level 19
    19000   // Level 20
] as const;

/**
 * Maximum player level.
 * @const
 */
export const MAX_LEVEL = 20;

/**
 * Gets the XP required to reach the next level.
 * 
 * @param currentLevel - The player's current level (1-20)
 * @returns XP needed for next level, or 0 if at max level
 */
export function getXPForNextLevel(currentLevel: number): number {
    if (currentLevel >= MAX_LEVEL) return XP_PER_LEVEL[MAX_LEVEL - 1];
    return XP_PER_LEVEL[currentLevel];
}

/**
 * Gets the XP progress percentage toward next level.
 * 
 * @param currentLevel - The player's current level
 * @param currentXP - The player's current total XP
 * @returns Progress percentage (0-100)
 */
export function getXPProgress(currentLevel: number, currentXP: number): number {
    if (currentLevel >= MAX_LEVEL) return 100;
    const currentLevelXP = currentLevel > 1 ? XP_PER_LEVEL[currentLevel - 1] : 0;
    const nextLevelXP = XP_PER_LEVEL[currentLevel];
    const progress = currentXP - currentLevelXP;
    const needed = nextLevelXP - currentLevelXP;
    return Math.min(100, (progress / needed) * 100);
}

/**
 * Base flee chance percentage.
 * @const
 */
export const BASE_FLEE_CHANCE = 50;

/**
 * Maximum messages to keep in the combat/game log.
 * @const
 */
export const MAX_LOG_MESSAGES = 50;

