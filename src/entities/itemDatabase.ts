/**
 * @fileoverview Item Database for Dungeon Roguelike
 * 
 * This module contains all predefined items in the game, organized by type:
 * - WEAPONS: From common daggers to legendary Soul Reaver
 * - ARMOR: From leather armor to Armor of Invulnerability
 * - ACCESSORIES: Rings, amulets, boots, cloaks, belts
 * - CONSUMABLES: Healing potions, mana potions, buff elixirs
 * - TREASURE: Gold coins and gemstones
 * 
 * Also provides utility functions for:
 * - Looking up items by ID or type
 * - Generating random loot based on dungeon level
 * - Cloning items for inventory management
 * 
 * @module entities/itemDatabase
 */

import {
    Item,
    ItemType,
    ItemSlot,
    ItemRarity,
    DamageType,
    OnHitEffectType,
    createItem
} from './item';
import { getRNG, isRNGInitialized, Seed } from '../game/seed';

// ============================================================================
// WEAPONS
// ============================================================================

/**
 * All weapon items available in the game.
 * 
 * Weapons are organized by rarity:
 * - **Common**: Dagger, Shortsword, Longsword, Greataxe, Staff
 * - **Uncommon**: Silver Sword, Vampiric Dagger, Arcane Staff
 * - **Rare**: Flame Tongue, Frost Brand, Staff of Power
 * - **Very Rare**: Vorpal Sword, Staff of the Magi
 * - **Legendary**: Soul Reaver
 * 
 * @const
 */
export const WEAPONS: Item[] = [
    // === Common Weapons ===
    createItem({
        id: 'dagger',
        name: 'Dagger',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        value: 2,
        weight: 1,
        description: 'A simple dagger, quick but weak.',
        damage: { dice: '1d4', type: DamageType.PIERCING },
        weaponProperties: ['Finesse', 'Light', 'Thrown'],
        bonuses: { speed: 2 }
    }),
    createItem({
        id: 'shortsword',
        name: 'Shortsword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        value: 10,
        weight: 2,
        description: 'A reliable short blade.',
        damage: { dice: '1d6', type: DamageType.SLASHING },
        weaponProperties: ['Finesse', 'Light']
    }),
    createItem({
        id: 'longsword',
        name: 'Longsword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        value: 15,
        weight: 3,
        description: 'A versatile blade favored by fighters.',
        damage: { dice: '1d8', type: DamageType.SLASHING },
        twoHandedDamage: { dice: '1d10', type: DamageType.SLASHING },
        weaponProperties: ['Versatile']
    }),
    createItem({
        id: 'greataxe',
        name: 'Greataxe',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        value: 30,
        weight: 7,
        description: 'A massive axe requiring two hands.',
        damage: { dice: '1d12', type: DamageType.SLASHING },
        weaponProperties: ['Heavy', 'Two-Handed'],
        bonuses: { attack: 1 }
    }),
    createItem({
        id: 'staff',
        name: 'Wooden Staff',
        type: ItemType.WEAPON,
        rarity: ItemRarity.COMMON,
        value: 5,
        weight: 4,
        description: 'A simple wooden staff, good for channeling magic.',
        damage: { dice: '1d6', type: DamageType.BLUDGEONING },
        weaponProperties: ['Versatile'],
        bonuses: { maxMana: 10 }
    }),

    // === Uncommon Weapons ===
    createItem({
        id: 'silver-sword',
        name: 'Silver Sword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        weight: 3,
        description: 'A blade of pure silver, effective against undead.',
        damage: { dice: '1d8', type: DamageType.SLASHING },
        bonuses: { attack: 2 }
    }),
    createItem({
        id: 'vampiric-dagger',
        name: 'Vampiric Dagger',
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        value: 150,
        weight: 1,
        description: 'A cursed blade that drains life from enemies.',
        damage: { dice: '1d4', type: DamageType.PIERCING },
        onHit: {
            chance: 25,
            type: OnHitEffectType.LIFESTEAL,
            value: 5
        },
        bonuses: { speed: 2 }
    }),
    createItem({
        id: 'arcane-staff',
        name: 'Arcane Staff',
        type: ItemType.WEAPON,
        rarity: ItemRarity.UNCOMMON,
        value: 200,
        weight: 4,
        description: 'A staff imbued with arcane energy.',
        damage: { dice: '1d6', type: DamageType.MAGIC },
        bonuses: { maxMana: 25, critChance: 3 }
    }),

    // === Rare Weapons ===
    createItem({
        id: 'flame-tongue',
        name: 'Flame Tongue',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        value: 500,
        weight: 3,
        description: 'A sword wreathed in magical flames.',
        damage: { dice: '1d8', type: DamageType.SLASHING },
        onHit: {
            chance: 100,
            type: OnHitEffectType.BURN,
            value: 5,
            duration: 2
        },
        bonuses: { attack: 3 }
    }),
    createItem({
        id: 'frost-brand',
        name: 'Frost Brand',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        value: 500,
        weight: 3,
        description: 'A blade of eternal ice that chills enemies to the bone.',
        damage: { dice: '1d8', type: DamageType.SLASHING },
        onHit: {
            chance: 30,
            type: OnHitEffectType.FREEZE,
            duration: 1
        },
        bonuses: { attack: 2, defense: 2 }
    }),
    createItem({
        id: 'staff-of-power',
        name: 'Staff of Power',
        type: ItemType.WEAPON,
        rarity: ItemRarity.RARE,
        value: 750,
        weight: 4,
        description: 'A powerful staff crackling with arcane energy.',
        damage: { dice: '1d8', type: DamageType.MAGIC },
        bonuses: { maxMana: 50, attack: 2, critMultiplier: 0.25 },
        grantedAbility: {
            id: 'arcane-burst',
            name: 'Arcane Burst',
            description: 'Release a burst of arcane energy dealing damage to all enemies.',
            manaCost: 25,
            cooldown: 4,
            damage: 20,
            damageType: DamageType.MAGIC,
            isAoe: true
        }
    }),

    // === Very Rare Weapons ===
    createItem({
        id: 'vorpal-sword',
        name: 'Vorpal Sword',
        type: ItemType.WEAPON,
        rarity: ItemRarity.VERY_RARE,
        value: 2000,
        weight: 3,
        description: 'A legendary blade that can sever heads with a single strike.',
        damage: { dice: '2d6', type: DamageType.SLASHING },
        bonuses: { attack: 5, critChance: 10, critMultiplier: 0.5 }
    }),
    createItem({
        id: 'staff-of-the-magi',
        name: 'Staff of the Magi',
        type: ItemType.WEAPON,
        rarity: ItemRarity.VERY_RARE,
        value: 2500,
        weight: 4,
        description: 'The ultimate staff for any spellcaster.',
        damage: { dice: '1d10', type: DamageType.MAGIC },
        bonuses: { maxMana: 100, attack: 4, maxHealth: 20 },
        grantedAbility: {
            id: 'spell-absorption',
            name: 'Spell Absorption',
            description: 'Absorb incoming magic damage and convert it to mana.',
            manaCost: 0,
            cooldown: 5,
            effect: 'magic_immunity'
        }
    }),

    // === Legendary Weapons ===
    createItem({
        id: 'soul-reaver',
        name: 'Soul Reaver',
        type: ItemType.WEAPON,
        rarity: ItemRarity.LEGENDARY,
        value: 10000,
        weight: 4,
        description: 'A blade forged from the souls of fallen warriors.',
        damage: { dice: '2d8', type: DamageType.NECROTIC },
        onHit: {
            chance: 50,
            type: OnHitEffectType.LIFESTEAL,
            value: 15
        },
        bonuses: { attack: 8, maxHealth: 30, critChance: 15 },
        grantedAbility: {
            id: 'soul-drain',
            name: 'Soul Drain',
            description: 'Drain the soul of an enemy, dealing massive damage and healing yourself.',
            manaCost: 40,
            cooldown: 6,
            damage: 50,
            damageType: DamageType.NECROTIC,
            healing: 25
        }
    })
];

// ============================================================================
// ARMOR
// ============================================================================

/**
 * All armor items available in the game.
 * 
 * Armor is organized by rarity:
 * - **Common**: Leather Armor, Chain Shirt, Chain Mail, Robes
 * - **Uncommon**: Scale Mail +1, Mithral Chain, Arcane Robes
 * - **Rare**: Plate of Fortitude, Shadow Leather, Robes of the Archmagi
 * - **Legendary**: Armor of Invulnerability
 * 
 * @const
 */
export const ARMOR: Item[] = [
    // === Common Armor ===
    createItem({
        id: 'leather-armor',
        name: 'Leather Armor',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        value: 10,
        weight: 10,
        description: 'Light armor made of leather.',
        armorClass: 11,
        dexBonus: true
    }),
    createItem({
        id: 'chain-shirt',
        name: 'Chain Shirt',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 20,
        description: 'A shirt of interlocking metal rings.',
        armorClass: 13,
        dexBonus: true,
        maxDexBonus: 2
    }),
    createItem({
        id: 'chain-mail',
        name: 'Chain Mail',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        value: 75,
        weight: 55,
        description: 'Heavy armor of interlocking metal rings.',
        armorClass: 16,
        dexBonus: false,
        strengthRequirement: 13,
        stealthDisadvantage: true
    }),
    createItem({
        id: 'robes',
        name: 'Cloth Robes',
        type: ItemType.ARMOR,
        rarity: ItemRarity.COMMON,
        value: 5,
        weight: 3,
        description: 'Simple cloth robes, offering little protection.',
        armorClass: 10,
        dexBonus: true,
        bonuses: { maxMana: 15 }
    }),

    // === Uncommon Armor ===
    createItem({
        id: 'scale-mail-plus',
        name: 'Scale Mail +1',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        value: 200,
        weight: 45,
        description: 'Enchanted scale armor providing extra protection.',
        armorClass: 15,
        dexBonus: true,
        maxDexBonus: 2,
        bonuses: { defense: 1 }
    }),
    createItem({
        id: 'mithral-chain',
        name: 'Mithral Chain Shirt',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        value: 300,
        weight: 10,
        description: 'Lightweight chain made of mithral.',
        armorClass: 13,
        dexBonus: true,
        bonuses: { speed: 5 }
    }),
    createItem({
        id: 'arcane-robes',
        name: 'Arcane Robes',
        type: ItemType.ARMOR,
        rarity: ItemRarity.UNCOMMON,
        value: 250,
        weight: 3,
        description: 'Robes woven with arcane threads.',
        armorClass: 11,
        dexBonus: true,
        bonuses: { maxMana: 30, critChance: 2 }
    }),

    // === Rare Armor ===
    createItem({
        id: 'plate-of-fortitude',
        name: 'Plate of Fortitude',
        type: ItemType.ARMOR,
        rarity: ItemRarity.RARE,
        value: 1500,
        weight: 65,
        description: 'Heavy plate armor that bolsters the wearer\'s vitality.',
        armorClass: 18,
        dexBonus: false,
        strengthRequirement: 15,
        stealthDisadvantage: true,
        bonuses: { maxHealth: 30, defense: 3 }
    }),
    createItem({
        id: 'shadow-leather',
        name: 'Shadow Leather',
        type: ItemType.ARMOR,
        rarity: ItemRarity.RARE,
        value: 800,
        weight: 8,
        description: 'Armor that seems to absorb light.',
        armorClass: 13,
        dexBonus: true,
        bonuses: { speed: 10, critChance: 5 }
    }),
    createItem({
        id: 'robes-of-the-archmagi',
        name: 'Robes of the Archmagi',
        type: ItemType.ARMOR,
        rarity: ItemRarity.RARE,
        value: 1000,
        weight: 3,
        description: 'Legendary robes worn by powerful mages.',
        armorClass: 13,
        dexBonus: true,
        bonuses: { maxMana: 50, defense: 2, critMultiplier: 0.2 }
    }),

    // === Legendary Armor ===
    createItem({
        id: 'armor-of-invulnerability',
        name: 'Armor of Invulnerability',
        type: ItemType.ARMOR,
        rarity: ItemRarity.LEGENDARY,
        value: 15000,
        weight: 65,
        description: 'Legendary armor that renders the wearer nearly invincible.',
        armorClass: 20,
        dexBonus: false,
        strengthRequirement: 15,
        bonuses: { maxHealth: 50, defense: 10 },
        grantedAbility: {
            id: 'invulnerability',
            name: 'Invulnerability',
            description: 'Become immune to all damage for 1 turn.',
            manaCost: 50,
            cooldown: 10,
            effect: 'invulnerable'
        }
    })
];

// ============================================================================
// ACCESSORIES
// ============================================================================

/**
 * All accessory items available in the game.
 * Includes rings, amulets, boots, cloaks, and belts.
 * 
 * Accessories are organized by rarity:
 * - **Common**: Ring of Protection, Amulet of Health, Ring of Mana
 * - **Uncommon**: Boots of Speed, Cloak of Protection, Ring of Precision
 * - **Rare**: Amulet of Fireball, Ring of Vampirism, Belt of Giant Strength
 * - **Legendary**: Ring of Three Wishes
 * 
 * @const
 */
export const ACCESSORIES: Item[] = [
    // === Common Accessories ===
    createItem({
        id: 'ring-of-protection',
        name: 'Ring of Protection',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 0,
        description: 'A simple ring that offers minor protection.',
        bonuses: { defense: 1 }
    }),
    createItem({
        id: 'amulet-of-health',
        name: 'Amulet of Health',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 0,
        description: 'An amulet that bolsters vitality.',
        bonuses: { maxHealth: 10 }
    }),
    createItem({
        id: 'ring-of-mana',
        name: 'Ring of Mana',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 0,
        description: 'A ring that expands the wearer\'s mana pool.',
        bonuses: { maxMana: 15 }
    }),

    // === Uncommon Accessories ===
    createItem({
        id: 'boots-of-speed',
        name: 'Boots of Speed',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.UNCOMMON,
        value: 200,
        weight: 1,
        description: 'Enchanted boots that quicken the wearer.',
        bonuses: { speed: 10 }
    }),
    createItem({
        id: 'cloak-of-protection',
        name: 'Cloak of Protection',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.UNCOMMON,
        value: 250,
        weight: 1,
        description: 'A magical cloak that deflects attacks.',
        bonuses: { defense: 2, maxHealth: 10 }
    }),
    createItem({
        id: 'ring-of-precision',
        name: 'Ring of Precision',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.UNCOMMON,
        value: 200,
        weight: 0,
        description: 'A ring that sharpens the wearer\'s strikes.',
        bonuses: { critChance: 5, attack: 1 }
    }),

    // === Rare Accessories ===
    createItem({
        id: 'amulet-of-fireball',
        name: 'Amulet of Fireball',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.RARE,
        value: 1000,
        weight: 0,
        description: 'An amulet that grants the power to cast Fireball.',
        bonuses: { maxMana: 20 },
        grantedAbility: {
            id: 'fireball',
            name: 'Fireball',
            description: 'Hurl a ball of fire at all enemies.',
            manaCost: 30,
            cooldown: 5,
            damage: 30,
            damageType: DamageType.FIRE,
            isAoe: true
        }
    }),
    createItem({
        id: 'ring-of-vampirism',
        name: 'Ring of Vampirism',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.RARE,
        value: 800,
        weight: 0,
        description: 'A cursed ring that drains life with each attack.',
        onHit: {
            chance: 20,
            type: OnHitEffectType.LIFESTEAL,
            value: 10
        },
        bonuses: { attack: 2 }
    }),
    createItem({
        id: 'belt-of-giant-strength',
        name: 'Belt of Giant Strength',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.RARE,
        value: 1200,
        weight: 1,
        description: 'A belt that grants the strength of a giant.',
        bonuses: { attack: 5, maxHealth: 20 }
    }),

    // === Legendary Accessories ===
    createItem({
        id: 'ring-of-three-wishes',
        name: 'Ring of Three Wishes',
        type: ItemType.ACCESSORY,
        rarity: ItemRarity.LEGENDARY,
        value: 50000,
        weight: 0,
        description: 'A legendary ring containing three powerful wishes.',
        bonuses: { maxHealth: 30, maxMana: 30, attack: 3, defense: 3 },
        grantedAbility: {
            id: 'wish',
            name: 'Wish',
            description: 'Fully restore health and mana, and reset all cooldowns.',
            manaCost: 0,
            cooldown: 99, // Essentially once per dungeon
            healing: 999,
            effect: 'full_restore'
        }
    })
];

// ============================================================================
// CONSUMABLES
// ============================================================================

/**
 * All consumable items available in the game.
 * Includes healing potions, mana potions, and buff elixirs.
 * 
 * Consumables are organized by effect:
 * - **Healing**: Potion of Healing, Greater Healing, Superior Healing
 * - **Mana**: Potion of Mana, Greater Mana
 * - **Buffs**: Potion of Strength, Iron Skin, Elixir of Heroism
 * 
 * @const
 */
export const CONSUMABLES: Item[] = [
    // === Healing Potions ===
    createItem({
        id: 'potion-of-healing',
        name: 'Potion of Healing',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 0.5,
        description: 'A red potion that restores health.',
        consumeEffect: {
            healing: { dice: '2d4', bonus: 2 }
        }
    }),
    createItem({
        id: 'potion-of-greater-healing',
        name: 'Potion of Greater Healing',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        weight: 0.5,
        description: 'A vibrant red potion that restores significant health.',
        consumeEffect: {
            healing: { dice: '4d4', bonus: 4 }
        }
    }),
    createItem({
        id: 'potion-of-superior-healing',
        name: 'Potion of Superior Healing',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.RARE,
        value: 500,
        weight: 0.5,
        description: 'A brilliant red potion that restores great health.',
        consumeEffect: {
            healing: { dice: '8d4', bonus: 8 }
        }
    }),

    // === Mana Potions ===
    createItem({
        id: 'potion-of-mana',
        name: 'Potion of Mana',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.COMMON,
        value: 50,
        weight: 0.5,
        description: 'A blue potion that restores mana.',
        consumeEffect: {
            manaRestore: 25
        }
    }),
    createItem({
        id: 'potion-of-greater-mana',
        name: 'Potion of Greater Mana',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        weight: 0.5,
        description: 'A vibrant blue potion that restores significant mana.',
        consumeEffect: {
            manaRestore: 50
        }
    }),

    // === Buff Potions ===
    createItem({
        id: 'potion-of-strength',
        name: 'Potion of Strength',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        value: 150,
        weight: 0.5,
        description: 'A potion that temporarily increases attack power.',
        consumeEffect: {
            buffDuration: 5,
            buff: { attack: 5 }
        }
    }),
    createItem({
        id: 'potion-of-iron-skin',
        name: 'Potion of Iron Skin',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.UNCOMMON,
        value: 150,
        weight: 0.5,
        description: 'A potion that temporarily increases defense.',
        consumeEffect: {
            buffDuration: 5,
            buff: { defense: 5 }
        }
    }),
    createItem({
        id: 'elixir-of-heroism',
        name: 'Elixir of Heroism',
        type: ItemType.CONSUMABLE,
        rarity: ItemRarity.RARE,
        value: 500,
        weight: 0.5,
        description: 'A powerful elixir that enhances all abilities.',
        consumeEffect: {
            buffDuration: 3,
            buff: { attack: 5, defense: 3, critChance: 10, speed: 5 }
        }
    })
];

// ============================================================================
// TREASURE
// ============================================================================

/**
 * All treasure items available in the game.
 * Includes gold coins and gemstones of various values.
 * 
 * @const
 */
export const TREASURE: Item[] = [
    createItem({
        id: 'gold-coins',
        name: 'Gold Coins',
        type: ItemType.TREASURE,
        slot: ItemSlot.NONE,
        rarity: ItemRarity.COMMON,
        value: 1,
        weight: 0.02,
        description: 'Shiny gold coins.',
        stackable: true,
        quantity: 1
    }),
    createItem({
        id: 'ruby',
        name: 'Ruby',
        type: ItemType.TREASURE,
        slot: ItemSlot.NONE,
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        weight: 0,
        description: 'A brilliant red gemstone.'
    }),
    createItem({
        id: 'sapphire',
        name: 'Sapphire',
        type: ItemType.TREASURE,
        slot: ItemSlot.NONE,
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        weight: 0,
        description: 'A deep blue gemstone.'
    }),
    createItem({
        id: 'emerald',
        name: 'Emerald',
        type: ItemType.TREASURE,
        slot: ItemSlot.NONE,
        rarity: ItemRarity.RARE,
        value: 500,
        weight: 0,
        description: 'A vivid green gemstone.'
    }),
    createItem({
        id: 'diamond',
        name: 'Diamond',
        type: ItemType.TREASURE,
        slot: ItemSlot.NONE,
        rarity: ItemRarity.VERY_RARE,
        value: 1000,
        weight: 0,
        description: 'A flawless diamond.'
    })
];

// ============================================================================
// ITEM DATABASE ACCESS
// ============================================================================

/**
 * All items in the game combined into a single array.
 * @const
 */
export const ALL_ITEMS: Item[] = [
    ...WEAPONS,
    ...ARMOR,
    ...ACCESSORIES,
    ...CONSUMABLES,
    ...TREASURE
];

/**
 * Retrieves an item from the database by its unique identifier.
 * 
 * @param id - The unique item ID to search for
 * @returns The matching Item, or undefined if not found
 * 
 * @example
 * ```typescript
 * const sword = getItemById('longsword');
 * const potion = getItemById('potion-of-healing');
 * ```
 */
export function getItemById(id: string): Item | undefined {
    return ALL_ITEMS.find(item => item.id === id);
}

/**
 * Retrieves all items of a specific type from the database.
 * 
 * @param type - The ItemType to filter by (WEAPON, ARMOR, CONSUMABLE, etc.)
 * @returns Array of items matching the specified type
 * 
 * @example
 * ```typescript
 * const weapons = getItemsByType(ItemType.WEAPON);
 * const potions = getItemsByType(ItemType.CONSUMABLE);
 * ```
 */
export function getItemsByType(type: ItemType): Item[] {
    return ALL_ITEMS.filter(item => item.type === type);
}

/**
 * Retrieves all items of a specific rarity from the database.
 * 
 * @param rarity - The ItemRarity to filter by (COMMON, UNCOMMON, RARE, etc.)
 * @returns Array of items matching the specified rarity
 * 
 * @example
 * ```typescript
 * const legendaryItems = getItemsByRarity(ItemRarity.LEGENDARY);
 * ```
 */
export function getItemsByRarity(rarity: ItemRarity): Item[] {
    return ALL_ITEMS.filter(item => item.rarity === rarity);
}

/**
 * Selects a random item from the database with optional filtering.
 * Items are weighted by rarity (common items are more likely to be selected).
 * Uses seeded RNG for reproducible results when available.
 * 
 * **Rarity weights:**
 * - Common: 10x
 * - Uncommon: 5x
 * - Rare: 2x
 * - Very Rare: 1x
 * - Legendary: 0.5x
 * 
 * @param type - Optional ItemType to filter by
 * @param maxRarity - Optional maximum rarity (items above this rarity are excluded)
 * @param rng - Optional Seed instance for deterministic selection
 * @returns A randomly selected Item from the filtered pool
 * 
 * @example
 * ```typescript
 * // Random item of any type
 * const item = getRandomItem();
 * 
 * // Random weapon up to rare rarity
 * const weapon = getRandomItem(ItemType.WEAPON, ItemRarity.RARE);
 * ```
 */
export function getRandomItem(type?: ItemType, maxRarity?: ItemRarity, rng?: Seed): Item {
    // Use provided RNG, global RNG, or fallback
    const random = rng ?? (isRNGInitialized() ? getRNG() : null);
    
    let pool = ALL_ITEMS;

    if (type) {
        pool = pool.filter(item => item.type === type);
    }

    if (maxRarity) {
        const rarityOrder = [
            ItemRarity.COMMON,
            ItemRarity.UNCOMMON,
            ItemRarity.RARE,
            ItemRarity.VERY_RARE,
            ItemRarity.LEGENDARY
        ];
        const maxIndex = rarityOrder.indexOf(maxRarity);
        pool = pool.filter(item => rarityOrder.indexOf(item.rarity) <= maxIndex);
    }

    // Weight by rarity (common items more likely)
    const weighted: Item[] = [];
    for (const item of pool) {
        const weight = item.rarity === ItemRarity.COMMON ? 10
            : item.rarity === ItemRarity.UNCOMMON ? 5
            : item.rarity === ItemRarity.RARE ? 2
            : item.rarity === ItemRarity.VERY_RARE ? 1
            : 0.5; // Legendary

        for (let i = 0; i < weight; i++) {
            weighted.push(item);
        }
    }

    if (random) {
        return random.choice(weighted);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
}

/**
 * Generates random loot appropriate for a given dungeon level.
 * Higher levels unlock higher rarity items and increase equipment drop chance.
 * Always includes at least one consumable item.
 * Uses seeded RNG for reproducible results when available.
 * 
 * **Level to max rarity mapping:**
 * - Levels 1-2: Common
 * - Levels 3-4: Uncommon
 * - Levels 5-9: Rare
 * - Levels 10-14: Very Rare
 * - Levels 15+: Legendary
 * 
 * **Equipment drop chance:**
 * Base 30% + 3% per level (e.g., level 10 = 60% chance)
 * 
 * @param level - The dungeon level (1-20+) determining loot quality
 * @param rng - Optional Seed instance for deterministic generation
 * @returns Array of Item objects appropriate for the level
 * 
 * @example
 * ```typescript
 * // Generate loot for dungeon level 5
 * const loot = generateLootForLevel(5);
 * 
 * // Generate deterministic loot
 * const rng = new Seed('my-seed');
 * const loot = generateLootForLevel(10, rng);
 * ```
 */
export function generateLootForLevel(level: number, rng?: Seed, guaranteeEquipment: boolean = false): Item[] {
    // Use provided RNG, global RNG, or fallback
    const random = rng ?? (isRNGInitialized() ? getRNG() : null);
    
    const loot: Item[] = [];

    // Determine max rarity based on level
    let maxRarity: ItemRarity;
    if (level >= 15) maxRarity = ItemRarity.LEGENDARY;
    else if (level >= 10) maxRarity = ItemRarity.VERY_RARE;
    else if (level >= 5) maxRarity = ItemRarity.RARE;
    else if (level >= 3) maxRarity = ItemRarity.UNCOMMON;
    else maxRarity = ItemRarity.COMMON;

    // Always drop a consumable
    loot.push(getRandomItem(ItemType.CONSUMABLE, maxRarity, random ?? undefined));

    // Equipment drop chance: starts at 50% and increases with level
    // At level 1: 50%, at level 10: 80%, at level 20: 100%+
    const equipmentChance = 0.5 + (level * 0.03);
    const shouldDropEquipment = guaranteeEquipment || (random 
        ? random.chance(equipmentChance)
        : Math.random() < equipmentChance);
        
    if (shouldDropEquipment) {
        const equipmentTypes = [ItemType.WEAPON, ItemType.ARMOR, ItemType.ACCESSORY];
        const type = random 
            ? random.choice(equipmentTypes)
            : equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
        loot.push(getRandomItem(type, maxRarity, random ?? undefined));
    }
    
    // Small chance for a second equipment piece at higher levels
    if (level >= 5) {
        const bonusEquipChance = 0.1 + (level * 0.02); // 10% at level 5, up to 40% at level 20
        const shouldDropBonus = random 
            ? random.chance(bonusEquipChance)
            : Math.random() < bonusEquipChance;
        if (shouldDropBonus) {
            const equipmentTypes = [ItemType.WEAPON, ItemType.ARMOR, ItemType.ACCESSORY];
            const type = random 
                ? random.choice(equipmentTypes)
                : equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
            loot.push(getRandomItem(type, maxRarity, random ?? undefined));
        }
    }

    return loot;
}

/**
 * Creates a deep copy of an item with a new unique ID.
 * Used when adding items to inventory to ensure each instance is unique.
 * The new ID is the original ID suffixed with a random 8-character UUID segment.
 * 
 * @param item - The item template to clone
 * @returns A new Item instance with a unique ID
 * 
 * @example
 * ```typescript
 * const template = getItemById('longsword')!;
 * const sword1 = cloneItem(template); // longsword-a1b2c3d4
 * const sword2 = cloneItem(template); // longsword-e5f6g7h8
 * ```
 */
export function cloneItem(item: Item): Item {
    return {
        ...item,
        id: `${item.id}-${crypto.randomUUID().slice(0, 8)}`
    };
}

/**
 * Shop item with calculated buy price.
 */
export interface ShopItem {
    /** The item for sale */
    item: Item;
    /** Price to buy this item (higher than base value) */
    buyPrice: number;
}

/**
 * Generates shop inventory based on dungeon level.
 * Shop inventory includes a mix of weapons, armor, accessories, and consumables.
 * Prices are marked up from base item values.
 * 
 * @param level - Current dungeon level (affects item rarity and selection)
 * @param rng - Optional seeded RNG for deterministic generation
 * @returns Array of ShopItems available for purchase
 */
export function generateShopInventory(level: number, rng?: Seed): ShopItem[] {
    const random = rng ?? (isRNGInitialized() ? getRNG() : null);
    const inventory: ShopItem[] = [];
    
    // Determine max rarity based on level
    let maxRarity: ItemRarity;
    if (level >= 15) maxRarity = ItemRarity.VERY_RARE;
    else if (level >= 10) maxRarity = ItemRarity.RARE;
    else if (level >= 5) maxRarity = ItemRarity.UNCOMMON;
    else maxRarity = ItemRarity.COMMON;
    
    // Price markup multiplier (shops charge more than item base value)
    const markup = 1.5;
    
    // Always have 2-3 consumables
    const consumableCount = random ? random.nextInt(2, 3) : Math.floor(Math.random() * 2) + 2;
    for (let i = 0; i < consumableCount; i++) {
        const item = cloneItem(getRandomItem(ItemType.CONSUMABLE, maxRarity, random ?? undefined));
        inventory.push({
            item,
            buyPrice: Math.floor(item.value * markup)
        });
    }
    
    // 1-2 weapons
    const weaponCount = random ? random.nextInt(1, 2) : Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < weaponCount; i++) {
        const item = cloneItem(getRandomItem(ItemType.WEAPON, maxRarity, random ?? undefined));
        inventory.push({
            item,
            buyPrice: Math.floor(item.value * markup)
        });
    }
    
    // 1-2 armor pieces
    const armorCount = random ? random.nextInt(1, 2) : Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < armorCount; i++) {
        const item = cloneItem(getRandomItem(ItemType.ARMOR, maxRarity, random ?? undefined));
        inventory.push({
            item,
            buyPrice: Math.floor(item.value * markup)
        });
    }
    
    // 0-1 accessory
    const hasAccessory = random ? random.chance(0.6) : Math.random() < 0.6;
    if (hasAccessory) {
        const item = cloneItem(getRandomItem(ItemType.ACCESSORY, maxRarity, random ?? undefined));
        inventory.push({
            item,
            buyPrice: Math.floor(item.value * markup)
        });
    }
    
    return inventory;
}

/**
 * Calculates the sell price for an item (player selling to shop).
 * Sell price is typically 50% of the item's base value.
 * 
 * @param item - The item to sell
 * @returns Gold amount the player receives
 */
export function getSellPrice(item: Item): number {
    return Math.floor(item.value * 0.5);
}
