/**
 * @fileoverview Local Monster Fallback Database
 * 
 * Provides a local fallback database of monsters when the D&D 5e API
 * is unavailable. This ensures the game remains playable offline.
 * 
 * @module entities/monsterDatabase
 */

import { Enemy, EnemyType } from './enemy';

/**
 * Monster template for generating enemies.
 */
interface MonsterTemplate {
    id: string;
    name: string;
    health: number;
    attackPower: number;
    defense: number;
    experience: number;
    challengeRating: number;
    type: EnemyType;
    speed: number;
}

/**
 * Local monster database organized by challenge rating.
 * Used as fallback when API is unavailable.
 */
export const LOCAL_MONSTERS: Record<number, MonsterTemplate[]> = {
    0: [
        { id: 'rat', name: 'Giant Rat', health: 7, attackPower: 2, defense: 10, experience: 10, challengeRating: 0, type: EnemyType.BEAST, speed: 30 },
        { id: 'bat', name: 'Giant Bat', health: 5, attackPower: 2, defense: 12, experience: 10, challengeRating: 0, type: EnemyType.BEAST, speed: 60 },
        { id: 'spider', name: 'Giant Spider', health: 4, attackPower: 2, defense: 10, experience: 10, challengeRating: 0, type: EnemyType.BEAST, speed: 30 },
    ],
    0.125: [
        { id: 'bandit', name: 'Bandit', health: 11, attackPower: 3, defense: 12, experience: 25, challengeRating: 0.125, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'cultist', name: 'Cultist', health: 9, attackPower: 2, defense: 12, experience: 25, challengeRating: 0.125, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'kobold', name: 'Kobold', health: 5, attackPower: 4, defense: 12, experience: 25, challengeRating: 0.125, type: EnemyType.HUMANOID, speed: 30 },
    ],
    0.25: [
        { id: 'goblin', name: 'Goblin', health: 7, attackPower: 4, defense: 15, experience: 50, challengeRating: 0.25, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'skeleton', name: 'Skeleton', health: 13, attackPower: 4, defense: 13, experience: 50, challengeRating: 0.25, type: EnemyType.UNDEAD, speed: 30 },
        { id: 'zombie', name: 'Zombie', health: 22, attackPower: 3, defense: 8, experience: 50, challengeRating: 0.25, type: EnemyType.UNDEAD, speed: 20 },
        { id: 'wolf', name: 'Wolf', health: 11, attackPower: 4, defense: 13, experience: 50, challengeRating: 0.25, type: EnemyType.BEAST, speed: 40 },
    ],
    0.5: [
        { id: 'orc', name: 'Orc', health: 15, attackPower: 5, defense: 13, experience: 100, challengeRating: 0.5, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'hobgoblin', name: 'Hobgoblin', health: 11, attackPower: 3, defense: 18, experience: 100, challengeRating: 0.5, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'shadow', name: 'Shadow', health: 16, attackPower: 4, defense: 12, experience: 100, challengeRating: 0.5, type: EnemyType.UNDEAD, speed: 40 },
        { id: 'worg', name: 'Worg', health: 26, attackPower: 5, defense: 13, experience: 100, challengeRating: 0.5, type: EnemyType.MONSTROSITY, speed: 50 },
    ],
    1: [
        { id: 'bugbear', name: 'Bugbear', health: 27, attackPower: 4, defense: 16, experience: 200, challengeRating: 1, type: EnemyType.HUMANOID, speed: 30 },
        { id: 'ghoul', name: 'Ghoul', health: 22, attackPower: 4, defense: 12, experience: 200, challengeRating: 1, type: EnemyType.UNDEAD, speed: 30 },
        { id: 'specter', name: 'Specter', health: 22, attackPower: 4, defense: 12, experience: 200, challengeRating: 1, type: EnemyType.UNDEAD, speed: 50 },
        { id: 'dire-wolf', name: 'Dire Wolf', health: 37, attackPower: 5, defense: 14, experience: 200, challengeRating: 1, type: EnemyType.BEAST, speed: 50 },
    ],
    2: [
        { id: 'ogre', name: 'Ogre', health: 59, attackPower: 6, defense: 11, experience: 450, challengeRating: 2, type: EnemyType.GIANT, speed: 40 },
        { id: 'gargoyle', name: 'Gargoyle', health: 52, attackPower: 4, defense: 15, experience: 450, challengeRating: 2, type: EnemyType.ELEMENTAL, speed: 30 },
        { id: 'ghast', name: 'Ghast', health: 36, attackPower: 5, defense: 13, experience: 450, challengeRating: 2, type: EnemyType.UNDEAD, speed: 30 },
        { id: 'mimic', name: 'Mimic', health: 58, attackPower: 5, defense: 12, experience: 450, challengeRating: 2, type: EnemyType.MONSTROSITY, speed: 15 },
    ],
    3: [
        { id: 'owlbear', name: 'Owlbear', health: 59, attackPower: 7, defense: 13, experience: 700, challengeRating: 3, type: EnemyType.MONSTROSITY, speed: 40 },
        { id: 'mummy', name: 'Mummy', health: 58, attackPower: 5, defense: 11, experience: 700, challengeRating: 3, type: EnemyType.UNDEAD, speed: 20 },
        { id: 'werewolf', name: 'Werewolf', health: 58, attackPower: 4, defense: 12, experience: 700, challengeRating: 3, type: EnemyType.HUMANOID, speed: 40 },
        { id: 'hell-hound', name: 'Hell Hound', health: 45, attackPower: 5, defense: 15, experience: 700, challengeRating: 3, type: EnemyType.FIEND, speed: 50 },
    ],
    4: [
        { id: 'ettin', name: 'Ettin', health: 85, attackPower: 7, defense: 12, experience: 1100, challengeRating: 4, type: EnemyType.GIANT, speed: 40 },
        { id: 'ghost', name: 'Ghost', health: 45, attackPower: 5, defense: 11, experience: 1100, challengeRating: 4, type: EnemyType.UNDEAD, speed: 40 },
        { id: 'flameskull', name: 'Flameskull', health: 40, attackPower: 5, defense: 13, experience: 1100, challengeRating: 4, type: EnemyType.UNDEAD, speed: 40 },
    ],
    5: [
        { id: 'troll', name: 'Troll', health: 84, attackPower: 7, defense: 15, experience: 1800, challengeRating: 5, type: EnemyType.GIANT, speed: 30 },
        { id: 'wraith', name: 'Wraith', health: 67, attackPower: 6, defense: 13, experience: 1800, challengeRating: 5, type: EnemyType.UNDEAD, speed: 60 },
        { id: 'salamander', name: 'Salamander', health: 90, attackPower: 7, defense: 15, experience: 1800, challengeRating: 5, type: EnemyType.ELEMENTAL, speed: 30 },
    ],
    6: [
        { id: 'chimera', name: 'Chimera', health: 114, attackPower: 6, defense: 14, experience: 2300, challengeRating: 6, type: EnemyType.MONSTROSITY, speed: 30 },
        { id: 'cyclops', name: 'Cyclops', health: 138, attackPower: 9, defense: 14, experience: 2300, challengeRating: 6, type: EnemyType.GIANT, speed: 30 },
        { id: 'wyvern', name: 'Wyvern', health: 110, attackPower: 7, defense: 13, experience: 2300, challengeRating: 6, type: EnemyType.DRAGON, speed: 80 },
    ],
    7: [
        { id: 'stone-giant', name: 'Stone Giant', health: 126, attackPower: 9, defense: 17, experience: 2900, challengeRating: 7, type: EnemyType.GIANT, speed: 40 },
        { id: 'oni', name: 'Oni', health: 110, attackPower: 7, defense: 16, experience: 2900, challengeRating: 7, type: EnemyType.GIANT, speed: 30 },
    ],
    8: [
        { id: 'frost-giant', name: 'Frost Giant', health: 138, attackPower: 8, defense: 15, experience: 3900, challengeRating: 8, type: EnemyType.GIANT, speed: 40 },
        { id: 'hydra', name: 'Hydra', health: 172, attackPower: 8, defense: 15, experience: 3900, challengeRating: 8, type: EnemyType.MONSTROSITY, speed: 30 },
    ],
    9: [
        { id: 'fire-giant', name: 'Fire Giant', health: 162, attackPower: 11, defense: 18, experience: 5000, challengeRating: 9, type: EnemyType.GIANT, speed: 30 },
        { id: 'treant', name: 'Treant', health: 138, attackPower: 6, defense: 16, experience: 5000, challengeRating: 9, type: EnemyType.PLANT, speed: 30 },
    ],
    10: [
        { id: 'aboleth', name: 'Aboleth', health: 135, attackPower: 9, defense: 17, experience: 5900, challengeRating: 10, type: EnemyType.ABERRATION, speed: 40 },
        { id: 'stone-golem', name: 'Stone Golem', health: 178, attackPower: 10, defense: 17, experience: 5900, challengeRating: 10, type: EnemyType.CONSTRUCT, speed: 30 },
    ],
    11: [
        { id: 'remorhaz', name: 'Remorhaz', health: 195, attackPower: 11, defense: 17, experience: 7200, challengeRating: 11, type: EnemyType.MONSTROSITY, speed: 30 },
        { id: 'behir', name: 'Behir', health: 168, attackPower: 10, defense: 17, experience: 7200, challengeRating: 11, type: EnemyType.MONSTROSITY, speed: 50 },
    ],
    12: [
        { id: 'archmage', name: 'Archmage', health: 99, attackPower: 6, defense: 12, experience: 8400, challengeRating: 12, type: EnemyType.HUMANOID, speed: 30 },
    ],
    13: [
        { id: 'beholder', name: 'Beholder', health: 180, attackPower: 4, defense: 18, experience: 10000, challengeRating: 13, type: EnemyType.ABERRATION, speed: 20 },
        { id: 'adult-white-dragon', name: 'Adult White Dragon', health: 200, attackPower: 11, defense: 18, experience: 10000, challengeRating: 13, type: EnemyType.DRAGON, speed: 80 },
    ],
    14: [
        { id: 'adult-black-dragon', name: 'Adult Black Dragon', health: 195, attackPower: 11, defense: 19, experience: 11500, challengeRating: 14, type: EnemyType.DRAGON, speed: 80 },
    ],
    15: [
        { id: 'adult-green-dragon', name: 'Adult Green Dragon', health: 207, attackPower: 11, defense: 19, experience: 13000, challengeRating: 15, type: EnemyType.DRAGON, speed: 80 },
        { id: 'purple-worm', name: 'Purple Worm', health: 247, attackPower: 14, defense: 18, experience: 13000, challengeRating: 15, type: EnemyType.MONSTROSITY, speed: 50 },
    ],
    16: [
        { id: 'adult-blue-dragon', name: 'Adult Blue Dragon', health: 225, attackPower: 12, defense: 19, experience: 15000, challengeRating: 16, type: EnemyType.DRAGON, speed: 80 },
        { id: 'iron-golem', name: 'Iron Golem', health: 210, attackPower: 14, defense: 20, experience: 15000, challengeRating: 16, type: EnemyType.CONSTRUCT, speed: 30 },
    ],
    17: [
        { id: 'adult-red-dragon', name: 'Adult Red Dragon', health: 256, attackPower: 14, defense: 19, experience: 18000, challengeRating: 17, type: EnemyType.DRAGON, speed: 80 },
        { id: 'death-knight', name: 'Death Knight', health: 180, attackPower: 11, defense: 20, experience: 18000, challengeRating: 17, type: EnemyType.UNDEAD, speed: 30 },
    ],
    18: [
        { id: 'demilich', name: 'Demilich', health: 80, attackPower: 6, defense: 20, experience: 20000, challengeRating: 18, type: EnemyType.UNDEAD, speed: 30 },
    ],
    19: [
        { id: 'balor', name: 'Balor', health: 262, attackPower: 14, defense: 19, experience: 22000, challengeRating: 19, type: EnemyType.FIEND, speed: 40 },
    ],
    20: [
        { id: 'ancient-white-dragon', name: 'Ancient White Dragon', health: 333, attackPower: 14, defense: 20, experience: 25000, challengeRating: 20, type: EnemyType.DRAGON, speed: 80 },
        { id: 'pit-fiend', name: 'Pit Fiend', health: 300, attackPower: 14, defense: 19, experience: 25000, challengeRating: 20, type: EnemyType.FIEND, speed: 30 },
    ],
};

/**
 * Gets local monsters by challenge rating.
 * 
 * @param cr - The challenge rating to filter by
 * @returns Array of monster templates matching the CR
 */
export function getLocalMonstersByCR(cr: number): MonsterTemplate[] {
    return LOCAL_MONSTERS[cr] ?? [];
}

/**
 * Gets all available challenge ratings in the local database.
 * 
 * @returns Array of CR values
 */
export function getAvailableCRs(): number[] {
    return Object.keys(LOCAL_MONSTERS).map(Number).sort((a, b) => a - b);
}

/**
 * Creates an Enemy instance from a monster template.
 * 
 * @param template - The monster template
 * @returns A new Enemy instance with unique ID
 */
export function createEnemyFromTemplate(template: MonsterTemplate): Enemy {
    return {
        ...template,
        id: `${template.id}-${crypto.randomUUID().slice(0, 8)}`,
        maxHealth: template.health,
    };
}

/**
 * Gets random local monsters by CR.
 * 
 * @param cr - The challenge rating
 * @param count - Number of monsters to get
 * @param rng - Optional seeded RNG function
 * @returns Array of Enemy instances
 */
export function getRandomLocalMonsters(
    cr: number, 
    count: number = 1, 
    rng?: { nextInt: (min: number, max: number) => number }
): Enemy[] {
    const templates = getLocalMonstersByCR(cr);
    if (templates.length === 0) {
        // Find nearest CR if exact match not found
        const availableCRs = getAvailableCRs();
        const nearestCR = availableCRs.reduce((prev, curr) => 
            Math.abs(curr - cr) < Math.abs(prev - cr) ? curr : prev
        );
        const nearestTemplates = getLocalMonstersByCR(nearestCR);
        if (nearestTemplates.length === 0) return [];
        return selectRandomTemplates(nearestTemplates, count, rng);
    }
    return selectRandomTemplates(templates, count, rng);
}

/**
 * Selects random templates and converts them to enemies.
 */
function selectRandomTemplates(
    templates: MonsterTemplate[], 
    count: number,
    rng?: { nextInt: (min: number, max: number) => number }
): Enemy[] {
    const enemies: Enemy[] = [];
    for (let i = 0; i < count && templates.length > 0; i++) {
        const index = rng 
            ? rng.nextInt(0, templates.length - 1)
            : Math.floor(Math.random() * templates.length);
        enemies.push(createEnemyFromTemplate(templates[index]));
    }
    return enemies;
}

