/**
 * @fileoverview Room System for Dungeon Roguelike
 * 
 * This module defines the Room class and related types that form the core
 * structure of the dungeon. Rooms are the primary navigation and interaction
 * points in the game, containing enemies, interactables, and rewards.
 * 
 * Room Types:
 * - ENTRANCE: Starting room
 * - COMBAT: Standard enemy encounters
 * - ELITE: Difficult encounters with better rewards
 * - BOSS: Final challenge room
 * - TREASURE: Guaranteed loot rooms
 * - REST: Safe rooms for healing
 * - SHOP: Purchase items and equipment
 * - EVENT: Random events with various outcomes
 * - PUZZLE: Logic/skill challenges
 * 
 * @module dungeon/room
 */

import { Enemy, MonsterAPI } from '../entities/enemy';
import { Item } from '../entities/item';
import { generateLootForLevel, cloneItem, generateShopInventory, ShopItem } from '../entities/itemDatabase';
import { Interactable, InteractableType, createInteractable, interact, InteractionResult } from './Interactable';
import { getRNG, isRNGInitialized } from '../game/seed';
import { MysteriousEvent, generateMysteriousEvent } from '../events/mysteriousEvent';
import { Puzzle, generatePuzzle } from '../puzzles/puzzle';

/**
 * Types of rooms that can appear in the dungeon.
 * Each type has different contents, rewards, and player interactions.
 * @enum {string}
 */
export enum RoomType {
    /** Final challenge room with powerful boss enemy */
    BOSS = 'boss',
    /** Standard combat encounter */
    COMBAT = 'combat',
    /** Difficult combat with stronger enemies and better rewards */
    ELITE = 'elite',
    /** Starting room of the dungeon */
    ENTRANCE = 'entrance',
    /** Random event with various outcomes */
    EVENT = 'event',
    /** Logic/skill challenge room */
    PUZZLE = 'puzzle',
    /** Safe room for healing and upgrades */
    REST = 'rest',
    /** Purchase items and equipment */
    SHOP = 'shop',
    /** Loot room with guaranteed rewards */
    TREASURE = 'treasure'
}

/**
 * Possible states a room can be in during gameplay.
 * @enum {string}
 */
export enum RoomState {
    /** Player is currently in this room */
    ACTIVE = 'active',
    /** Room can be entered (connected to a cleared room) */
    AVAILABLE = 'available',
    /** Room has been completed */
    CLEARED = 'cleared',
    /** Room cannot be entered yet (not connected to cleared room) */
    LOCKED = 'locked'
}

/**
 * Reward configuration for completing a room.
 * @interface
 */
export interface Reward {
    /** Items dropped upon completion */
    items: Item[];
    /** Gold awarded */
    gold: number;
    /** Experience points awarded */
    experience: number;
    /** Optional health restoration (for rest rooms) */
    healthRestore?: number;
}

/**
 * Serialized representation of a Room for save/load.
 * @interface
 */
export interface RoomJSON {
    /** Unique room identifier */
    id: string;
    /** Room type */
    type: RoomType;
    /** Dungeon level (1-20) */
    level: number;
    /** Current room state */
    state: RoomState;
    /** IDs of connected rooms */
    connections: string[];
    /** Room completion rewards */
    reward: Reward;
    /** Enemies in the room (if hostile) */
    enemies?: Enemy[];
    /** Interactable objects in the room */
    interactables: Interactable[];
    /** Flavor text description */
    description: string;
}

/**
 * Reward multiplier constants for different room types.
 * @const
 */
const REWARD_CONSTANTS = {
    /** Base gold reward per level */
    BASE_GOLD: 50,
    /** Base XP reward per level */
    BASE_XP: 100,
    /** Gold multiplier for treasure rooms */
    TREASURE_GOLD_MULTIPLIER: 3,
    /** XP/gold multiplier for elite rooms */
    ELITE_MULTIPLIER: 1.5,
    /** XP multiplier for boss rooms */
    BOSS_XP_MULTIPLIER: 3,
    /** Gold multiplier for boss rooms */
    BOSS_GOLD_MULTIPLIER: 2,
    /** Health restored in rest rooms */
    REST_HEALTH_RESTORE: 100,
    /** XP multiplier for combat rooms */
    COMBAT_XP_MULTIPLIER: 1.2,
    /** Gold multiplier for puzzle rooms */
    PUZZLE_GOLD_MULTIPLIER: 0.5,
    /** XP multiplier for puzzle rooms */
    PUZZLE_XP_MULTIPLIER: 1.5,
    /** Gold multiplier for event rooms */
    EVENT_GOLD_MULTIPLIER: 0.75,
    /** XP multiplier for event rooms */
    EVENT_XP_MULTIPLIER: 0.75
} as const;

/**
 * Represents a single room in the dungeon.
 * 
 * Rooms are the fundamental building blocks of the dungeon, containing:
 * - A type that determines behavior and contents
 * - Connections to other rooms forming the dungeon graph
 * - Enemies (for hostile rooms)
 * - Interactable objects (chests, traps, altars, etc.)
 * - Rewards for completion
 * 
 * Use the static `create()` factory method to instantiate rooms, as it
 * handles async operations like fetching enemies from the API.
 * 
 * @example
 * ```typescript
 * const room = Room.create(RoomType.COMBAT, 5);
 * if (room.canEnter()) {
 *   room.enter();
 *   // ... player fights enemies ...
 *   const rewards = room.complete();
 * }
 * ```
 */
export class Room {
    /** Unique identifier for the room */
    public readonly id: string = crypto.randomUUID();
    
    /** The type of room (combat, treasure, shop, etc.) */
    public type: RoomType;
    
    /** The dungeon level this room is on (1-20) */
    public level: number;
    
    /** Current state of the room (locked, available, active, cleared) */
    public state: RoomState;
    
    /** IDs of rooms connected to this one */
    public connections: string[];
    
    /** Rewards granted upon completing the room */
    public reward: Reward;
    
    /** Enemies present in hostile rooms */
    public enemies?: Enemy[];
    
    /** Whether enemies have been loaded from API (for lazy loading) */
    private enemiesLoaded: boolean = false;
    
    /** Interactable objects in the room (chests, traps, altars, etc.) */
    public interactables: Interactable[] = [];
    
    /** Flavor text description of the room */
    public description: string;
    
    /** Mysterious event for EVENT rooms (generated on first enter) */
    public event?: MysteriousEvent;
    
    /** Shop inventory for SHOP rooms (generated on first enter) */
    public shopInventory?: ShopItem[];
    
    /** Puzzle for PUZZLE rooms (generated on first enter) */
    public puzzle?: Puzzle;

    /**
     * Private constructor - use Room.create() factory method instead.
     * 
     * @param type - The type of room to create
     * @param level - The dungeon level (affects difficulty and rewards)
     * @private
     */
    private constructor(type: RoomType, level: number) {
        this.type = type ?? RoomType.ENTRANCE;
        this.level = Math.max(1, level ?? 1);
        this.state = RoomState.LOCKED;
        this.connections = [];
        this.interactables = [];
        this.reward = this.generateReward();
        this.description = this.generateDescription();
    }

    /**
     * Factory method to create a new Room instance.
     * Creates the room synchronously without fetching enemy data.
     * Enemy data is loaded lazily when entering the room via ensureEnemiesLoaded().
     * 
     * @param type - The type of room to create
     * @param level - The dungeon level (affects difficulty and rewards)
     * @returns The created Room (synchronous)
     * 
     * @example
     * ```typescript
     * const combatRoom = Room.create(RoomType.COMBAT, 5);
     * const shopRoom = Room.create(RoomType.SHOP, 10);
     * // Later, when entering:
     * await combatRoom.ensureEnemiesLoaded();
     * ```
     */
    static create(type: RoomType, level: number): Room {
        const room = new Room(type, level);
        room.populateInteractables();
        return room;
    }

    /**
     * Creates a bidirectional connection between this room and another room.
     * Both rooms will have each other in their connections array.
     * 
     * @param room - The room to connect to
     */
    connectTo(room: Room): void {
        if (!this.connections.includes(room.id)) {
            this.connections.push(room.id);
        }
        if (!room.connections.includes(this.id)) {
            room.connections.push(this.id);
        }
    }

    /**
     * Checks if the room can be entered based on its current state.
     * 
     * A room can be entered if:
     * - It's the entrance room (always accessible)
     * - Its state is AVAILABLE (connected to a cleared room)
     * 
     * @returns true if the room can be entered
     */
    canEnter(): boolean {
        // Can't enter if locked or already cleared
        if (this.state === RoomState.LOCKED || this.state === RoomState.CLEARED) {
            return false;
        }

        // Entrance is always available
        if (this.type === RoomType.ENTRANCE) {
            return true;
        }

        // Available if marked as available
        if (this.state === RoomState.AVAILABLE) {
            return true;
        }

        return false;
    }

    /**
     * Enters the room, setting its state to ACTIVE.
     * For EVENT rooms, generates the mysterious event if not already present.
     * For SHOP rooms, generates the shop inventory if not already present.
     * 
     * @throws Error if the room is locked
     */
    enter(): void {
        if (this.state === RoomState.LOCKED) {
            throw new Error('Room is locked');
        }

        this.state = RoomState.ACTIVE;
        
        // Generate event for EVENT rooms on first enter
        if (this.type === RoomType.EVENT && !this.event) {
            this.event = generateMysteriousEvent(this.level);
        }
        
        // Generate shop inventory for SHOP rooms on first enter
        if (this.type === RoomType.SHOP && !this.shopInventory) {
            this.shopInventory = generateShopInventory(this.level);
        }
        
        // Generate puzzle for PUZZLE rooms on first enter
        if (this.type === RoomType.PUZZLE && !this.puzzle) {
            this.puzzle = generatePuzzle(this.level);
        }
    }

    /**
     * Ensures enemies are loaded for hostile rooms.
     * This method implements lazy loading - enemies are only fetched from the API
     * when this method is called, not during room creation.
     * 
     * Safe to call multiple times - will only fetch once.
     * 
     * @returns Promise that resolves when enemies are loaded (or immediately if not needed)
     * 
     * @example
     * ```typescript
     * // Before entering combat, ensure enemies are loaded
     * await room.ensureEnemiesLoaded();
     * const enemies = room.enemies; // Now populated
     * ```
     */
    async ensureEnemiesLoaded(): Promise<void> {
        // Skip if already loaded or not a hostile room
        if (this.enemiesLoaded || !this.isHostileRoom()) {
            return;
        }
        
        await this.populateEnemies();
        this.enemiesLoaded = true;
    }

    /**
     * Checks if enemies have been loaded for this room.
     * Useful for UI to show loading state.
     * 
     * @returns true if enemies have been loaded (or room doesn't need enemies)
     */
    areEnemiesLoaded(): boolean {
        return this.enemiesLoaded || !this.isHostileRoom();
    }

    /**
     * Marks the room as completed and returns its rewards.
     * 
     * @returns The Reward object containing items, gold, and experience
     * @throws Error if the room is not currently active
     */
    complete(): Reward {
        if (this.state !== RoomState.ACTIVE) {
            throw new Error('Room is not active');
        }

        this.state = RoomState.CLEARED;
        return this.reward;
    }

    /**
     * Checks if this room type contains enemies.
     * 
     * @returns true if the room is COMBAT, ELITE, or BOSS type
     */
    isHostileRoom(): boolean {
        return [RoomType.COMBAT, RoomType.ELITE, RoomType.BOSS].includes(this.type);
    }

    /**
     * Generates rewards based on room type and level.
     * 
     * @returns The calculated Reward object
     * @private
     */
    private generateReward(): Reward {
        const { BASE_GOLD, BASE_XP } = REWARD_CONSTANTS;

        let goldMultiplier = 1;
        let xpMultiplier = 1;

        switch (this.type) {
            case RoomType.TREASURE:
                goldMultiplier = REWARD_CONSTANTS.TREASURE_GOLD_MULTIPLIER;
                break;
            case RoomType.ELITE:
                xpMultiplier = REWARD_CONSTANTS.ELITE_MULTIPLIER;
                goldMultiplier = REWARD_CONSTANTS.ELITE_MULTIPLIER;
                break;
            case RoomType.BOSS:
                xpMultiplier = REWARD_CONSTANTS.BOSS_XP_MULTIPLIER;
                goldMultiplier = REWARD_CONSTANTS.BOSS_GOLD_MULTIPLIER;
                break;
            case RoomType.REST:
                return {
                    items: [],
                    gold: 0,
                    experience: 0,
                    healthRestore: REWARD_CONSTANTS.REST_HEALTH_RESTORE
                };
            case RoomType.SHOP:
                return {
                    items: [],
                    gold: BASE_GOLD * this.level,
                    experience: 0
                };
            case RoomType.COMBAT:
                xpMultiplier = REWARD_CONSTANTS.COMBAT_XP_MULTIPLIER;
                break;
            case RoomType.PUZZLE:
                goldMultiplier = REWARD_CONSTANTS.PUZZLE_GOLD_MULTIPLIER;
                xpMultiplier = REWARD_CONSTANTS.PUZZLE_XP_MULTIPLIER;
                break;
            case RoomType.EVENT:
                goldMultiplier = REWARD_CONSTANTS.EVENT_GOLD_MULTIPLIER;
                xpMultiplier = REWARD_CONSTANTS.EVENT_XP_MULTIPLIER;
                break;
            case RoomType.ENTRANCE:
            default:
                // Entrance and any unknown types get minimal rewards
                goldMultiplier = 0;
                xpMultiplier = 0;
                break;
        }

        const gold = Math.floor(BASE_GOLD * goldMultiplier * this.level);
        const experience = Math.floor(BASE_XP * xpMultiplier * this.level);

        return {
            items: this.generateItems(),
            gold,
            experience
        };
    }

    /**
     * Generates item drops based on room type and level.
     * 
     * @returns Array of items to drop
     * @private
     */
    private generateItems(): Item[] {
        // Generate loot based on room type and level
        switch (this.type) {
            case RoomType.TREASURE:
                // Treasure rooms guarantee equipment and give more items
                return [
                    ...generateLootForLevel(this.level, undefined, true), // Guarantee equipment
                    ...generateLootForLevel(this.level)
                ].map(item => cloneItem(item));

            case RoomType.BOSS:
                // Boss rooms guarantee multiple pieces of equipment
                return [
                    ...generateLootForLevel(this.level + 2, undefined, true), // Guarantee equipment
                    ...generateLootForLevel(this.level + 1, undefined, true), // Guarantee equipment
                    ...generateLootForLevel(this.level)
                ].map(item => cloneItem(item));

            case RoomType.ELITE:
                // Elite rooms guarantee equipment
                return generateLootForLevel(this.level + 1, undefined, true).map(item => cloneItem(item));

            case RoomType.COMBAT:
                // Combat rooms now have better equipment chances
                // First combat room (level 1-2) guarantees a weapon to help players get started
                const guaranteeEquip = this.level <= 2;
                return generateLootForLevel(this.level, undefined, guaranteeEquip).map(item => cloneItem(item));

            case RoomType.PUZZLE:
            case RoomType.EVENT:
                // Puzzle/Event rooms have a chance for loot
                const shouldDropLoot = isRNGInitialized()
                    ? getRNG().chance(0.5)
                    : Math.random() < 0.5;
                if (shouldDropLoot) {
                    return generateLootForLevel(this.level).map(item => cloneItem(item));
                }
                return [];

            default:
                return [];
        }
    }

    /**
     * Fetches and assigns enemies to this room from the D&D 5e API.
     * Enemy count and difficulty scales with room type and level.
     * Boss and Elite rooms always have exactly 1 enemy.
     * 
     * @returns Promise that resolves when enemies are populated
     */
    async populateEnemies(): Promise<void> {
        if (!this.isHostileRoom()) return;

        // Generate 1-3 enemies based on room type
        let count: number;
        if (this.type === RoomType.BOSS || this.type === RoomType.ELITE) {
            count = 1;
        } else {
            const maxEnemies = Math.floor(this.level / 3) + 1;
            const baseCount = isRNGInitialized()
                ? getRNG().nextInt(1, 3)
                : Math.floor(Math.random() * 3) + 1;
            count = Math.min(baseCount, maxEnemies);
        }

        this.enemies = await MonsterAPI.getRandomMonstersByCR(this.level, count);
    }

    /**
     * Populates interactable objects based on room type.
     * Different room types have different interactable configurations.
     * 
     * @private
     */
    private populateInteractables(): void {
        const rng = isRNGInitialized() ? getRNG() : null;

        switch (this.type) {
            case RoomType.TREASURE:
                // Treasure rooms always have 1-2 chests
                const chestCount = rng ? rng.nextInt(1, 2) : Math.floor(Math.random() * 2) + 1;
                for (let i = 0; i < chestCount; i++) {
                    this.interactables.push(createInteractable(InteractableType.CHEST, this.level));
                }
                // 30% chance for a trap guarding the treasure
                if (rng ? rng.chance(0.3) : Math.random() < 0.3) {
                    this.interactables.push(createInteractable(InteractableType.TRAP, this.level));
                }
                break;

            case RoomType.COMBAT:
            case RoomType.ELITE:
                // Combat rooms may have a chest (20% chance) or trap (15% chance)
                if (rng ? rng.chance(0.2) : Math.random() < 0.2) {
                    this.interactables.push(createInteractable(InteractableType.CHEST, this.level));
                }
                if (rng ? rng.chance(0.15) : Math.random() < 0.15) {
                    this.interactables.push(createInteractable(InteractableType.TRAP, this.level));
                }
                break;

            case RoomType.BOSS:
                // Boss rooms always have a chest after defeating the boss
                this.interactables.push(createInteractable(InteractableType.CHEST, this.level + 2));
                break;

            case RoomType.REST:
                // Rest rooms have an altar for blessings
                this.interactables.push(createInteractable(InteractableType.ALTAR, this.level));
                break;

            case RoomType.SHOP:
                // Shop rooms have an NPC merchant
                this.interactables.push(createInteractable(InteractableType.NPC, this.level));
                break;

            case RoomType.PUZZLE:
                // Puzzle rooms have levers and possibly traps
                const leverCount = rng ? rng.nextInt(1, 3) : Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < leverCount; i++) {
                    this.interactables.push(createInteractable(InteractableType.LEVER, this.level));
                }
                // 50% chance for traps in puzzle rooms
                if (rng ? rng.chance(0.5) : Math.random() < 0.5) {
                    this.interactables.push(createInteractable(InteractableType.TRAP, this.level));
                }
                break;

            case RoomType.EVENT:
                // Event rooms have random interactables
                const eventTypes = [
                    InteractableType.CHEST,
                    InteractableType.ALTAR,
                    InteractableType.NPC,
                    InteractableType.TRAP
                ];
                const eventType = rng
                    ? rng.choice(eventTypes)
                    : eventTypes[Math.floor(Math.random() * eventTypes.length)];
                this.interactables.push(createInteractable(eventType, this.level));
                break;

            case RoomType.ENTRANCE:
                // Entrance rooms are empty
                break;
        }
    }

    /**
     * Interacts with an interactable object in the room by its ID.
     * 
     * @param interactableId - The ID of the interactable to interact with
     * @returns The result of the interaction, or null if not found
     */
    interactWith(interactableId: string): InteractionResult | null {
        const interactable = this.interactables.find(i => i.id === interactableId);
        if (!interactable) {
            return null;
        }
        return interact(interactable);
    }

    /**
     * Gets all interactables that haven't been used yet.
     * NPCs are always considered available (can interact multiple times).
     * 
     * @returns Array of unused interactables
     */
    getAvailableInteractables(): Interactable[] {
        return this.interactables.filter(i => !i.used || i.type === InteractableType.NPC);
    }

    /**
     * Checks if the room has any unused interactables.
     * 
     * @returns true if there are available interactables
     */
    hasAvailableInteractables(): boolean {
        return this.getAvailableInteractables().length > 0;
    }

    /**
     * Returns an emoji icon representing this room type.
     * Used for UI display purposes.
     * 
     * @returns An emoji string for UI display
     */
    getIcon(): string {
        const icons: Record<RoomType, string> = {
            [RoomType.ENTRANCE]: '🚪',
            [RoomType.COMBAT]: '⚔️',
            [RoomType.ELITE]: '👹',
            [RoomType.TREASURE]: '💎',
            [RoomType.REST]: '🔥',
            [RoomType.SHOP]: '🏪',
            [RoomType.EVENT]: '❓',
            [RoomType.BOSS]: '💀',
            [RoomType.PUZZLE]: '🔍'
        };
        return icons[this.type] || '?';
    }

    /**
     * Generates a flavor text description for the room.
     * Uses seeded RNG for reproducible descriptions.
     * 
     * @returns A description string based on room type and level
     */
    generateDescription(): string {
        const rng = isRNGInitialized() ? getRNG() : null;
        const pick = <T>(arr: T[]): T => {
            const idx = rng ? rng.nextInt(0, arr.length - 1) : Math.floor(Math.random() * arr.length);
            return arr[idx];
        };

        // Atmosphere modifiers based on level depth
        const depthAtmosphere = this.level <= 5 
            ? pick(['dimly lit', 'musty', 'damp', 'echoing', 'shadowy'])
            : this.level <= 12
            ? pick(['ominous', 'foreboding', 'ancient', 'crumbling', 'haunted'])
            : pick(['malevolent', 'corrupted', 'suffocating', 'nightmarish', 'abyssal']);

        const descriptions: Record<RoomType, string[]> = {
            [RoomType.ENTRANCE]: [
                'Stone steps descend into the darkness below. The air grows cold as you enter the dungeon.',
                'A weathered archway marks the entrance to the depths. Ancient runes flicker faintly on the walls.',
                'The heavy iron gates creak open, revealing a passage into the unknown darkness.',
                'Torchlight barely penetrates the gloom of this ancient entryway. Your adventure begins here.',
            ],
            [RoomType.COMBAT]: [
                `A ${depthAtmosphere} chamber opens before you. Hostile eyes gleam in the darkness.`,
                `Bones crunch underfoot in this ${depthAtmosphere} room. You are not alone.`,
                `The stench of danger fills this ${depthAtmosphere} hall. Enemies lurk in the shadows.`,
                `Scratching sounds echo from the ${depthAtmosphere} corners. Prepare for battle.`,
                `This ${depthAtmosphere} room bears the marks of countless battles. Another awaits.`,
            ],
            [RoomType.ELITE]: [
                `A powerful presence dominates this ${depthAtmosphere} chamber. A formidable foe awaits.`,
                `The air crackles with dark energy in this ${depthAtmosphere} hall. A champion guards this room.`,
                `Trophies of fallen adventurers line the walls of this ${depthAtmosphere} lair. Beware.`,
                `An unnatural chill pervades this ${depthAtmosphere} sanctum. Something powerful stirs within.`,
            ],
            [RoomType.BOSS]: [
                'The final chamber looms before you. Darkness incarnate awaits your challenge.',
                'Ancient power thrums through the air. The master of this dungeon awaits.',
                'Massive pillars support a vaulted ceiling lost in shadow. Your ultimate test begins.',
                'The heart of the dungeon pulses with malevolent energy. Face your destiny.',
            ],
            [RoomType.TREASURE]: [
                `Glittering gold catches the torchlight in this ${depthAtmosphere} vault.`,
                `Chests and coffers fill this ${depthAtmosphere} chamber. Riches await the bold.`,
                `The gleam of precious metals illuminates this ${depthAtmosphere} room.`,
                `Ancient treasures lie scattered across this ${depthAtmosphere} treasury.`,
            ],
            [RoomType.REST]: [
                'A peaceful alcove offers respite from the dangers of the dungeon. A warm fire crackles.',
                'Soft moss covers the floor of this sanctuary. The air feels lighter here.',
                'An ancient shrine radiates calming energy. Rest and recover your strength.',
                'A hidden campsite provides shelter. The dungeon\'s dangers seem distant here.',
            ],
            [RoomType.SHOP]: [
                'A mysterious merchant has set up shop in this unlikely location. Wares glitter on display.',
                'Lanterns illuminate a small bazaar. A hooded figure beckons you to browse.',
                'A traveling trader offers goods in this protected alcove. Gold for gear, adventurer?',
                'Shelves of potions and equipment line the walls. A shopkeeper awaits your patronage.',
            ],
            [RoomType.EVENT]: [
                `Something unusual catches your attention in this ${depthAtmosphere} chamber.`,
                `The air shimmers with possibility in this ${depthAtmosphere} room. Fate awaits.`,
                `An otherworldly presence permeates this ${depthAtmosphere} space. Choose wisely.`,
                `Strange energies swirl in this ${depthAtmosphere} alcove. Destiny calls.`,
            ],
            [RoomType.PUZZLE]: [
                `Intricate mechanisms line the walls of this ${depthAtmosphere} chamber. A test of wit awaits.`,
                `Ancient symbols cover every surface of this ${depthAtmosphere} room. Solve the riddle.`,
                `Mysterious contraptions fill this ${depthAtmosphere} hall. Logic is your weapon here.`,
                `The room hums with arcane energy. A puzzle blocks your path forward.`,
            ],
        };

        const roomDescriptions = descriptions[this.type] || [`A ${depthAtmosphere} chamber stretches before you.`];
        return pick(roomDescriptions);
    }

    /**
     * Serializes the room to a JSON-compatible object.
     * 
     * @returns A RoomJSON object for persistence or transmission
     */
    toJSON(): RoomJSON {
        return {
            id: this.id,
            type: this.type,
            level: this.level,
            state: this.state,
            connections: this.connections,
            reward: this.reward,
            enemies: this.enemies,
            interactables: this.interactables,
            description: this.description
        };
    }
}
