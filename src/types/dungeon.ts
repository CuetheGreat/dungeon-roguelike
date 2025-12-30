/**
 * @fileoverview Dungeon Type Definitions
 * 
 * This module contains type definitions for dungeon structures.
 * Separated to avoid circular dependencies between modules.
 * 
 * @module types/dungeon
 */

import { Room } from '../dungeon/room';

/**
 * Represents a horizontal layer (level) in the dungeon.
 * Each layer contains one or more rooms at the same depth.
 * @interface
 */
export interface DungeonLayer {
    /** The dungeon level number (1 = entrance, higher = deeper) */
    level: number;
    /** All rooms at this level */
    rooms: Room[];
}

