/**
 * @fileoverview Game State Management for the Dungeon Roguelike
 * 
 * This module contains the core game state management system including:
 * - Game phases (exploration, combat, shop, etc.)
 * - Player actions and their results
 * - Room navigation and completion
 * - Combat action processing
 * 
 * @module game/gameState
 */

import { Player, PlayerClass } from "../entities/player";
import { Room, RoomState, RoomType } from "../dungeon/room";
import { DungeonLayer } from "./seed";
import { CombatState } from "./combatEngine";
import { Fighter } from "../entities/fighter";
import { DungeonGenerator } from "../integration/dungeonGenerator";
import { Warlock } from "../entities/warlock";
import { Item, ItemType, ItemSlot } from "../entities/item";
import { getSellPrice } from "../entities/itemDatabase";
import { getRNG, isRNGInitialized } from "./seed";
import { 
    InventoryManager, 
    ShopManager, 
    InteractionManager, 
    PuzzleManager, 
    EventManager 
} from "./managers";
import { BASE_FLEE_CHANCE } from "./constants";

/**
 * Represents the current phase of the game.
 * Determines what actions are available to the player.
 * @enum {string}
 */
export enum GamePhase {
    /** Player can move between rooms, interact with objects, use items */
    EXPLORATION = 'exploration',
    /** Turn-based combat is active */
    COMBAT = 'combat',
    /** Player is browsing shop inventory */
    SHOP = 'shop',
    /** Player is processing an event choice */
    EVENT = 'event',
    /** Player is at a rest room, can heal/upgrade */
    REST = 'rest',
    /** Player has died - game over */
    GAME_OVER = 'game_over',
    /** Boss has been defeated - victory */
    VICTORY = 'victory',
    /** Player is browsing inventory */
    INVENTORY = 'inventory',
    /** Player is viewing character sheet */
    CHARACTER = 'character',
    /** Player is solving a puzzle */
    PUZZLE = 'puzzle',
    /** Player is in a treasure room */
    TREASURE = 'treasure',
}

/**
 * Tracks cumulative statistics for the current game run.
 * Used for end-game summary and achievements.
 * @interface
 */
export interface GameStats {
    /** Total number of rooms the player has cleared */
    roomsCleared: number;
    /** Total number of enemies defeated */
    enemiesDefeated: number;
    /** Total gold collected throughout the run */
    goldCollected: number;
    /** Total number of items found */
    itemsFound: number;
}

/**
 * Complete snapshot of the current game state.
 * Contains all information needed to render the game and determine valid actions.
 * @interface
 */
export interface GameState {
    /** The player entity, null if game not started */
    player: Player | null;
    /** Dungeon structure and navigation state */
    dungeon: {
        /** Map of room IDs to Room objects for quick lookup */
        rooms: Map<string, Room>;
        /** Ordered array of dungeon layers (levels) */
        layers: DungeonLayer[];
        /** ID of the room the player is currently in */
        currentRoomId: string | null;
    };
    /** Current game phase determining available actions */
    phase: GamePhase;
    /** Active combat state, null when not in combat */
    combat: CombatState | null;
    /** Current turn number (increments each player action) */
    turn: number;
    /** Cumulative game statistics */
    stats: GameStats;
    /** The seed used for this game run */
    seed: string;
}

/**
 * Represents a player action that can be executed.
 * Different action types have different required fields.
 * @interface
 */
export interface Action {
    /** 
     * The type of action to perform.
     * Valid types: 'move', 'interact', 'basic_attack', 'ability', 
     * 'use_item', 'flee', 'rest', 'leave', 'leave_shop', 'restart',
     * 'open_inventory', 'view_character', 'view_stats', 'quit'
     */
    type: string;
    /** Target room ID for 'move' actions */
    roomId?: string;
    /** Type of the target room for 'move' actions (for UI display) */
    roomType?: RoomType;
    /** Target interactable ID for 'interact' actions */
    interactableId?: string;
    /** Display name for the action (for UI) */
    name?: string;
    /** Ability ID for 'ability' actions */
    abilityId?: string;
    /** Ability display name for 'ability' actions */
    abilityName?: string;
    /** Item ID for 'use_item' actions */
    itemId?: string;
    /** Item display name for 'use_item' actions */
    itemName?: string;
    /** Action to open inventory */
    openInventory?: boolean;
    /** Action to close inventory */
    closeInventory?: boolean;
    /** Action to view character sheet */
    viewCharacter?: boolean;
    /** Action to close character sheet */
    closeCharacter?: boolean;
    /** Action to equip an item */
    equipItem?: boolean;
    /** Action to unequip an item */
    unequipItem?: boolean;
    /** Action to sell an item */
    sellItem?: boolean;
    /** Action to buy an item */
    buyItem?: boolean;
    /** Action to sell all items */
    sellAllItems?: boolean;
    /** Equipment slot for equip/unequip actions */
    slot?: 'weapon' | 'armor' | 'accessory';
    /** Price for buy/sell actions */
    price?: number;
    /** Answer index for puzzle actions */
    answerIndex?: number;
    /** Answer text for puzzle actions */
    answerText?: string;
    /** Interactable index for interact actions */
    interactableIndex?: number;
    /** Interactable name for interact actions */
    interactableName?: string;
}

/**
 * Result returned after executing an action.
 * Contains success/failure status and any effects that occurred.
 * @interface
 */
export interface ActionResult {
    /** 
     * Type of result corresponding to the action executed.
     * Examples: 'moved', 'interaction', 'combat_action', 'item_used', 
     * 'flee', 'rested', 'left', 'restart_requested', etc.
     */
    type: string;
    /** Whether the action succeeded */
    success?: boolean;
    /** Human-readable message describing the result */
    message?: string;
    /** Detailed result data for actions with effects */
    result?: {
        /** Damage dealt or taken */
        damage?: number;
        /** Health restored */
        healing?: number;
        /** Gold gained */
        gold?: number;
        /** Items received */
        items?: Item[];
        /** Single item involved in the action */
        item?: Item;
    };
}


/**
 * Central manager for all game state operations.
 * 
 * Handles:
 * - Game initialization and setup
 * - Room navigation and transitions
 * - Action validation and execution
 * - Phase transitions
 * - Player death and victory conditions
 * 
 * @example
 * ```typescript
 * const manager = new GameStateManager();
 * await manager.startNewGame('fighter', 'Hero', 'my-seed');
 * 
 * const actions = manager.getAvailableActions();
 * const result = manager.executeAction(actions[0]);
 * ```
 */
export class GameStateManager {
    /** Internal game state - access via getState() */
    private currentGameState: GameState;
    
    /** Stores the phase before opening overlay screens (inventory, character) */
    private previousPhase: GamePhase | null = null;

    // Extracted managers for better separation of concerns
    private readonly inventoryManager = new InventoryManager();
    private readonly shopManager = new ShopManager();
    private readonly interactionManager = new InteractionManager();
    private readonly puzzleManager = new PuzzleManager();
    private readonly eventManager = new EventManager();

    /**
     * Creates a new GameStateManager with default empty state.
     * Call startNewGame() to initialize a playable game.
     */
    constructor() {
        this.currentGameState = {
            player: null,
            dungeon: {
                rooms: new Map(),
                layers: [],
                currentRoomId: null
            },
            phase: GamePhase.EXPLORATION,
            combat: null,
            turn: 0,
            stats: {
                roomsCleared: 0,
                enemiesDefeated: 0,
                goldCollected: 0,
                itemsFound: 0,
            },
            seed: ''
        }
    }

    /**
     * Initializes a new game with the specified player and dungeon.
     * Generates the dungeon, creates the player, and positions them at the entrance.
     * 
     * @param playerClass - The class for the player character
     * @param playerName - Display name for the player
     * @param seed - Seed string for reproducible dungeon generation
     * @returns Promise resolving to the initialized GameState
     * 
     * @example
     * ```typescript
     * const state = await manager.startNewGame('warlock', 'Merlin', 'dungeon-seed-123');
     * console.log(state.player?.name); // 'Merlin'
     * ```
     */
    startNewGame(playerClass: 'fighter' | 'warlock', playerName: string, seed: string): GameState {
        let player: Player
        switch (playerClass) {
            case 'fighter':
                player = new Fighter(playerName);
                break;
            case 'warlock':
                player = new Warlock(playerName);
                break;
        }
        const dungeon = new DungeonGenerator(seed);
        const rooms = dungeon.generate(20, 3, 0.3);
        const layers = dungeon.getLayers();
        
        // Validate dungeon connectivity (log warnings if issues found)
        const connectivityErrors = dungeon.validateConnectivity();
        if (connectivityErrors.length > 0) {
            console.warn('Dungeon connectivity issues found:', connectivityErrors);
        }

        const roomsMap = new Map<string, Room>();
        for (const room of rooms) {
            roomsMap.set(room.id, room);
        }

        const entranceRoom = rooms[0]

        // Set entrance room to AVAILABLE so it can be entered, then enter it
        entranceRoom.state = RoomState.AVAILABLE;
        entranceRoom.enter(); // Sets state to ACTIVE

        // Unlock all rooms connected to the entrance
        for (const connectedId of entranceRoom.connections) {
            const connectedRoom = roomsMap.get(connectedId);
            if (connectedRoom && connectedRoom.state === RoomState.LOCKED) {
                connectedRoom.state = RoomState.AVAILABLE;
            }
        }

        this.currentGameState = {
            player,
            dungeon: {
                rooms: roomsMap,
                layers,
                currentRoomId: entranceRoom.id
            },
            phase: GamePhase.EXPLORATION,
            combat: null,
            turn: 0,
            stats: {
                roomsCleared: 0,
                enemiesDefeated: 0,
                goldCollected: 0,
                itemsFound: 0,
            },
            seed
        }

        return this.currentGameState;
    }

    /**
     * Returns the current game state.
     * Use this to read state for rendering or decision making.
     * 
     * @returns The current GameState object
     */
    getState(): GameState {
        return this.currentGameState;
    }

    /**
     * Gets the Room object for the player's current location.
     * 
     * @returns The current Room or null if not in a room
     * @private
     */
    private getCurrentRoom(): Room | null {
        const { dungeon } = this.currentGameState;
        if (!dungeon.currentRoomId) {
            return null;
        }
        return dungeon.rooms.get(dungeon.currentRoomId) as Room;
    }

    /**
     * Gets the ID of the player's current room.
     * 
     * @returns The current room ID or null
     * @private
     */
    private getCurrentRoomId(): string | null {
        return this.currentGameState.dungeon.currentRoomId;
    }


    /**
     * Moves the player to a connected room.
     * 
     * This method:
     * 1. Validates the target room exists and is connected
     * 2. Marks the current room as cleared
     * 3. Enters the new room and sets it as active
     * 4. Unlocks adjacent rooms
     * 5. Determines the appropriate game phase based on room type
     * 
     * @param roomId - The ID of the room to move to
     * @returns The updated GameState after the move
     * @throws Error if room not found, not connected, or cannot be entered
     * 
     * @example
     * ```typescript
     * try {
     *   const newState = manager.moveToRoom('room-uuid-123');
     *   console.log(newState.phase); // Might be 'combat' if enemies present
     * } catch (e) {
     *   console.error('Cannot move:', e.message);
     * }
     * ```
     */
    async moveToRoom(roomId: string): Promise<GameState> {
        const { dungeon, stats } = this.currentGameState;
        // 1. Get target room from dungeon
        const targetRoom = dungeon.rooms.get(roomId);
        if (!targetRoom) {
            throw new Error(`Room ${roomId} not found`);
        }
        // 2. if room is not connected to current room → error
        const currentRoom = dungeon.rooms.get(dungeon.currentRoomId as string);
        if (currentRoom && !currentRoom.connections.includes(roomId)) {
            throw new Error(`Room ${roomId} is not connected to current room`);
        }
        // 3. if room cannot be entered → error
        if (!targetRoom.canEnter()) {
            throw new Error(`Room ${roomId} cannot be entered`);
        }
        // 4. Set current room to CLEARED (if it is active)
        if (currentRoom && currentRoom.state === RoomState.ACTIVE) {
            currentRoom.state = RoomState.CLEARED;
            stats.roomsCleared++;
        }
        
        // 5. Lock all other AVAILABLE rooms on the same level and below
        // This enforces the "choose your path" mechanic - once you pick a room,
        // other branches become permanently inaccessible
        const targetLevel = targetRoom.level;
        for (const [id, room] of dungeon.rooms) {
            // Skip the room we're moving to
            if (id === roomId) continue;
            // Skip rooms that are already cleared or locked
            if (room.state === RoomState.CLEARED || room.state === RoomState.LOCKED) continue;
            // Lock rooms on the same level (siblings we didn't choose)
            if (room.level === targetLevel && room.state === RoomState.AVAILABLE) {
                room.state = RoomState.LOCKED;
            }
            // Lock rooms on levels below that aren't connected to our target
            // (branches we can no longer reach)
            if (room.level > targetLevel && room.state === RoomState.AVAILABLE) {
                // Check if this room is reachable from the target room's connections
                if (!targetRoom.connections.includes(id)) {
                    room.state = RoomState.LOCKED;
                }
            }
        }
        
        // 6. Set currentRoomId to new room
        dungeon.currentRoomId = roomId;
        // 7. Call room.enter()
        targetRoom.enter();
        // 8. Unlock connected rooms (set to AVAILABLE) - only rooms on the NEXT level
        for (const connectedId of targetRoom.connections) {
            const connectedRoom = dungeon.rooms.get(connectedId);
            if (connectedRoom && connectedRoom.state === RoomState.LOCKED) {
                // Only unlock rooms that are on the next level (deeper in dungeon)
                if (connectedRoom.level > targetLevel) {
                    connectedRoom.state = RoomState.AVAILABLE;
                }
            }
        }

        // 9. Load enemies if entering a hostile room (lazy loading)
        // This must happen BEFORE determining phase, since phase depends on enemies being present
        if (targetRoom.isHostileRoom()) {
            await targetRoom.ensureEnemiesLoaded();
        }

        // 10. Determine phase based on room type (now that enemies are loaded)
        this.currentGameState.phase = this.determinePhaseForRoom(targetRoom);

        // 11. Return updated state
        return this.currentGameState;
    }

    /**
     * Determines the appropriate game phase based on room type.
     * 
     * @param room - The room to determine phase for
     * @returns The GamePhase that should be active in this room
     * @private
     */
    private determinePhaseForRoom(room: Room): GamePhase {
        switch (room.type) {
            case RoomType.COMBAT:
            case RoomType.ELITE:
            case RoomType.BOSS:
                // Only enter combat if there are enemies
                if (room.enemies && room.enemies.length > 0) {
                    return GamePhase.COMBAT;
                }
                return GamePhase.EXPLORATION;

            case RoomType.SHOP:
                return GamePhase.SHOP;

            case RoomType.REST:
                return GamePhase.REST;

            case RoomType.EVENT:
                return GamePhase.EVENT;

            case RoomType.PUZZLE:
                // Only show puzzle phase if puzzle hasn't been solved
                if (room.puzzle && !room.puzzle.solved && room.puzzle.attempts < room.puzzle.maxAttempts) {
                    return GamePhase.PUZZLE;
                }
                return GamePhase.EXPLORATION;

            case RoomType.TREASURE:
                return GamePhase.TREASURE;

            case RoomType.ENTRANCE:
            default:
                return GamePhase.EXPLORATION;
        }
    }

    /**
     * Result of completing a room, including rewards granted.
     */
    public lastRoomRewards: { gold: number; experience: number; items: Item[]; healthRestore?: number } | null = null;

    /**
     * Completes the current room and grants rewards to the player.
     * 
     * This method:
     * 1. Validates the room can be completed (active, no remaining enemies)
     * 2. Grants gold, experience, and items to the player
     * 3. Updates game statistics
     * 4. Transitions to victory if boss room, otherwise exploration
     * 
     * @returns The updated GameState after completion
     * @throws Error if no current room, room not active, or enemies remain
     * 
     * @example
     * ```typescript
     * // After defeating all enemies in combat
     * const state = manager.completeRoom();
     * console.log(state.stats.goldCollected); // Updated gold total
     * ```
     */
    completeRoom(): GameState {
        const currentRoom = this.getCurrentRoom();
        if (!currentRoom) {
            throw new Error('No current room');
        }

        if (currentRoom.state !== RoomState.ACTIVE) {
            throw new Error('Room is not active');
        }

        if (this.currentGameState.phase === GamePhase.COMBAT && this.currentGameState.dungeon.rooms.get(this.currentGameState.dungeon.currentRoomId as string)?.enemies?.some(enemy => enemy.health > 0)) {
            throw new Error('Cannot complete room in combat');
        }

        const rewards = currentRoom.complete();
        const { player } = this.currentGameState;

        if (player) {
            player.addGold(rewards.gold);
            player.addExperience(rewards.experience);
            player.inventory.push(...rewards.items);
            if (rewards.healthRestore) {
                player.heal(rewards.healthRestore);
            }
        }

        this.currentGameState.stats.goldCollected += rewards.gold;
        this.currentGameState.stats.itemsFound += rewards.items.length;
        this.currentGameState.stats.enemiesDefeated += currentRoom.enemies?.length ?? 0;

        // Store rewards for display
        this.lastRoomRewards = {
            gold: rewards.gold,
            experience: rewards.experience,
            items: [...rewards.items],
            healthRestore: rewards.healthRestore
        };

        if (currentRoom.type === RoomType.BOSS) {
            this.currentGameState.phase = GamePhase.VICTORY;
        } else {
            this.currentGameState.phase = GamePhase.EXPLORATION;
        }
        this.currentGameState.combat = null;

        return this.currentGameState;
    }

    /**
     * Gets and clears the last room rewards (for display purposes).
     * @returns The rewards from the last completed room, or null if none
     */
    getAndClearLastRewards(): { gold: number; experience: number; items: Item[]; healthRestore?: number } | null {
        const rewards = this.lastRoomRewards;
        this.lastRoomRewards = null;
        return rewards;
    }

    /**
     * Returns all actions available to the player in the current game phase.
     * 
     * Actions vary by phase:
     * - **EXPLORATION**: move, interact, open_inventory, view_character
     * - **COMBAT**: basic_attack, ability, use_item, flee
     * - **SHOP**: sell, leave_shop
     * - **REST**: rest, leave
     * - **EVENT**: event-specific choices
     * - **GAME_OVER**: restart, quit
     * - **VICTORY**: view_stats, restart
     * 
     * @returns Array of valid Action objects for the current state
     * @throws Error if no player exists
     * 
     * @example
     * ```typescript
     * const actions = manager.getAvailableActions();
     * actions.forEach((action, i) => {
     *   console.log(`${i + 1}. ${action.type} ${action.name || ''}`);
     * });
     * ```
     */
    getAvailableActions(): Action[] {
        let actions: Action[] = [];
        const { player } = this.currentGameState;
        const currentRoom = this.getCurrentRoom();
        if (!player) {
            throw new Error('No player');
        }

        switch (this.currentGameState.phase) {

            case GamePhase.EXPLORATION:
                if (!currentRoom) {
                    throw new Error('No current room');
                }
                for (const connectedId of currentRoom.connections) {
                    const connectedRoom = this.currentGameState.dungeon.rooms.get(connectedId);
                    if (connectedRoom && connectedRoom.canEnter()) {
                        actions.push({ type: 'move', roomId: connectedId, roomType: connectedRoom.type });
                    }
                }
                currentRoom.interactables.forEach((interactable, index) => {
                    if (!interactable.used || interactable.type === 'npc') {
                        actions.push({ 
                            type: 'interact', 
                            interactableIndex: index,
                            interactableName: interactable.name 
                        });
                    }
                });
                actions.push({ type: 'open_inventory' });
                actions.push({ type: 'view_character' });
                break;
            case GamePhase.COMBAT:
                // Attack
                actions.push({ type: 'basic_attack' })

                // Abilities (if not on cooldown and have mana)
                for (const ability of player.getAllAbilities()) {
                    if (ability.currentCooldown === 0 && player.stats.mana >= ability.manaCost) {
                        actions.push({ type: 'ability', abilityId: ability.id, name: ability.name })
                    }
                }

                // Usable items
                for (const item of player.getInventoryByType(ItemType.CONSUMABLE)) {
                    actions.push({ type: 'use_item', itemId: item.id, name: item.name })
                }

                // Flee (not from boss)
                if (currentRoom && currentRoom.type !== RoomType.BOSS) {
                    actions.push({ type: 'flee' })
                }
                break;
            case GamePhase.SHOP:
                // Add buy actions for each shop item
                if (currentRoom?.shopInventory) {
                    for (const shopItem of currentRoom.shopInventory) {
                        actions.push({ 
                            type: 'buy_item', 
                            itemId: shopItem.item.id, 
                            itemName: shopItem.item.name,
                            price: shopItem.buyPrice
                        });
                    }
                }
                // Add sell actions for each item in player inventory
                if (player) {
                    for (const item of player.inventory) {
                        const sellPrice = getSellPrice(item);
                        actions.push({ 
                            type: 'sell_item', 
                            itemId: item.id, 
                            itemName: item.name,
                            price: sellPrice
                        });
                    }
                }
                actions.push({ type: 'leave_shop' });
                break;
            case GamePhase.REST:
                actions.push({ type: 'rest' })  // Full heal
                actions.push({ type: 'leave' })
                break;
            case GamePhase.EVENT:
                // Event rooms have a single "accept fate" action
                // The outcome is already determined when entering the room
                actions.push({ type: 'accept_event', name: 'Accept Your Fate' });
                break;
            case GamePhase.GAME_OVER:
                actions.push({ type: 'restart' })
                actions.push({ type: 'quit' })
                break;
            case GamePhase.VICTORY:
                actions.push({ type: 'view_stats' })
                actions.push({ type: 'restart' })
                break;
            case GamePhase.INVENTORY:
                // Close inventory button
                actions.push({ type: 'close_inventory' });
                
                // Add equip actions for each equippable item in inventory
                if (player) {
                    for (const item of player.inventory) {
                        if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR || item.type === ItemType.ACCESSORY) {
                            actions.push({ 
                                type: 'equip_item', 
                                itemId: item.id, 
                                itemName: item.name 
                            });
                        }
                        // Add use action for consumables
                        if (item.type === ItemType.CONSUMABLE) {
                            actions.push({ 
                                type: 'use_item', 
                                itemId: item.id, 
                                itemName: item.name 
                            });
                        }
                    }
                    // Add unequip actions for equipped items
                    if (player.equipment.weapon) {
                        actions.push({ 
                            type: 'unequip_item', 
                            itemId: player.equipment.weapon.id, 
                            itemName: player.equipment.weapon.name,
                            slot: 'weapon'
                        });
                    }
                    if (player.equipment.armor) {
                        actions.push({ 
                            type: 'unequip_item', 
                            itemId: player.equipment.armor.id, 
                            itemName: player.equipment.armor.name,
                            slot: 'armor'
                        });
                    }
                    if (player.equipment.accessory) {
                        actions.push({ 
                            type: 'unequip_item', 
                            itemId: player.equipment.accessory.id, 
                            itemName: player.equipment.accessory.name,
                            slot: 'accessory'
                        });
                    }
                }
                break;
            case GamePhase.CHARACTER:
                actions.push({ type: 'close_character' });
                break;
            
            case GamePhase.PUZZLE:
                // Add answer options for the puzzle
                if (currentRoom?.puzzle && !currentRoom.puzzle.solved) {
                    currentRoom.puzzle.options.forEach((option, index) => {
                        actions.push({ 
                            type: 'puzzle_answer', 
                            answerIndex: index,
                            answerText: option
                        });
                    });
                    // Allow skipping the puzzle (forfeit rewards)
                    actions.push({ type: 'skip_puzzle', name: 'Skip Puzzle' });
                }
                break;
            
            case GamePhase.TREASURE:
                // Treasure rooms allow interacting with chests
                if (currentRoom?.interactables) {
                    currentRoom.interactables.forEach((obj, index) => {
                        if (!obj.used) {
                            actions.push({ 
                                type: 'interact', 
                                interactableIndex: index,
                                interactableName: obj.name
                            });
                        }
                    });
                }
                // Can leave once done
                actions.push({ type: 'leave', name: 'Leave Room' });
                break;
        }

        return actions
    }

    /**
     * Executes a player action and returns the result.
     * 
     * Handles all action types including movement, interaction, combat,
     * item usage, and menu actions. Updates game state accordingly.
     * 
     * @param action - The Action to execute
     * @returns ActionResult describing what happened
     * @throws Error if no player, invalid action type, or action prerequisites not met
     * 
     * @example
     * ```typescript
     * const moveAction = { type: 'move', roomId: 'room-123' };
     * const result = manager.executeAction(moveAction);
     * 
     * if (result.success) {
     *   console.log(result.message); // 'Moved to new room'
     * }
     * ```
     */
    async executeAction(action: Action): Promise<ActionResult> {
        const { player, stats } = this.currentGameState;
        if (!player) {
            throw new Error('No player');
        }
        
        switch (action.type) {
            case 'move':
                await this.moveToRoom(action.roomId as string);
                return { type: 'moved', success: true, message: 'Moved to new room' };

            case 'basic_attack':
                return this.processCombatAction({ type: 'attack' });

            case 'ability':
                return this.processCombatAction({ type: 'ability', abilityId: action.abilityId });

            case 'use_item':
                return this.inventoryManager.useItem(player, action.itemId as string);

            case 'equip_item':
                return this.inventoryManager.equipItem(player, action.itemId as string);

            case 'unequip_item':
                return this.inventoryManager.unequipItem(player, action.slot);

            case 'flee':
                return this.attemptFlee();

            case 'rest':
                player.rest();
                this.currentGameState.phase = GamePhase.EXPLORATION;
                return { type: 'rested', success: true, message: 'You feel refreshed!' };

            case 'accept_event':
                return this.executeEvent();

            case 'buy_item':
                return this.shopManager.buyItem(
                    player, 
                    this.getCurrentRoom(), 
                    action.itemId as string, 
                    this.currentGameState.stats
                );

            case 'sell_item':
                return this.shopManager.sellItem(
                    player, 
                    action.itemId as string, 
                    this.currentGameState.stats
                );

            case 'puzzle_answer': {
                const currentRoom = this.getCurrentRoom();
                const puzzleOutcome = this.puzzleManager.attemptAnswer(
                    player,
                    currentRoom,
                    action.answerIndex,
                    this.currentGameState.stats
                );
                if (puzzleOutcome.roomComplete && currentRoom) {
                    currentRoom.complete();
                }
                if (puzzleOutcome.newPhase) {
                    this.currentGameState.phase = puzzleOutcome.newPhase;
                }
                return puzzleOutcome.result;
            }

            case 'skip_puzzle': {
                const currentRoom = this.getCurrentRoom();
                const puzzleOutcome = this.puzzleManager.skipPuzzle(currentRoom);
                if (puzzleOutcome.roomComplete && currentRoom) {
                    currentRoom.complete();
                }
                if (puzzleOutcome.newPhase) {
                    this.currentGameState.phase = puzzleOutcome.newPhase;
                }
                return puzzleOutcome.result;
            }

            case 'interact': {
                const interactionOutcome = this.interactionManager.interact(
                    player,
                    this.getCurrentRoom(),
                    action.interactableIndex,
                    this.currentGameState.stats
                );
                if (interactionOutcome.playerDied) {
                    this.handlePlayerDeath();
                }
                return interactionOutcome.result;
            }

            case 'leave_shop':
            case 'leave':
                this.currentGameState.phase = GamePhase.EXPLORATION;
                return { type: 'left', success: true, message: 'You left the area' };

            case 'restart':
                return { type: 'restart_requested', success: true, message: 'Restart requested' };

            case 'open_inventory':
                // Store the current phase so we can return to it
                this.previousPhase = this.currentGameState.phase;
                this.currentGameState.phase = GamePhase.INVENTORY;
                return { type: 'inventory_opened', success: true };

            case 'close_inventory':
                // Return to the phase we were in before opening inventory
                this.currentGameState.phase = this.previousPhase ?? GamePhase.EXPLORATION;
                this.previousPhase = null;
                return { type: 'inventory_closed', success: true };

            case 'view_character':
                this.previousPhase = this.currentGameState.phase;
                this.currentGameState.phase = GamePhase.CHARACTER;
                return { type: 'character_viewed', success: true };

            case 'close_character':
                this.currentGameState.phase = this.previousPhase ?? GamePhase.EXPLORATION;
                this.previousPhase = null;
                return { type: 'character_closed', success: true };

            case 'view_stats':
                return { type: 'stats_viewed', success: true };

            case 'quit':
                return { type: 'quit_requested', success: true };

            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Explicitly handles player death and transitions to game over state.
     * Use this when player death is detected externally (e.g., in CombatEngine).
     * 
     * @returns The updated GameState in GAME_OVER phase
     */
    handlePlayerDeath(): GameState {
        this.currentGameState.phase = GamePhase.GAME_OVER;
        this.currentGameState.combat = null;
        return this.currentGameState;
    }

    /**
     * Attempts to flee from the current combat encounter.
     * 
     * - Cannot flee from boss rooms
     * - 50% base chance to escape
     * - Uses seeded RNG for reproducibility
     * 
     * @returns ActionResult indicating success or failure
     * @private
     */
    private attemptFlee(): ActionResult {
        const currentRoom = this.getCurrentRoom();
        if (!currentRoom) {
            return { type: 'flee', success: false, message: 'Cannot flee - no current room' };
        }

        if (currentRoom.type === RoomType.BOSS) {
            return { type: 'flee', success: false, message: 'Cannot flee from boss!' };
        }

        // Base chance to flee, using seeded RNG if available
        const roll = isRNGInitialized() 
            ? getRNG().nextInt(1, 100) 
            : Math.floor(Math.random() * 100) + 1;

        if (roll <= BASE_FLEE_CHANCE) {
            this.currentGameState.phase = GamePhase.EXPLORATION;
            this.currentGameState.combat = null;
            return { type: 'flee', success: true, message: 'You escaped!' };
        } else {
            return { type: 'flee', success: false, message: 'Failed to escape!' };
        }
    }

    /**
     * Executes the mysterious event in the current EVENT room.
     * Delegates to EventManager for processing.
     * 
     * @returns ActionResult with the event outcome details
     * @private
     */
    private executeEvent(): ActionResult {
        const currentRoom = this.getCurrentRoom();
        const player = this.currentGameState.player;
        
        if (!player) {
            return { type: 'event', success: false, message: 'Cannot execute event' };
        }
        
        const eventOutcome = this.eventManager.executeEvent(
            player,
            currentRoom,
            this.currentGameState.stats
        );
        
        if (eventOutcome.playerDied) {
            this.currentGameState.phase = GamePhase.GAME_OVER;
        } else {
            this.currentGameState.phase = eventOutcome.newPhase;
        }
        
        return eventOutcome.result;
    }

    /**
     * Processes a combat action (attack or ability).
     * 
     * Note: Combat actions are handled by the GameLoop's CombatEngine integration,
     * not through GameStateManager. This method exists for API completeness but
     * should not be called directly - use GameLoop.executeCombatAction() instead.
     * 
     * @param action - The combat action to process
     * @returns ActionResult indicating combat should be handled by GameLoop
     * @private
     * @throws Error if called directly, as combat should go through GameLoop
     */
    private processCombatAction(action: { type: string; abilityId?: string }): ActionResult {
        // Combat actions are handled by GameLoop's CombatEngine integration.
        // This method should not be called directly during normal gameplay.
        // The GameLoop intercepts combat actions and routes them to CombatEngine.
        
        const { player } = this.currentGameState;
        if (!player) {
            throw new Error('No player');
        }

        const currentRoom = this.getCurrentRoom();
        if (!currentRoom || !currentRoom.enemies || currentRoom.enemies.length === 0) {
            return { type: 'combat_action', success: false, message: 'No enemies to fight' };
        }

        // Return a result indicating this should be handled by GameLoop
        // This is a fallback for any edge cases where this is called directly
        return { 
            type: 'combat_action', 
            success: true, 
            message: `Combat action '${action.type}' should be processed by GameLoop.CombatEngine`
        };
    }
}
