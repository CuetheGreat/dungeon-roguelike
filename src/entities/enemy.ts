/**
 * @fileoverview Enemy Entity System for Dungeon Roguelike
 * 
 * This module defines the Enemy interface and MonsterAPI service for
 * fetching enemy data from the D&D 5e API. Enemies are the hostile
 * entities that players encounter in combat rooms.
 * 
 * The MonsterAPI provides:
 * - Fetching individual monsters by name
 * - Fetching monsters by challenge rating (CR)
 * - Automatic caching to reduce API calls
 * - Rate limiting to avoid 429 errors
 * - Level-appropriate monster selection for dungeon rooms
 * 
 * @see https://www.dnd5eapi.co/docs
 * @module entities/enemy
 */

import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Enemy category/type for classification.
 * Based on D&D 5e creature types.
 * @enum {string}
 */
export enum EnemyType {
    /** Alien beings from the Far Realm */
    ABERRATION = 'aberration',
    /** Natural animals and creatures */
    BEAST = 'beast',
    /** Divine beings from the Upper Planes */
    CELESTIAL = 'celestial',
    /** Magically animated objects */
    CONSTRUCT = 'construct',
    /** Powerful reptilian creatures */
    DRAGON = 'dragon',
    /** Beings from the Elemental Planes */
    ELEMENTAL = 'elemental',
    /** Magical creatures from the Feywild */
    FEY = 'fey',
    /** Evil beings from the Lower Planes */
    FIEND = 'fiend',
    /** Massive humanoid creatures */
    GIANT = 'giant',
    /** Human-like creatures */
    HUMANOID = 'humanoid',
    /** Unnatural creatures, often magical hybrids */
    MONSTROSITY = 'monstrosity',
    /** Amorphous creatures */
    OOZE = 'ooze',
    /** Animated plant creatures */
    PLANT = 'plant',
    /** Creatures animated by dark magic */
    UNDEAD = 'undead'
}

/**
 * Represents an enemy entity with combat statistics.
 * @interface
 */
export interface Enemy {
    /** Unique identifier for the enemy instance */
    id: string;
    /** Display name of the enemy */
    name: string;
    /** Current health points */
    health: number;
    /** Maximum health points */
    maxHealth: number;
    /** Base attack power value (attack bonus) */
    attackPower: number;
    /** Defense/armor class value */
    defense: number;
    /** Experience points awarded upon defeat */
    experience: number;
    /** Challenge rating indicating difficulty (D&D CR scale) */
    challengeRating: number;
    /** Enemy classification type */
    type: EnemyType;
    /** Initiative/speed modifier for turn order */
    speed: number;
    /** URL to the monster's image (from D&D 5e API) */
    imageUrl?: string;
}

/**
 * Response structure from the D&D 5e API for armor class.
 * @interface
 * @private
 */
interface APIArmorClass {
    type: string;
    value: number;
}

/**
 * Response structure from the D&D 5e API for monsters.
 * @interface
 * @private
 */
interface MonsterAPIResponse {
    index: string;
    name: string;
    hit_points: number;
    armor_class: APIArmorClass[];
    challenge_rating: number;
    xp: number;
    type: string;
    speed: {
        walk?: string;
        fly?: string;
        swim?: string;
    };
    actions?: Array<{
        name: string;
        attack_bonus?: number;
    }>;
    /** Path to monster image (relative to API base) */
    image?: string;
}

/**
 * Response structure for monster list queries.
 * @interface
 * @private
 */
interface MonsterListResponse {
    count: number;
    results: Array<{
        index: string;
        name: string;
        url: string;
    }>;
}

/**
 * Error thrown when monster API operations fail.
 * Includes additional context about the failure.
 */
export class MonsterAPIError extends Error {
    /**
     * Creates a new Error.
     * 
     * @param message - Error description
     * @param statusCode - HTTP status code (if applicable)
     * @param monsterName - Name of the monster that failed (if applicable)
     */
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly monsterName?: string
    ) {
        super(message);
        this.name = 'MonsterAPIError';
    }
}

/**
 * Delay utility for rate limiting.
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 * @private
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Service for fetching enemy data from the D&D 5e API.
 * 
 * Implements caching and rate limiting to avoid 429 errors.
 * All methods are static - no instantiation required.
 * 
 * **Caching:**
 * - Individual monsters are cached by index name
 * - CR-based queries are cached by CR value
 * - Use clearCache() to free memory after dungeon generation
 * 
 * **Rate Limiting:**
 * - 100ms delay between API requests
 * - Cached requests skip the delay
 * 
 * @see https://www.dnd5eapi.co/docs
 * 
 * @example
 * ```typescript
 * // Get a specific monster
 * const goblin = await MonsterAPI.getMonsterByName('goblin');
 * 
 * // Get monsters for a dungeon level
 * const enemies = await MonsterAPI.getMonstersForLevel(5, 3);
 * 
 * // Clear cache when done
 * MonsterAPI.clearCache();
 * ```
 */
export class MonsterAPI {
    /** Base URL for the D&D 5e API monsters endpoint */
    private static readonly BASE_URL = 'https://www.dnd5eapi.co/api/2014/monsters';
    
    /** Delay between API requests in milliseconds */
    private static readonly REQUEST_DELAY_MS = 100;
    
    /** In-memory cache for monster data (keyed by monster index) */
    private static monsterCache: Map<string, Enemy> = new Map();
    
    /** In-memory cache for monsters by CR (keyed by CR value) */
    private static crCache: Map<number, Enemy[]> = new Map();
    
    /** In-memory cache for monster name lists by CR (lightweight, just indexes) */
    private static crNameListCache: Map<number, string[]> = new Map();

    /**
     * Clears all cached monster data.
     * Useful for testing or freeing memory after dungeon generation.
     */
    static clearCache(): void {
        this.monsterCache.clear();
        this.crCache.clear();
        this.crNameListCache.clear();
    }

    /**
     * Fetches a monster by its index/name from the D&D 5e API.
     * Uses cache to avoid redundant API calls.
     * 
     * @param name - The monster's index name (e.g., 'goblin', 'adult-red-dragon')
     * @returns A promise that resolves to an Enemy object
     * @throws {MonsterAPIError} If the fetch fails or the monster is not found
     * 
     * @example
     * ```typescript
     * const dragon = await MonsterAPI.getMonsterByName('adult-red-dragon');
     * console.log(dragon.health, dragon.attackPower);
     * ```
     */
    static async getMonsterByName(name: string): Promise<Enemy> {
        const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
        
        // Check cache first
        const cached = this.monsterCache.get(normalizedName);
        if (cached) {
            return cached;
        }
        
        let response: Response;
        try {
            response = await fetch(`${this.BASE_URL}/${normalizedName}`);
        } catch (error) {
            throw new MonsterAPIError(
                `Network error fetching monster: ${error instanceof Error ? error.message : 'Unknown error'}`,
                undefined,
                name
            );
        }

        if (!response.ok) {
            throw new MonsterAPIError(
                `Monster '${name}' not found or API error`,
                response.status,
                name
            );
        }

        let data: MonsterAPIResponse;
        try {
            data = await response.json() as MonsterAPIResponse;
        } catch {
            throw new MonsterAPIError(
                'Failed to parse API response',
                response.status,
                name
            );
        }

        const enemy = this.mapToEnemy(data);
        
        // Store in cache
        this.monsterCache.set(normalizedName, enemy);
        
        return enemy;
    }

    /** Base URL for the D&D 5e API (for constructing image URLs) */
    private static readonly API_BASE = 'https://www.dnd5eapi.co';

    /**
     * Maps the D&D 5e API response to our Enemy interface.
     * 
     * @param data - The raw API response
     * @returns A properly structured Enemy object
     * @private
     */
    private static mapToEnemy(data: MonsterAPIResponse): Enemy {
        // Extract the first armor class value (most monsters have one)
        const defense = data.armor_class?.[0]?.value ?? 10;

        // Extract attack bonus from first action with an attack, or default to 0
        const attackPower = data.actions?.find(a => a.attack_bonus !== undefined)?.attack_bonus ?? 0;

        // Parse speed from walk speed string (e.g., "30 ft." -> 30)
        const speedString = data.speed?.walk ?? '30 ft.';
        const speed = parseInt(speedString, 10) || 30;

        // Map API type string to our EnemyType enum
        const type = this.mapEnemyType(data.type);

        // Construct full image URL if image path is provided
        const imageUrl = data.image ? `${this.API_BASE}${data.image}` : undefined;

        return {
            id: data.index,
            name: data.name,
            health: data.hit_points,
            maxHealth: data.hit_points,
            attackPower,
            defense,
            experience: data.xp ?? 0,
            challengeRating: data.challenge_rating ?? 0,
            type,
            speed,
            imageUrl
        };
    }

    /**
     * Maps a D&D 5e API type string to our EnemyType enum.
     * 
     * @param apiType - The type string from the API
     * @returns The corresponding EnemyType enum value
     * @private
     */
    private static mapEnemyType(apiType: string): EnemyType {
        const typeMap: Record<string, EnemyType> = {
            'aberration': EnemyType.ABERRATION,
            'beast': EnemyType.BEAST,
            'celestial': EnemyType.CELESTIAL,
            'construct': EnemyType.CONSTRUCT,
            'dragon': EnemyType.DRAGON,
            'elemental': EnemyType.ELEMENTAL,
            'fey': EnemyType.FEY,
            'fiend': EnemyType.FIEND,
            'giant': EnemyType.GIANT,
            'humanoid': EnemyType.HUMANOID,
            'monstrosity': EnemyType.MONSTROSITY,
            'ooze': EnemyType.OOZE,
            'plant': EnemyType.PLANT,
            'undead': EnemyType.UNDEAD
        };

        return typeMap[apiType.toLowerCase()] ?? EnemyType.MONSTROSITY;
    }

    /**
     * Fetches multiple monsters by their names.
     * Fetches sequentially with delays to avoid rate limiting.
     * 
     * @param names - Array of monster index names
     * @returns A promise that resolves to an array of Enemy objects
     * @throws {MonsterAPIError} If any fetch fails
     */
    static async getMonsters(names: string[]): Promise<Enemy[]> {
        const enemies: Enemy[] = [];
        
        for (const name of names) {
            const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
            
            // Only delay if not cached
            if (!this.monsterCache.has(normalizedName)) {
                await delay(this.REQUEST_DELAY_MS);
            }
            
            const enemy = await this.getMonsterByName(name);
            enemies.push(enemy);
        }
        
        return enemies;
    }

    /**
     * Fetches just the list of monster names/indexes for a challenge rating.
     * This is a lightweight call that doesn't fetch full monster details.
     * Uses cache to avoid redundant API calls.
     * 
     * @param cr - The challenge rating to filter by
     * @returns A promise that resolves to an array of monster index names
     * @throws {MonsterAPIError} If the fetch fails
     * @private
     */
    private static async getMonsterNamesByCR(cr: number): Promise<string[]> {
        // Check name list cache first
        const cached = this.crNameListCache.get(cr);
        if (cached) {
            return cached;
        }
        
        let response: Response;
        try {
            await delay(this.REQUEST_DELAY_MS);
            response = await fetch(`${this.BASE_URL}?challenge_rating=${cr}`);
        } catch (error) {
            throw new MonsterAPIError(
                `Network error fetching monsters by CR: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        if (!response.ok) {
            throw new MonsterAPIError(
                `Failed to fetch monsters with CR ${cr}`,
                response.status
            );
        }

        let data: MonsterListResponse;
        try {
            data = await response.json() as MonsterListResponse;
        } catch {
            throw new MonsterAPIError(
                'Failed to parse monster list response',
                response.status
            );
        }
 
        const monsterNames = data.results.map(m => m.index);
        
        // Store in name list cache
        this.crNameListCache.set(cr, monsterNames);
        
        return monsterNames;
    }

    /**
     * Fetches monsters filtered by challenge rating.
     * Uses cache to avoid redundant API calls.
     * Useful for populating rooms based on dungeon level.
     * 
     * @param cr - The challenge rating to filter by (e.g., 0.25, 0.5, 1, 2, etc.)
     * @returns A promise that resolves to an array of Enemy objects matching the CR
     * @throws {MonsterAPIError} If the fetch fails
     */
    static async getMonstersByCR(cr: number): Promise<Enemy[]> {
        // Check CR cache first
        const cachedCR = this.crCache.get(cr);
        if (cachedCR) {
            return cachedCR;
        }
        
        // Get monster names (lightweight call)
        const monsterNames = await this.getMonsterNamesByCR(cr);
 
        // Fetch full details for each monster in the list (with rate limiting)
        const monsters = await this.getMonsters(monsterNames);
        
        // Store in CR cache
        this.crCache.set(cr, monsters);
        
        return monsters;
    }

    /**
     * Fetches monsters within a challenge rating range.
     * Fetches sequentially to avoid rate limiting.
     * Useful for scaling encounters based on dungeon level.
     * 
     * @param minCR - Minimum challenge rating (inclusive)
     * @param maxCR - Maximum challenge rating (inclusive)
     * @returns A promise that resolves to an array of Enemy objects within the CR range
     * @throws {MonsterAPIError} If the fetch fails
     */
    static async getMonstersByCRRange(minCR: number, maxCR: number): Promise<Enemy[]> {
        // D&D 5e CR values: 0, 0.125, 0.25, 0.5, 1, 2, 3, ... 30
        const crValues = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];
        const validCRs = crValues.filter(cr => cr >= minCR && cr <= maxCR);

        const allMonsters: Enemy[] = [];
        
        // Fetch sequentially to avoid rate limiting
        for (const cr of validCRs) {
            const monsters = await this.getMonstersByCR(cr);
            allMonsters.push(...monsters);
        }

        return allMonsters;
    }

    /**
     * Fetches random monsters matching the given challenge rating.
     * Only fetches full details for the selected monsters (not the entire CR list).
     * Uses seeded RNG for reproducible results.
     * Falls back to local monster database if API fails.
     * 
     * @param cr - The challenge rating to filter by
     * @param count - Number of monsters to fetch (default: 1)
     * @returns A promise that resolves to an array of random Enemy objects matching the CR
     */
    static async getRandomMonstersByCR(cr: number, count: number = 1): Promise<Enemy[]> {
        try {
            // Get just the monster names (lightweight - no full data fetch)
            const monsterNames = await this.getMonsterNamesByCR(cr);
            if (monsterNames.length === 0) {
                // Fall back to local database if API returns no results
                return this.getRandomMonstersFromLocalDB(cr, count);
            }
            
            // Randomly select 'count' monster names
            const selectedNames: string[] = [];
            const rng = isRNGInitialized() ? getRNG() : null;
            
            for (let i = 0; i < count && monsterNames.length > 0; i++) {
                const randomIndex = rng 
                    ? rng.nextInt(0, monsterNames.length - 1)
                    : Math.floor(Math.random() * monsterNames.length);
                selectedNames.push(monsterNames[randomIndex]);
            }
            
            // Only fetch full details for the selected monsters
            const enemies = await this.getMonsters(selectedNames);
            
            // Give each enemy a unique instance ID
            return enemies.map(enemy => ({
                ...enemy,
                id: `${enemy.id}-${crypto.randomUUID().slice(0, 8)}`
            }));
        } catch (error) {
            // API failed - fall back to local database
            console.warn('Monster API failed, using local fallback:', error);
            return this.getRandomMonstersFromLocalDB(cr, count);
        }
    }

    /**
     * Gets random monsters from the local fallback database.
     * Used when the API is unavailable or fails.
     * 
     * @param cr - The challenge rating to filter by
     * @param count - Number of monsters to get
     * @returns Array of Enemy objects from local database
     */
    private static getRandomMonstersFromLocalDB(cr: number, count: number): Enemy[] {
        // Dynamic import to avoid circular dependencies
        const { getRandomLocalMonsters } = require('./monsterDatabase');
        const rng = isRNGInitialized() ? getRNG() : null;
        return getRandomLocalMonsters(cr, count, rng);
    }

    /**
     * Fetches random monsters for a room based on dungeon level.
     * Maps dungeon level to appropriate challenge ratings.
     * Uses seeded RNG for reproducible results.
     * 
     * **Level to CR mapping:**
     * - Level 1-2: CR 0-0.5 (easy encounters)
     * - Level 3-4: CR 0.5-2
     * - Level 5-6: CR 2-4
     * - Level 7-10: CR 4-7
     * - Level 11-15: CR 7-12
     * - Level 16-20: CR 12-20
     * 
     * @param level - The dungeon level (1-20+)
     * @param count - Number of enemies to generate (default: 1-3 based on level)
     * @returns A promise that resolves to an array of Enemy objects appropriate for the level
     * 
     * @example
     * ```typescript
     * // Get 3 enemies for dungeon level 5
     * const enemies = await MonsterAPI.getMonstersForLevel(5, 3);
     * ```
     */
    static async getMonstersForLevel(level: number, count?: number): Promise<Enemy[]> {
        // Map dungeon level to CR range
        const crRanges: Record<number, [number, number]> = {
            1: [0, 0.5],
            2: [0.25, 1],
            3: [0.5, 2],
            4: [1, 3],
            5: [2, 4],
            6: [2, 5],
            7: [3, 6],
            8: [4, 7],
            9: [4, 8],
            10: [5, 9],
            11: [6, 10],
            12: [7, 11],
            13: [8, 12],
            14: [9, 13],
            15: [10, 14],
            16: [11, 16],
            17: [12, 17],
            18: [13, 18],
            19: [14, 19],
            20: [15, 20]
        };

        const clampedLevel = Math.min(Math.max(level, 1), 20);
        const [minCR, maxCR] = crRanges[clampedLevel];

        const availableMonsters = await this.getMonstersByCRRange(minCR, maxCR);
        
        if (availableMonsters.length === 0) {
            return [];
        }

        // Determine enemy count if not specified
        const enemyCount = count ?? Math.min(1 + Math.floor(level / 5), 4);

        // Select random monsters from the available pool using seeded RNG
        const selected: Enemy[] = [];
        const rng = isRNGInitialized() ? getRNG() : null;
        
        for (let i = 0; i < enemyCount && availableMonsters.length > 0; i++) {
            const randomIndex = rng 
                ? rng.nextInt(0, availableMonsters.length - 1)
                : Math.floor(Math.random() * availableMonsters.length);
            // Create a copy with fresh health values
            const monster = { ...availableMonsters[randomIndex] };
            monster.id = `${monster.id}-${crypto.randomUUID().slice(0, 8)}`;
            selected.push(monster);
        }

        return selected;
    }
}
