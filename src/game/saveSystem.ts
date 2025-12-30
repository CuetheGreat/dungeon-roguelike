/**
 * @fileoverview Save/Load System for Dungeon Roguelike
 * 
 * Provides functionality to save and load game state to/from localStorage.
 * Supports:
 * - Saving current game state
 * - Loading saved game state
 * - Checking for existing saves
 * - Deleting saves
 * 
 * @module game/saveSystem
 */

import { GameState, GameStats, GamePhase } from './gameState';
import { Player, PlayerStats, Equipment, ActiveBuff, Ability, PlayerClass } from '../entities/player';
import { Room, RoomType, RoomState, Reward } from '../dungeon/room';
import { Item, ItemType, ItemSlot, ItemRarity } from '../entities/item';
import { Enemy, EnemyType } from '../entities/enemy';
import { DungeonLayer } from './seed';
import { Interactable } from '../dungeon/Interactable';
import { Relic } from '../entities/relic';

/**
 * Storage key for the save file.
 */
const SAVE_KEY = 'dungeon_roguelike_save';

/**
 * Current save file version for migration support.
 */
const SAVE_VERSION = 1;

/**
 * Serialized player data for saving.
 */
interface SerializedPlayer {
    id: string;
    name: string;
    playerClass: PlayerClass;
    level: number;
    experience: number;
    gold: number;
    stats: PlayerStats;
    equipment: {
        weapon: Item | null;
        armor: Item | null;
        accessory: Item | null;
    };
    inventory: Item[];
    abilities: Ability[];
    activeBuffs: ActiveBuff[];
    relics: Relic[];
}

/**
 * Serialized room data for saving.
 */
interface SerializedRoom {
    id: string;
    type: RoomType;
    level: number;
    state: RoomState;
    connections: string[];
    reward: Reward;
    enemies?: Enemy[];
    interactables: Interactable[];
    description: string;
}

/**
 * Complete save file structure.
 */
interface SaveFile {
    version: number;
    timestamp: number;
    seed: string;
    player: SerializedPlayer;
    dungeon: {
        rooms: SerializedRoom[];
        layers: DungeonLayer[];
        currentRoomId: string | null;
    };
    phase: GamePhase;
    turn: number;
    stats: GameStats;
}

/**
 * Result of a save operation.
 */
export interface SaveResult {
    success: boolean;
    message: string;
    timestamp?: number;
}

/**
 * Result of a load operation.
 */
export interface LoadResult {
    success: boolean;
    message: string;
    saveFile?: SaveFile;
}

/**
 * Saves the current game state to localStorage.
 * 
 * @param state - The current GameState to save
 * @returns SaveResult indicating success or failure
 */
export function saveGame(state: GameState): SaveResult {
    try {
        if (!state.player) {
            return { success: false, message: 'No player to save' };
        }

        const saveFile: SaveFile = {
            version: SAVE_VERSION,
            timestamp: Date.now(),
            seed: state.seed,
            player: serializePlayer(state.player),
            dungeon: {
                rooms: Array.from(state.dungeon.rooms.values()).map(serializeRoom),
                layers: state.dungeon.layers,
                currentRoomId: state.dungeon.currentRoomId,
            },
            phase: state.phase,
            turn: state.turn,
            stats: { ...state.stats },
        };

        const serialized = JSON.stringify(saveFile);
        localStorage.setItem(SAVE_KEY, serialized);

        return {
            success: true,
            message: 'Game saved successfully',
            timestamp: saveFile.timestamp,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Save failed:', error);
        return { success: false, message: `Failed to save: ${message}` };
    }
}

/**
 * Loads a saved game from localStorage.
 * 
 * @returns LoadResult with the save file data if successful
 */
export function loadGame(): LoadResult {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (!saved) {
            return { success: false, message: 'No save file found' };
        }

        const saveFile = JSON.parse(saved) as SaveFile;

        // Version check for future migrations
        if (saveFile.version !== SAVE_VERSION) {
            return { 
                success: false, 
                message: `Save file version mismatch (expected ${SAVE_VERSION}, got ${saveFile.version})` 
            };
        }

        return {
            success: true,
            message: 'Game loaded successfully',
            saveFile,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Load failed:', error);
        return { success: false, message: `Failed to load: ${message}` };
    }
}

/**
 * Checks if a save file exists.
 * 
 * @returns true if a save file exists in localStorage
 */
export function hasSaveFile(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Gets metadata about the save file without loading the full state.
 * 
 * @returns Save metadata or null if no save exists
 */
export function getSaveMetadata(): { timestamp: number; seed: string; playerName: string; level: number } | null {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (!saved) return null;

        const saveFile = JSON.parse(saved) as SaveFile;
        return {
            timestamp: saveFile.timestamp,
            seed: saveFile.seed,
            playerName: saveFile.player.name,
            level: saveFile.player.level,
        };
    } catch {
        return null;
    }
}

/**
 * Deletes the save file from localStorage.
 * 
 * @returns true if deletion was successful
 */
export function deleteSave(): boolean {
    try {
        localStorage.removeItem(SAVE_KEY);
        return true;
    } catch {
        return false;
    }
}

/**
 * Serializes a Player object for saving.
 */
function serializePlayer(player: Player): SerializedPlayer {
    return {
        id: player.id,
        name: player.name,
        playerClass: player.playerClass,
        level: player.level,
        experience: player.experience,
        gold: player.gold,
        stats: { ...player.stats },
        equipment: {
            weapon: player.equipment.weapon ? { ...player.equipment.weapon } : null,
            armor: player.equipment.armor ? { ...player.equipment.armor } : null,
            accessory: player.equipment.accessory ? { ...player.equipment.accessory } : null,
        },
        inventory: player.inventory.map(item => ({ ...item })),
        abilities: player.abilities.map(ability => ({ ...ability })),
        activeBuffs: player.activeBuffs.map(buff => ({ ...buff })),
        relics: player.relics.map(relic => ({ ...relic })),
    };
}

/**
 * Serializes a Room object for saving.
 */
function serializeRoom(room: Room): SerializedRoom {
    return {
        id: room.id,
        type: room.type,
        level: room.level,
        state: room.state,
        connections: [...room.connections],
        reward: { ...room.reward, items: room.reward.items.map(i => ({ ...i })) },
        enemies: room.enemies?.map(e => ({ ...e })),
        interactables: room.interactables.map(i => ({ ...i })),
        description: room.description,
    };
}

/**
 * Formats a timestamp for display.
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date/time string
 */
export function formatSaveTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

