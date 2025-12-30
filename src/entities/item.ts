/**
 * @fileoverview Item System for Dungeon Roguelike
 * 
 * This module defines the core item types, interfaces, and utility functions
 * for the game's item system. Items include:
 * - Weapons: Deal damage with various effects
 * - Armor: Provide defense and stat bonuses
 * - Accessories: Rings, amulets, boots with various effects
 * - Consumables: Potions and elixirs for healing/buffs
 * - Treasure: Gold and gems for selling
 * 
 * @module entities/item
 */

/**
 * Item types/categories.
 * @enum {string}
 */
export enum ItemType {
    /** Weapons for dealing damage */
    WEAPON = 'weapon',
    /** Armor for defense */
    ARMOR = 'armor',
    /** Potions, elixirs, and other one-time use items */
    CONSUMABLE = 'consumable',
    /** Rings, amulets, boots, and other accessories */
    ACCESSORY = 'accessory',
    /** Gold, gems, and other valuables */
    TREASURE = 'treasure'
}

/**
 * Equipment slots for equippable items.
 * @enum {string}
 */
export enum ItemSlot {
    /** Weapon slot (main hand) */
    WEAPON = 'weapon',
    /** Armor slot (body) */
    ARMOR = 'armor',
    /** Accessory slot (ring, amulet, etc.) */
    ACCESSORY = 'accessory',
    /** Consumable items (used from inventory) */
    CONSUMABLE = 'consumable',
    /** Items that cannot be equipped (treasure) */
    NONE = 'none'
}

/**
 * Rarity levels for items.
 * Higher rarity = better stats and effects.
 * @enum {string}
 */
export enum ItemRarity {
    /** Basic items, common drops */
    COMMON = 'common',
    /** Better than common, moderate bonuses */
    UNCOMMON = 'uncommon',
    /** Good items with notable effects */
    RARE = 'rare',
    /** Excellent items with powerful effects */
    VERY_RARE = 'very_rare',
    /** Best items in the game */
    LEGENDARY = 'legendary'
}

/**
 * Damage types for weapons and abilities.
 * @enum {string}
 */
export enum DamageType {
    /** Generic physical damage */
    PHYSICAL = 'physical',
    /** Cutting damage (swords, axes) */
    SLASHING = 'slashing',
    /** Stabbing damage (daggers, spears) */
    PIERCING = 'piercing',
    /** Impact damage (maces, hammers) */
    BLUDGEONING = 'bludgeoning',
    /** Arcane/magical damage */
    MAGIC = 'magic',
    /** Fire elemental damage */
    FIRE = 'fire',
    /** Cold/ice elemental damage */
    ICE = 'ice',
    /** Electric elemental damage */
    LIGHTNING = 'lightning',
    /** Toxic damage */
    POISON = 'poison',
    /** Dark/death magic damage */
    NECROTIC = 'necrotic'
}

/**
 * On-hit effect types that can trigger during attacks.
 * @enum {string}
 */
export enum OnHitEffectType {
    /** Apply poison DOT */
    POISON = 'poison',
    /** Apply burning DOT */
    BURN = 'burn',
    /** Slow/freeze the target */
    FREEZE = 'freeze',
    /** Heal attacker based on damage */
    LIFESTEAL = 'lifesteal',
    /** Restore mana based on damage */
    MANA_STEAL = 'manaSteal',
    /** Stun the target (skip turn) */
    STUN = 'stun',
    /** Apply bleeding DOT */
    BLEED = 'bleed'
}

/**
 * Stat bonuses that can be applied by items.
 * All properties are optional - items only define bonuses they provide.
 * @interface
 */
export interface StatBonus {
    /** Bonus to maximum health */
    maxHealth?: number;
    /** Bonus to attack power */
    attack?: number;
    /** Bonus to defense */
    defense?: number;
    /** Bonus to current mana (rare) */
    mana?: number;
    /** Bonus to maximum mana */
    maxMana?: number;
    /** Bonus to speed/initiative */
    speed?: number;
    /** Bonus to critical hit chance (percentage points) */
    critChance?: number;
    /** Bonus to critical hit multiplier */
    critMultiplier?: number;
}

/**
 * Ability granted by an item when equipped.
 * @interface
 */
export interface GrantedAbility {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of what the ability does */
    description: string;
    /** Mana cost to use */
    manaCost: number;
    /** Cooldown in turns */
    cooldown: number;
    /** Current cooldown remaining (0 = ready to use) */
    currentCooldown: number;
    /** Damage dealt (if applicable) */
    damage?: number;
    /** Damage type (if applicable) */
    damageType?: DamageType;
    /** Healing provided (if applicable) */
    healing?: number;
    /** Special effect type */
    effect?: string;
    /** Whether this ability hits all enemies */
    isAoe?: boolean;
}

/**
 * On-hit effect that triggers during attacks.
 * @interface
 */
export interface OnHitEffect {
    /** Chance to proc (0-100 percentage) */
    chance: number;
    /** Type of effect */
    type: OnHitEffectType;
    /** Damage/healing value */
    value?: number;
    /** Duration in turns (for DOT/debuff effects) */
    duration?: number;
}

/**
 * Weapon damage configuration.
 * @interface
 */
export interface WeaponDamage {
    /** Dice notation (e.g., "1d8", "2d6") */
    dice: string;
    /** Damage type */
    type: DamageType;
}

/**
 * Consumable effect configuration.
 * @interface
 */
export interface ConsumeEffect {
    /** Healing dice and bonus (e.g., { dice: "2d4", bonus: 2 }) */
    healing?: {
        dice: string;
        bonus: number;
    };
    /** Flat mana restore amount */
    manaRestore?: number;
    /** Duration of temporary buff in turns */
    buffDuration?: number;
    /** Temporary stat buff to apply */
    buff?: StatBonus;
}

/**
 * Unified Item interface representing all item types.
 * 
 * Different item types use different properties:
 * - **Weapons**: damage, twoHandedDamage, weaponProperties, onHit
 * - **Armor**: armorClass, dexBonus, maxDexBonus, strengthRequirement, stealthDisadvantage
 * - **Consumables**: consumeEffect
 * - **Accessories**: bonuses, grantedAbility, onHit
 * - **Treasure**: stackable, quantity
 * 
 * @interface
 */
export interface Item {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Item category */
    type: ItemType;
    /** Equipment slot (or none for treasure) */
    slot: ItemSlot;
    /** Item rarity */
    rarity: ItemRarity;
    /** Gold value for buying/selling */
    value: number;
    /** Weight in pounds */
    weight: number;
    /** Item description */
    description?: string;

    // === Stat Modifiers (applied while equipped) ===

    /** Passive stat bonuses */
    bonuses?: StatBonus;

    // === Active Effects ===

    /** Ability granted by this item */
    grantedAbility?: GrantedAbility;

    /** On-hit effect (primarily for weapons) */
    onHit?: OnHitEffect;

    // === Weapon-Specific ===

    /** Weapon damage dice and type */
    damage?: WeaponDamage;
    /** Two-handed damage (for versatile weapons) */
    twoHandedDamage?: WeaponDamage;
    /** Weapon properties (e.g., "Versatile", "Finesse") */
    weaponProperties?: string[];

    // === Armor-Specific ===

    /** Base armor class */
    armorClass?: number;
    /** Whether dex bonus applies to AC */
    dexBonus?: boolean;
    /** Max dex bonus (for medium armor) */
    maxDexBonus?: number;
    /** Strength requirement to wear */
    strengthRequirement?: number;
    /** Whether armor imposes stealth disadvantage */
    stealthDisadvantage?: boolean;

    // === Consumable-Specific ===

    /** Effect when consumed */
    consumeEffect?: ConsumeEffect;

    // === Treasure-Specific ===

    /** Whether item stacks in inventory */
    stackable?: boolean;
    /** Current stack quantity */
    quantity?: number;
}

import { getRNG, isRNGInitialized, Seed } from '../game/seed';

/**
 * Calculates the average damage from dice notation.
 * Uses the formula: numDice * ((dieSize + 1) / 2) + bonus
 * 
 * @param dice - Dice notation string (e.g., "1d8", "2d6+3")
 * @returns The average damage value, or 0 if notation is invalid
 * 
 * @example
 * ```typescript
 * calculateAverageDamage("1d8")    // returns 4.5
 * calculateAverageDamage("2d6+3")  // returns 10
 * calculateAverageDamage("1d6")    // returns 3.5
 * ```
 */
export function calculateAverageDamage(dice: string): number {
    const match = dice.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);
    if (!match) return 0;

    const numDice = parseInt(match[1], 10);
    const dieSize = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;

    return numDice * ((dieSize + 1) / 2) + bonus;
}

/**
 * Rolls dice using standard dice notation and returns the total.
 * Uses seeded RNG for reproducible results when available.
 * Falls back to Math.random() if RNG not initialized (useful for testing).
 * 
 * @param dice - Dice notation string (e.g., "1d8", "2d6+3")
 * @param rng - Optional Seed instance for deterministic rolls
 * @returns The total rolled value, or 0 if notation is invalid
 * 
 * @example
 * ```typescript
 * rollDice("1d6")     // returns 1-6
 * rollDice("2d6+3")   // returns 5-15
 * rollDice("1d20")    // returns 1-20
 * ```
 */
export function rollDice(dice: string, rng?: Seed): number {
    const match = dice.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);
    if (!match) return 0;

    const numDice = parseInt(match[1], 10);
    const dieSize = parseInt(match[2], 10);
    const bonus = match[3] ? parseInt(match[3], 10) : 0;

    // Use provided RNG, global RNG, or fallback to Math.random
    const random = rng ?? (isRNGInitialized() ? getRNG() : null);

    let total = bonus;
    for (let i = 0; i < numDice; i++) {
        if (random) {
            total += random.nextInt(1, dieSize);
        } else {
            total += Math.floor(Math.random() * dieSize) + 1;
        }
    }

    return total;
}

/**
 * Factory function to create an Item with sensible defaults.
 * Automatically sets the equipment slot based on item type.
 * 
 * @param partial - Partial Item object with required id, name, and type
 * @returns A complete Item object with defaults applied
 * 
 * @example
 * ```typescript
 * const sword = createItem({
 *   id: 'iron-sword',
 *   name: 'Iron Sword',
 *   type: ItemType.WEAPON,
 *   damage: { dice: '1d8', type: DamageType.SLASHING }
 * });
 * 
 * const potion = createItem({
 *   id: 'health-potion',
 *   name: 'Health Potion',
 *   type: ItemType.CONSUMABLE,
 *   consumeEffect: { healing: { dice: '2d4', bonus: 2 } }
 * });
 * ```
 */
export function createItem(partial: Partial<Item> & { id: string; name: string; type: ItemType }): Item {
    const defaults: Omit<Item, 'id' | 'name' | 'type'> = {
        slot: typeToSlot(partial.type),
        rarity: ItemRarity.COMMON,
        value: 0,
        weight: 0
    };

    return { ...defaults, ...partial };
}

/**
 * Maps item type to default equipment slot.
 * 
 * @param type - The item type
 * @returns The default slot for that item type
 * @private
 */
function typeToSlot(type: ItemType): ItemSlot {
    switch (type) {
        case ItemType.WEAPON: return ItemSlot.WEAPON;
        case ItemType.ARMOR: return ItemSlot.ARMOR;
        case ItemType.ACCESSORY: return ItemSlot.ACCESSORY;
        case ItemType.CONSUMABLE: return ItemSlot.CONSUMABLE;
        case ItemType.TREASURE: return ItemSlot.NONE;
        default: return ItemSlot.NONE;
    }
}
