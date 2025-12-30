/**
 * @fileoverview Procedural Dungeon Generation System
 * 
 * This module handles the procedural generation of dungeon layouts using
 * a layered approach. Dungeons are generated with:
 * - Multiple levels (layers) of increasing difficulty
 * - Branching paths that converge toward the boss
 * - Varied room types (combat, treasure, shop, rest, etc.)
 * - Guaranteed special rooms at key intervals
 * 
 * The generator uses seeded RNG for reproducible dungeon layouts.
 * 
 * @module integration/dungeonGenerator
 */

import { Room, RoomState, RoomType} from "../dungeon/room";
import { Seed, initializeRNG } from "../game/seed";
import { DungeonLayer } from "../game/seed";

/**
 * Procedural dungeon generator that creates interconnected room layouts.
 * 
 * The generator creates dungeons with the following structure:
 * - Level 1: Entrance room
 * - Levels 2-19: Combat, treasure, shop, rest, and event rooms
 * - Level 20: Boss room
 * 
 * Room distribution varies by dungeon stage:
 * - Early game (1-5): 70% combat, rest of treasure/rest/event
 * - Mid game (6-13): 60% combat, introduces elite and shop rooms
 * - Late game (14-19): 50% combat, more elite and puzzle rooms
 * 
 * @example
 * ```typescript
 * const generator = new DungeonGenerator('my-seed');
 * const rooms = await generator.generate(20, 3, 0.3);
 * const layers = generator.getLayers();
 * ```
 */
export class DungeonGenerator {
    /** Seeded RNG instance for reproducible generation */
    private rng: Seed;
    
    /** All generated rooms (flat array) */
    private rooms: Room[] = [];
    
    /** Rooms organized by dungeon level */
    private layers: DungeonLayer[] = [];

    /**
     * Creates a new DungeonGenerator with the specified seed.
     * Also initializes the global RNG for use throughout the game.
     * 
     * @param seed - String seed for reproducible generation
     */
    constructor(seed: string) {
        // Initialize global RNG and use it for dungeon generation
        this.rng = initializeRNG(seed);
    }

    /**
     * Generates a complete dungeon with the specified parameters.
     * Creates rooms from entrance through boss, with branching paths.
     * 
     * Note: This method is now synchronous. Enemy data is loaded lazily
     * when entering rooms, not during generation.
     * 
     * @param totalLevels - Total number of dungeon levels (default: 20)
     * @param branchingFactor - Maximum rooms per level (default: 3)
     * @param convergenceRate - Rate at which paths merge (0-1, default: 0.3)
     * @returns Array of all generated rooms
     * 
     * @example
     * ```typescript
     * // Generate a 20-level dungeon with up to 3 rooms per level
     * const rooms = generator.generate(20, 3, 0.3);
     * ```
     */
    generate(
        totalLevels: number = 20,
        branchingFactor: number = 3,
        convergenceRate: number = 0.3
    ): Room[] {
        this.rooms = [];
        this.layers = [];

        // Generate entrance room
        this.createEntrance();

        for (let level = 2; level < totalLevels; level++) {
            this.generateLevel(level, branchingFactor, convergenceRate);
        }
        this.createBoss(totalLevels);
        this.placeSpecialRooms();

        return this.rooms;
    }

    /**
     * Creates the entrance room at level 1.
     * The entrance is always available and serves as the starting point.
     * 
     * @private
     */
    private createEntrance(): void {
        const entrance = Room.create(RoomType.ENTRANCE, 1);
        entrance.state = RoomState.AVAILABLE;

        this.rooms.push(entrance);
        this.layers.push({ level: 1, rooms: [entrance] });
    }

    /**
     * Generates a single dungeon level with multiple rooms.
     * 
     * @param level - The level number to generate
     * @param branchingFactor - Maximum rooms allowed at this level
     * @param convergenceRate - Probability of creating extra connections
     * @private
     */
    private generateLevel(
        level: number,
        branchingFactor: number,
        convergenceRate: number
    ): void {
        const previousLayer = this.layers[this.layers.length - 1];
        const currentLayerRooms: Room[] = [];

        const roomCount = this.calculateRoomCount(
            level,
            branchingFactor,
            previousLayer.rooms.length
        );

        for (let i = 0; i < roomCount; i++) {
            const roomType = this.selectRoomType(level);
            const room = Room.create(roomType, level);
            currentLayerRooms.push(room);
            this.rooms.push(room);
        }

        this.connectLayers(previousLayer.rooms, currentLayerRooms, convergenceRate);
        this.layers.push({ level, rooms: currentLayerRooms });
    }

    /**
     * Calculates how many rooms should be at a given level.
     * 
     * The algorithm:
     * - Early game (1-5): Gradual growth
     * - Mid game (6-10): More aggressive expansion
     * - Late game (15+): Narrowing toward boss
     * - Final levels: Converge to single path
     * 
     * @param level - Current dungeon level
     * @param branchingFactor - Maximum rooms allowed
     * @param previousRoomCount - Number of rooms in previous level
     * @param maxLevel - Maximum dungeon level (default: 20)
     * @returns Number of rooms for this level
     * @private
     */
    private calculateRoomCount(
        level: number,
        branchingFactor: number,
        previousRoomCount: number,
        maxLevel: number = 20
    ): number {
        const levelsRemaining = maxLevel - level;

        // Early game (levels 1-5): gradual growth
        if (level <= 5) {
            return Math.min(branchingFactor, previousRoomCount + this.rng.nextInt(0, 1));
        }

        // Mid game: expand more aggressively
        if (level <= 10) {
            return Math.min(branchingFactor, previousRoomCount + this.rng.nextInt(0, 2));
        }

        // Approaching boss (last 5 levels): start narrowing
        if (levelsRemaining <= 5) {
            // More aggressive narrowing as you get closer
            if (levelsRemaining <= 2) {
                return Math.max(1, previousRoomCount - this.rng.nextInt(1, 2));
            }
            return Math.max(2, previousRoomCount - this.rng.nextInt(0, 1));
        }

        // Late-mid game: fluctuate/plateau
        return Math.max(2, previousRoomCount + this.rng.nextInt(-1, 1));
    }

    /**
     * Selects a room type based on dungeon progression.
     * 
     * Room type probabilities vary by stage:
     * - Stage 1 (0-30%): 70% combat, 15% treasure, 8% rest, 7% event
     * - Stage 2 (30-70%): 60% combat, 12% elite, 10% treasure, 8% shop, 6% rest, 4% puzzle
     * - Stage 3 (70-100%): 50% combat, 20% elite, 12% treasure, 10% puzzle, 8% event
     * 
     * @param level - Current dungeon level (1-20)
     * @returns The selected RoomType
     * @private
     */
    private selectRoomType(level: number): RoomType {
        const progress = level / 20;
        const rand = this.rng.nextFloat();

        // Stage 1 (levels 0-5): 70% combat
        if (progress < 0.3) {
            if (rand < 0.70) return RoomType.COMBAT;
            if (rand < 0.85) return RoomType.TREASURE;
            if (rand < 0.93) return RoomType.REST;
            return RoomType.EVENT;
        }

        // Stage 2 (levels 6-13): 60% combat
        if (progress < 0.7) {
            if (rand < 0.60) return RoomType.COMBAT;
            if (rand < 0.72) return RoomType.ELITE;
            if (rand < 0.82) return RoomType.TREASURE;
            if (rand < 0.90) return RoomType.SHOP;
            if (rand < 0.96) return RoomType.REST;
            return RoomType.PUZZLE;
        }

        // Stage 3 (levels 14-19): 50% combat
        if (rand < 0.50) return RoomType.COMBAT;
        if (rand < 0.70) return RoomType.ELITE;
        if (rand < 0.82) return RoomType.TREASURE;
        if (rand < 0.92) return RoomType.PUZZLE;
        return RoomType.EVENT;
    }

    /**
     * Creates connections between two adjacent dungeon layers.
     * 
     * Connection algorithm:
     * 1. First pass: Every room in fromLayer gets at least one forward connection
     * 2. Second pass: Add extra connections based on convergence rate
     * 3. Third pass: Ensure every room in toLayer has at least one incoming connection
     * 
     * @param fromRooms - Rooms in the previous layer
     * @param toRooms - Rooms in the current layer
     * @param convergenceRate - Probability of creating extra connections
     * @private
     */
    private connectLayers(
        fromRooms: Room[],
        toRooms: Room[],
        convergenceRate: number
    ): void {
        const connectedToRooms = new Set<string>();
        const connectedFromRooms = new Set<string>();

        // First pass: give each fromRoom at least one forward connection
        for (const fromRoom of fromRooms) {
            const targetRoom = this.rng.choice(toRooms);
            fromRoom.connectTo(targetRoom);
            connectedToRooms.add(targetRoom.id);
            connectedFromRooms.add(fromRoom.id);
        }

        // Second pass: add extra connections based on branching preferences
        for (const fromRoom of fromRooms) {
            const connectionCount = this.calculateConnections(
                fromRooms.length,
                toRooms.length,
                convergenceRate
            );

            // Already has 1 connection, add more if needed
            const additionalConnections = connectionCount - 1;
            
            for (let i = 0; i < additionalConnections; i++) {
                // Prefer rooms not yet connected to
                const availableRooms = toRooms.filter(
                    r => !fromRoom.connections.includes(r.id)
                );
                
                if (availableRooms.length > 0) {
                    const targetRoom = this.rng.choice(availableRooms);
                    fromRoom.connectTo(targetRoom);
                    connectedToRooms.add(targetRoom.id);
                }
            }
        }

        // Third pass: ensure all toRooms have at least one incoming connection
        for (const toRoom of toRooms) {
            if (!connectedToRooms.has(toRoom.id)) {
                const fromRoom = this.rng.choice(fromRooms);
                fromRoom.connectTo(toRoom);
            }
        }
    }

    /**
     * Calculates how many connections a room should have to the next layer.
     * 
     * @param fromCount - Number of rooms in the source layer
     * @param toCount - Number of rooms in the target layer
     * @param convergenceRate - Base probability for extra connections
     * @returns Number of connections (1 or 2)
     * @private
     */
    private calculateConnections(
        fromCount: number,
        toCount: number,
        convergenceRate: number
    ): number {
        let connections = 1;

        if (toCount > fromCount) {
            connections = this.rng.nextFloat() < 0.5 ? 1 : 2;
        } else if (toCount < fromCount) {
            connections = 1;
        } else {
            connections = this.rng.nextFloat() < convergenceRate ? 2 : 1;
        }

        return connections;
    }

    /**
     * Creates the boss room at the final level.
     * All rooms from the previous layer connect to the boss room.
     * 
     * @param level - The level number for the boss room
     * @private
     */
    private createBoss(level: number): void {
        const boss = Room.create(RoomType.BOSS, level);
        const previousLayer = this.layers[this.layers.length - 1];
        for (const room of previousLayer.rooms) {
            room.connectTo(boss);
        }

        this.rooms.push(boss);
        this.layers.push({ level, rooms: [boss] });
    }

    /**
     * Places guaranteed special rooms at specific intervals.
     * 
     * Special room placement:
     * - Rest rooms: Every 5 levels (5, 10, 15)
     * - Shop room: Random level between 10-15
     * - Treasure room: Random level between 3-8
     * 
     * @private
     */
    private placeSpecialRooms(): void {
        const restInterval = 5
        for (let level = restInterval; level < 20; level += restInterval) {
            const layer = this.layers[level - 1];
            if (layer && layer.rooms.length > 0) {
                const room = this.rng.choice(layer.rooms);
                if (room.type === RoomType.COMBAT) {
                    room.type = RoomType.REST;
                }
            }
        }

        const shopLevel = this.rng.nextInt(10, 15);
        const shopLayer = this.layers[shopLevel - 1];
        if(shopLayer){
            const room = this.rng.choice(shopLayer.rooms);
            room.type = RoomType.SHOP;
        }

        const treasureLevel = this.rng.nextInt(3, 8);
        const treasureLayer = this.layers[treasureLevel - 1];
        if (treasureLayer) {
            const room = this.rng.choice(treasureLayer.rooms);
            if (room.type !== RoomType.REST) {
                room.type = RoomType.TREASURE;
            }
        }
    }

    /**
     * Returns all dungeon layers after generation.
     * 
     * @returns Array of DungeonLayer objects, ordered by level
     */
    getLayers(): DungeonLayer[] {
        return this.layers;
    }

    /**
     * Validates dungeon connectivity and returns any issues found.
     * Checks that:
     * 1. Every room (except entrance) has at least one incoming connection from previous level
     * 2. Every room (except boss) has at least one outgoing connection to next level
     * 3. There's a valid path from entrance to boss
     * 
     * @returns Array of validation error messages, empty if valid
     */
    validateConnectivity(): string[] {
        const errors: string[] = [];
        
        // Build a map of room ID to room for quick lookup
        const roomMap = new Map<string, Room>();
        for (const room of this.rooms) {
            roomMap.set(room.id, room);
        }
        
        // Check each layer (except entrance and boss)
        for (let layerIndex = 1; layerIndex < this.layers.length - 1; layerIndex++) {
            const currentLayer = this.layers[layerIndex];
            const previousLayer = this.layers[layerIndex - 1];
            const nextLayer = this.layers[layerIndex + 1];
            
            for (const room of currentLayer.rooms) {
                // Check for incoming connections from previous layer
                const hasIncoming = previousLayer.rooms.some(prevRoom => 
                    prevRoom.connections.includes(room.id)
                );
                if (!hasIncoming) {
                    errors.push(`Level ${currentLayer.level} room ${room.id} has no incoming connection from level ${previousLayer.level}`);
                }
                
                // Check for outgoing connections to next layer
                const hasOutgoing = room.connections.some(connId => 
                    nextLayer.rooms.some(nextRoom => nextRoom.id === connId)
                );
                if (!hasOutgoing) {
                    errors.push(`Level ${currentLayer.level} room ${room.id} has no outgoing connection to level ${nextLayer.level}`);
                }
            }
        }
        
        // Check that entrance connects to level 2
        const entrance = this.layers[0].rooms[0];
        const level2 = this.layers[1];
        const entranceConnectsToLevel2 = entrance.connections.some(connId =>
            level2.rooms.some(room => room.id === connId)
        );
        if (!entranceConnectsToLevel2) {
            errors.push('Entrance has no connection to level 2');
        }
        
        // Check that all level 19 rooms connect to boss
        const preBossLayer = this.layers[this.layers.length - 2];
        const bossRoom = this.layers[this.layers.length - 1].rooms[0];
        for (const room of preBossLayer.rooms) {
            if (!room.connections.includes(bossRoom.id)) {
                errors.push(`Level ${preBossLayer.level} room ${room.id} does not connect to boss`);
            }
        }
        
        return errors;
    }
}
