/**
 * @fileoverview Relic System for Dungeon Roguelike
 * 
 * Relics are powerful permanent rewards obtained from successfully disarming traps.
 * They can grant:
 * - New abilities/spells
 * - Permanent stat bonuses
 * - Passive effects
 * - Special combat modifiers
 * 
 * @module entities/relic
 */

import { Ability } from './player';
import { StatBonus, DamageType } from './item';
import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Types of relics that can be obtained.
 * @enum {string}
 */
export enum RelicType {
    /** Grants a new usable ability */
    ABILITY = 'ability',
    /** Provides permanent stat bonuses */
    STAT_BOOST = 'stat_boost',
    /** Grants a passive effect that triggers automatically */
    PASSIVE = 'passive',
    /** Modifies combat mechanics */
    COMBAT_MODIFIER = 'combat_modifier'
}

/**
 * Rarity levels for relics.
 * @enum {string}
 */
export enum RelicRarity {
    /** Common relics with minor bonuses */
    COMMON = 'common',
    /** Uncommon relics with moderate effects */
    UNCOMMON = 'uncommon',
    /** Rare relics with significant powers */
    RARE = 'rare',
    /** Legendary relics with game-changing abilities */
    LEGENDARY = 'legendary'
}

/**
 * Passive effect types that relics can grant.
 * @enum {string}
 */
export enum PassiveEffectType {
    /** Regenerate health each turn */
    HEALTH_REGEN = 'health_regen',
    /** Regenerate mana each turn */
    MANA_REGEN = 'mana_regen',
    /** Chance to reflect damage */
    DAMAGE_REFLECT = 'damage_reflect',
    /** Chance to dodge attacks */
    EVASION = 'evasion',
    /** Lifesteal on attacks */
    LIFESTEAL = 'lifesteal',
    /** Extra gold from enemies */
    GOLD_BONUS = 'gold_bonus',
    /** Extra experience from enemies */
    XP_BONUS = 'xp_bonus',
    /** Resistance to status effects */
    STATUS_RESISTANCE = 'status_resistance',
    /** Chance to act twice */
    DOUBLE_STRIKE = 'double_strike',
    /** Thorns damage when hit */
    THORNS = 'thorns'
}

/**
 * Combat modifier types.
 * @enum {string}
 */
export enum CombatModifierType {
    /** Bonus damage against certain enemy types */
    SLAYER = 'slayer',
    /** Reduced damage from certain sources */
    RESISTANCE = 'resistance',
    /** Bonus to initiative/speed */
    INITIATIVE_BONUS = 'initiative_bonus',
    /** Ignore portion of enemy defense */
    ARMOR_PIERCE = 'armor_pierce',
    /** Bonus damage on critical hits */
    CRIT_DAMAGE = 'crit_damage',
    /** Bonus critical hit chance */
    CRIT_CHANCE = 'crit_chance'
}

/**
 * Passive effect configuration.
 * @interface
 */
export interface PassiveEffect {
    /** Type of passive effect */
    type: PassiveEffectType;
    /** Value/magnitude of the effect */
    value: number;
    /** Chance to trigger (0-1, for proc effects) */
    chance?: number;
}

/**
 * Combat modifier configuration.
 * @interface
 */
export interface CombatModifier {
    /** Type of combat modifier */
    type: CombatModifierType;
    /** Value/magnitude of the modifier */
    value: number;
    /** Target type (for slayer/resistance) */
    targetType?: string;
}

/**
 * Represents a relic that can be collected by the player.
 * @interface
 */
export interface Relic {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Flavor description */
    description: string;
    /** Type of relic */
    type: RelicType;
    /** Rarity level */
    rarity: RelicRarity;
    /** Ability granted (for ABILITY type) */
    grantedAbility?: Ability;
    /** Stat bonuses (for STAT_BOOST type) */
    statBonus?: StatBonus;
    /** Passive effect (for PASSIVE type) */
    passiveEffect?: PassiveEffect;
    /** Combat modifier (for COMBAT_MODIFIER type) */
    combatModifier?: CombatModifier;
    /** Icon/image identifier */
    icon?: string;
}

// =============================================================================
// RELIC DATABASE
// =============================================================================

/**
 * All available relics in the game.
 * @const
 */
export const RELIC_DATABASE: Relic[] = [
    // =========================================================================
    // ABILITY RELICS - Grant new spells/abilities
    // =========================================================================
    {
        id: 'relic_shadow_step',
        name: 'Shadow Step Amulet',
        description: 'An ancient amulet that allows you to step through shadows, teleporting behind enemies.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.RARE,
        grantedAbility: {
            id: 'shadow_step',
            name: 'Shadow Step',
            description: 'Teleport behind an enemy, dealing bonus damage on your next attack.',
            manaCost: 15,
            cooldown: 4,
            currentCooldown: 0,
            damage: 20,
            effect: 'teleport_strike',
            source: 'Shadow Step Amulet'
        }
    },
    {
        id: 'relic_healing_light',
        name: 'Sunstone Pendant',
        description: 'A warm stone that channels healing light from an ancient sun god.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.UNCOMMON,
        grantedAbility: {
            id: 'healing_light',
            name: 'Healing Light',
            description: 'Channel divine light to restore health.',
            manaCost: 20,
            cooldown: 3,
            currentCooldown: 0,
            healing: 35,
            source: 'Sunstone Pendant'
        }
    },
    {
        id: 'relic_frost_nova',
        name: 'Frozen Heart Crystal',
        description: 'A crystal of eternal ice that can unleash a devastating frost nova.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.RARE,
        grantedAbility: {
            id: 'frost_nova',
            name: 'Frost Nova',
            description: 'Release a burst of frost, damaging and slowing all enemies.',
            manaCost: 25,
            cooldown: 5,
            currentCooldown: 0,
            damage: 30,
            effect: 'aoe_slow',
            source: 'Frozen Heart Crystal'
        }
    },
    {
        id: 'relic_chain_lightning',
        name: 'Stormcaller\'s Shard',
        description: 'A fragment of a lightning bolt, crackling with electrical energy.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.LEGENDARY,
        grantedAbility: {
            id: 'chain_lightning',
            name: 'Chain Lightning',
            description: 'Launch a bolt of lightning that chains between enemies.',
            manaCost: 30,
            cooldown: 4,
            currentCooldown: 0,
            damage: 45,
            effect: 'chain_damage',
            source: 'Stormcaller\'s Shard'
        }
    },
    {
        id: 'relic_life_drain',
        name: 'Vampire\'s Fang',
        description: 'A fang from an ancient vampire lord, granting the power to drain life.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.RARE,
        grantedAbility: {
            id: 'life_drain',
            name: 'Life Drain',
            description: 'Drain life from an enemy, healing yourself.',
            manaCost: 18,
            cooldown: 3,
            currentCooldown: 0,
            damage: 25,
            healing: 15,
            effect: 'lifesteal',
            source: 'Vampire\'s Fang'
        }
    },
    {
        id: 'relic_berserk',
        name: 'Berserker\'s Totem',
        description: 'A tribal totem that can invoke a furious battle rage.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.UNCOMMON,
        grantedAbility: {
            id: 'berserk',
            name: 'Berserk',
            description: 'Enter a rage, increasing attack but reducing defense for 3 turns.',
            manaCost: 15,
            cooldown: 6,
            currentCooldown: 0,
            effect: 'buff_attack_debuff_defense',
            source: 'Berserker\'s Totem'
        }
    },
    {
        id: 'relic_stone_skin',
        name: 'Earth Guardian\'s Core',
        description: 'The core of an earth elemental, granting temporary invulnerability.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.LEGENDARY,
        grantedAbility: {
            id: 'stone_skin',
            name: 'Stone Skin',
            description: 'Turn your skin to stone, greatly increasing defense for 2 turns.',
            manaCost: 25,
            cooldown: 8,
            currentCooldown: 0,
            effect: 'buff_defense_major',
            source: 'Earth Guardian\'s Core'
        }
    },
    {
        id: 'relic_poison_cloud',
        name: 'Plague Doctor\'s Vial',
        description: 'A vial of concentrated plague that creates a toxic cloud.',
        type: RelicType.ABILITY,
        rarity: RelicRarity.UNCOMMON,
        grantedAbility: {
            id: 'poison_cloud',
            name: 'Poison Cloud',
            description: 'Release a cloud of poison, dealing damage over time to all enemies.',
            manaCost: 20,
            cooldown: 4,
            currentCooldown: 0,
            damage: 10,
            effect: 'aoe_poison',
            source: 'Plague Doctor\'s Vial'
        }
    },

    // =========================================================================
    // STAT BOOST RELICS - Permanent stat increases
    // =========================================================================
    {
        id: 'relic_warriors_heart',
        name: 'Warrior\'s Heart',
        description: 'The crystallized heart of a legendary warrior, granting immense vitality.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.RARE,
        statBonus: {
            maxHealth: 25
        }
    },
    {
        id: 'relic_mages_focus',
        name: 'Mage\'s Focus',
        description: 'A lens that sharpens magical power and expands mana reserves.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.RARE,
        statBonus: {
            mana: 20,
            maxMana: 20
        }
    },
    {
        id: 'relic_iron_will',
        name: 'Iron Will Medallion',
        description: 'A medallion that hardens your resolve and body.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.UNCOMMON,
        statBonus: {
            defense: 5
        }
    },
    {
        id: 'relic_strength_band',
        name: 'Band of Strength',
        description: 'A simple band that grants supernatural strength.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.UNCOMMON,
        statBonus: {
            attack: 5
        }
    },
    {
        id: 'relic_swift_boots_essence',
        name: 'Essence of Swiftness',
        description: 'Ethereal essence that permanently quickens your movements.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.UNCOMMON,
        statBonus: {
            speed: 3
        }
    },
    {
        id: 'relic_lucky_coin',
        name: 'Lucky Coin',
        description: 'An ancient coin that brings fortune in battle.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.COMMON,
        statBonus: {
            critChance: 5
        }
    },
    {
        id: 'relic_titans_blessing',
        name: 'Titan\'s Blessing',
        description: 'A blessing from an ancient titan, enhancing all aspects of combat.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.LEGENDARY,
        statBonus: {
            attack: 3,
            defense: 3,
            maxHealth: 15,
            speed: 2
        }
    },
    {
        id: 'relic_assassins_mark',
        name: 'Assassin\'s Mark',
        description: 'A mark that grants deadly precision.',
        type: RelicType.STAT_BOOST,
        rarity: RelicRarity.RARE,
        statBonus: {
            critChance: 10,
            critMultiplier: 0.25
        }
    },

    // =========================================================================
    // PASSIVE RELICS - Automatic effects
    // =========================================================================
    {
        id: 'relic_regeneration_ring',
        name: 'Ring of Regeneration',
        description: 'A ring that slowly knits wounds closed over time.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.UNCOMMON,
        passiveEffect: {
            type: PassiveEffectType.HEALTH_REGEN,
            value: 3
        }
    },
    {
        id: 'relic_mana_spring',
        name: 'Mana Spring Charm',
        description: 'A charm that draws mana from the air itself.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.UNCOMMON,
        passiveEffect: {
            type: PassiveEffectType.MANA_REGEN,
            value: 5
        }
    },
    {
        id: 'relic_mirror_shield',
        name: 'Mirror Shield Fragment',
        description: 'A fragment of a legendary mirror shield that reflects attacks.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.RARE,
        passiveEffect: {
            type: PassiveEffectType.DAMAGE_REFLECT,
            value: 20,
            chance: 0.15
        }
    },
    {
        id: 'relic_shadow_cloak',
        name: 'Shadow Cloak Essence',
        description: 'Essence of shadow that helps you evade attacks.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.RARE,
        passiveEffect: {
            type: PassiveEffectType.EVASION,
            value: 10,
            chance: 0.10
        }
    },
    {
        id: 'relic_vampiric_essence',
        name: 'Vampiric Essence',
        description: 'Dark essence that steals life with each attack.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.RARE,
        passiveEffect: {
            type: PassiveEffectType.LIFESTEAL,
            value: 10,
            chance: 0.20
        }
    },
    {
        id: 'relic_gold_magnet',
        name: 'Gold Magnet',
        description: 'A strange magnet that attracts extra gold.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.COMMON,
        passiveEffect: {
            type: PassiveEffectType.GOLD_BONUS,
            value: 25
        }
    },
    {
        id: 'relic_wisdom_stone',
        name: 'Stone of Wisdom',
        description: 'A stone that enhances learning and grants bonus experience.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.COMMON,
        passiveEffect: {
            type: PassiveEffectType.XP_BONUS,
            value: 15
        }
    },
    {
        id: 'relic_thorns_aura',
        name: 'Thorns Aura Crystal',
        description: 'A crystal that surrounds you with damaging thorns.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.UNCOMMON,
        passiveEffect: {
            type: PassiveEffectType.THORNS,
            value: 5
        }
    },
    {
        id: 'relic_double_strike',
        name: 'Echo Strike Gem',
        description: 'A gem that sometimes echoes your attacks.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.LEGENDARY,
        passiveEffect: {
            type: PassiveEffectType.DOUBLE_STRIKE,
            value: 1,
            chance: 0.15
        }
    },
    {
        id: 'relic_status_ward',
        name: 'Ward of Purity',
        description: 'A ward that protects against harmful status effects.',
        type: RelicType.PASSIVE,
        rarity: RelicRarity.UNCOMMON,
        passiveEffect: {
            type: PassiveEffectType.STATUS_RESISTANCE,
            value: 30
        }
    },

    // =========================================================================
    // COMBAT MODIFIER RELICS - Change combat mechanics
    // =========================================================================
    {
        id: 'relic_undead_slayer',
        name: 'Undead Slayer\'s Badge',
        description: 'A badge that grants power against the undead.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.UNCOMMON,
        combatModifier: {
            type: CombatModifierType.SLAYER,
            value: 25,
            targetType: 'undead'
        }
    },
    {
        id: 'relic_beast_hunter',
        name: 'Beast Hunter\'s Trophy',
        description: 'A trophy that grants power against beasts.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.UNCOMMON,
        combatModifier: {
            type: CombatModifierType.SLAYER,
            value: 25,
            targetType: 'beast'
        }
    },
    {
        id: 'relic_dragon_scale',
        name: 'Dragon Scale',
        description: 'A scale from an ancient dragon, granting fire resistance.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.RARE,
        combatModifier: {
            type: CombatModifierType.RESISTANCE,
            value: 30,
            targetType: 'fire'
        }
    },
    {
        id: 'relic_armor_piercer',
        name: 'Armor Piercing Rune',
        description: 'A rune that allows attacks to bypass armor.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.RARE,
        combatModifier: {
            type: CombatModifierType.ARMOR_PIERCE,
            value: 20
        }
    },
    {
        id: 'relic_quick_reflexes',
        name: 'Reflex Enhancer',
        description: 'Enhances reflexes for faster combat initiative.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.COMMON,
        combatModifier: {
            type: CombatModifierType.INITIATIVE_BONUS,
            value: 5
        }
    },
    {
        id: 'relic_brutal_strikes',
        name: 'Brutal Strike Sigil',
        description: 'A sigil that makes critical hits even more devastating.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.RARE,
        combatModifier: {
            type: CombatModifierType.CRIT_DAMAGE,
            value: 50
        }
    },
    {
        id: 'relic_precision_lens',
        name: 'Precision Lens',
        description: 'A magical lens that helps find weak points.',
        type: RelicType.COMBAT_MODIFIER,
        rarity: RelicRarity.UNCOMMON,
        combatModifier: {
            type: CombatModifierType.CRIT_CHANCE,
            value: 8
        }
    }
];

// =============================================================================
// RELIC GENERATION FUNCTIONS
// =============================================================================

/**
 * Gets relics filtered by rarity.
 * 
 * @param rarity - The rarity to filter by
 * @returns Array of relics with the specified rarity
 */
export function getRelicsByRarity(rarity: RelicRarity): Relic[] {
    return RELIC_DATABASE.filter(r => r.rarity === rarity);
}

/**
 * Gets relics filtered by type.
 * 
 * @param type - The type to filter by
 * @returns Array of relics with the specified type
 */
export function getRelicsByType(type: RelicType): Relic[] {
    return RELIC_DATABASE.filter(r => r.type === type);
}

/**
 * Gets a relic by its ID.
 * 
 * @param id - The relic ID to find
 * @returns The relic or undefined if not found
 */
export function getRelicById(id: string): Relic | undefined {
    return RELIC_DATABASE.find(r => r.id === id);
}

/**
 * Generates a random relic appropriate for the given dungeon level.
 * Higher levels have better chances for rare relics.
 * 
 * @param level - The dungeon level (affects rarity chances)
 * @param excludeIds - Array of relic IDs to exclude (already owned)
 * @returns A random relic appropriate for the level
 */
export function generateRandomRelic(level: number, excludeIds: string[] = []): Relic {
    const rng = isRNGInitialized() ? getRNG() : null;
    
    // Determine rarity based on level
    const roll = rng ? rng.nextFloat() : Math.random();
    let rarity: RelicRarity;
    
    // Rarity chances scale with level
    const legendaryChance = Math.min(0.05 + (level * 0.01), 0.15); // 5% at L1, up to 15% at L10+
    const rareChance = Math.min(0.15 + (level * 0.02), 0.35);      // 15% at L1, up to 35% at L10+
    const uncommonChance = Math.min(0.35 + (level * 0.02), 0.50);  // 35% at L1, up to 50% at L8+
    
    if (roll < legendaryChance) {
        rarity = RelicRarity.LEGENDARY;
    } else if (roll < legendaryChance + rareChance) {
        rarity = RelicRarity.RARE;
    } else if (roll < legendaryChance + rareChance + uncommonChance) {
        rarity = RelicRarity.UNCOMMON;
    } else {
        rarity = RelicRarity.COMMON;
    }
    
    // Get available relics of this rarity (excluding already owned)
    let availableRelics = getRelicsByRarity(rarity).filter(r => !excludeIds.includes(r.id));
    
    // If no relics available at this rarity, try lower rarities
    if (availableRelics.length === 0) {
        const rarityOrder = [RelicRarity.LEGENDARY, RelicRarity.RARE, RelicRarity.UNCOMMON, RelicRarity.COMMON];
        for (const fallbackRarity of rarityOrder) {
            availableRelics = getRelicsByRarity(fallbackRarity).filter(r => !excludeIds.includes(r.id));
            if (availableRelics.length > 0) break;
        }
    }
    
    // If still no relics (player has all of them), return a random one anyway
    if (availableRelics.length === 0) {
        availableRelics = RELIC_DATABASE;
    }
    
    // Select a random relic
    const index = rng 
        ? rng.nextInt(0, availableRelics.length - 1)
        : Math.floor(Math.random() * availableRelics.length);
    
    return availableRelics[index];
}

/**
 * Generates a relic specifically for trap disarm rewards.
 * Trap type and difficulty affect the relic quality.
 * 
 * @param trapDC - The difficulty class of the disarmed trap
 * @param level - The dungeon level
 * @param excludeIds - Array of relic IDs to exclude
 * @returns A relic appropriate for the trap difficulty
 */
export function generateTrapRelic(trapDC: number, level: number, excludeIds: string[] = []): Relic {
    // Higher DC traps give better relic chances
    // DC 8-10: standard chances
    // DC 11-14: +1 effective level
    // DC 15-17: +2 effective levels
    // DC 18+: +3 effective levels and guaranteed at least uncommon
    
    let effectiveLevel = level;
    if (trapDC >= 18) effectiveLevel += 3;
    else if (trapDC >= 15) effectiveLevel += 2;
    else if (trapDC >= 11) effectiveLevel += 1;
    
    return generateRandomRelic(effectiveLevel, excludeIds);
}

/**
 * Creates a deep copy of a relic.
 * Used when adding relics to player inventory.
 * 
 * @param relic - The relic to clone
 * @returns A new Relic instance with copied properties
 */
export function cloneRelic(relic: Relic): Relic {
    const cloned: Relic = {
        ...relic,
        id: `${relic.id}-${crypto.randomUUID().slice(0, 8)}`
    };
    
    // Deep clone nested objects
    if (relic.grantedAbility) {
        cloned.grantedAbility = { ...relic.grantedAbility };
    }
    if (relic.statBonus) {
        cloned.statBonus = { ...relic.statBonus };
    }
    if (relic.passiveEffect) {
        cloned.passiveEffect = { ...relic.passiveEffect };
    }
    if (relic.combatModifier) {
        cloned.combatModifier = { ...relic.combatModifier };
    }
    
    return cloned;
}

