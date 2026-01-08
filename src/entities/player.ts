/**
 * @fileoverview Player Entity System for Dungeon Roguelike
 * 
 * This module defines the base Player class and related types. Players are
 * the main controllable entities in the game with:
 * - Stats (health, mana, attack, defense, speed, crit)
 * - Equipment (weapon, armor, accessory)
 * - Inventory management
 * - Abilities (class-specific and equipment-granted)
 * - Buff/debuff system
 * - Experience and leveling
 * 
 * The Player class is abstract - use Fighter or Warlock subclasses.
 * 
 * @module entities/player
 */

import {
    Item,
    ItemType,
    ItemSlot,
    StatBonus,
    GrantedAbility,
    OnHitEffect,
    calculateAverageDamage,
    rollDice
} from './item';
import { Relic, RelicType, PassiveEffectType, CombatModifierType, PassiveEffect, CombatModifier } from './relic';
import { getRNG, isRNGInitialized } from '../game/seed';
import { XP_PER_LEVEL, MAX_LEVEL } from '../game/constants';

/**
 * Available player class types.
 * Each class has different base stats, abilities, and playstyles.
 * @enum {string}
 */
export enum PlayerClass {
    /** Melee warrior with high health and defense */
    FIGHTER = 'fighter',
    /** Magic user with high mana and powerful spells */
    WARLOCK = 'warlock',
    /** Hemomancy-focused hybrid with health sacrifice mechanics */
    BLOOD_ASSASSIN = 'blood_assassin',
    /** Wind sorcerer with high mobility and evasion */
    ZEPHYR = 'zephyr'
}

/**
 * Equipment slots for the player.
 * Each slot can hold one item of the appropriate type.
 * @interface
 */
export interface Equipment {
    /** Equipped weapon (affects attack damage) */
    weapon: Item | null;
    /** Equipped armor (affects defense) */
    armor: Item | null;
    /** Equipped accessory (various bonuses) */
    accessory: Item | null;
}

/**
 * Ability scores for a player character.
 * @interface
 */
export interface AbilityScores {
    Strength: number;
    Dexterity: number;
    Constitution: number;
    Intelligence: number;
    Wisdom: number;
    Charisma: number;
    Luck: number;
}

/**
 * Base stats for a player character.
 * These values are modified by equipment, buffs, and level.
 * @interface
 */
export interface PlayerStats {
    /** Current health points */
    health: number;
    /** Current mana/resource pool for abilities */
    mana: number;
    /** Base stats */
    abilityScores: AbilityScores;
}

/**
 * Active buff applied to player.
 * Buffs provide temporary stat bonuses that expire after a number of turns.
 * @interface
 */
export interface ActiveBuff {
    /** Display name of the buff */
    name: string;
    /** Stat bonuses provided by the buff */
    bonuses: StatBonus;
    /** Number of turns remaining */
    remainingTurns: number;
}

/** How to interpret the damage value */
export type DamageCalculation = 'flat' | 'multiplier';

/** How to interpret the healing value */
export type HealingCalculation = 'flat' | 'percent_max_hp';

/** Who the ability targets */
export type AbilityTarget = 'enemy' | 'self' | 'all_enemies';

/** 
 * Type of ability - determines how it hits and scales.
 * - 'spell': Uses spell attack (INT, WIS, CHA mod), scales by adding a d# (damage dice) to the spells damage every 4 levels
 * - 'physical': Uses attack roll (STR,DEX mod), uses damage dice + modifier
 * - 'status_buff': Applies beneficial effect to self, usually auto-hits
 * - 'status_debuff': Applies negative effect to enemy, target rolls saving throw
 */
export type AbilityType = 'spell' | 'physical' | 'status_buff' | 'status_debuff';

/**
 * Ability score used for saving throws.
 * Target rolls d20 + ability modifier vs caster's save DC.
 */
export type SaveType = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

/** Status effect to apply with an ability */
export interface AbilityStatusEffect {
    /** The type of status effect */
    type: string; // Maps to StatusEffectType in combatEngine
    /** Duration in turns */
    duration: number;
    /** Value (damage per turn for DOT, % modifier for buffs/debuffs) */
    value?: number;
}

/** Resource cost beyond mana (health sacrifice, soul shards, etc.) */
export interface AbilityResourceCost {
    /** Type of resource */
    type: 'health' | 'shards';
    /** Percentage of current/max resource */
    percent?: number;
    /** Flat amount */
    flat?: number;
}

/** Resource gained from using the ability */
export interface AbilityResourceGain {
    /** Type of resource */
    type: 'mana' | 'health';
    /** Percentage of max resource */
    percent?: number;
    /** Flat amount */
    flat?: number;
}

/**
 * Class-specific or equipment-granted ability.
 * Abilities are special actions that cost mana and may have cooldowns.
 * Uses a standardized format for generic combat engine handling.
 * @interface
 */
export interface Ability {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of what the ability does */
    description: string;
    /** Mana cost to use */
    manaCost: number;
    /** Cooldown in turns before ability can be used again */
    cooldown: number;
    /** Current cooldown remaining (0 = ready) */
    currentCooldown: number;
    /** Source of the ability ('class' or item name) */
    source?: string;

    // === Targeting ===
    /** Who the ability targets (default: 'enemy') */
    targetType?: AbilityTarget;

    /** Type of ability - determines hit calculation and scaling */
    abilityType?: AbilityType;

    // === Damage ===
    /** 
     * Damage dice for physical abilities (e.g., "2d6", "1d10").
     * Rolled and added to STR/DEX modifier for physical attacks.
     */
    damageDice?: string;
    /**
     * Damage dice for spell abilities (e.g., "1d10", "2d6").
     * Scales with level: +1 die every 4 levels (like D&D cantrips).
     * Level 1-4: 1 die, Level 5-8: 2 dice, Level 9-12: 3 dice, etc.
     */
    spellDamageDice?: string;
    /** Damage value (for flat damage spells or bonus flat damage on physical) */
    damage?: number;
    /** How to calculate damage: 'flat' (base + level scaling) or 'multiplier' (% of basic attack) */
    damageCalc?: DamageCalculation;
    /** Level scaling multiplier for flat damage (default: 1.0) - DEPRECATED, use spellDamageDice instead */
    levelScaling?: number;

    // === Healing ===
    /** Healing value (interpretation depends on healingCalc) */
    healing?: number;
    /** How to calculate healing: 'flat' or 'percent_max_hp' */
    healingCalc?: HealingCalculation;
    /** Percent of damage dealt to heal (lifesteal) */
    lifestealPercent?: number;

    // === Status Effects ===
    /** Status effect to apply to target */
    statusEffect?: AbilityStatusEffect;
    /** Status effect to apply to self (buff) */
    selfBuff?: AbilityStatusEffect;
    /** 
     * Saving throw type for status_debuff abilities.
     * Target rolls d20 + ability modifier vs caster's save DC.
     * If target succeeds, effect is resisted.
     */
    saveType?: SaveType;

    // === Resource Costs/Gains ===
    /** Additional resource cost (beyond mana) */
    resourceCost?: AbilityResourceCost;
    /** Resource gained from using ability */
    resourceGain?: AbilityResourceGain;

    // === Special Flags ===
    /** Whether this ability uses soul shards for bonus damage */
    consumesShards?: boolean;
    /** Bonus damage per shard consumed */
    damagePerShard?: number;
    /** Whether this is a full restore (health, mana, cooldowns) */
    fullRestore?: boolean;
    /** Whether this grants invulnerability */
    invulnerable?: boolean;

    // === Legacy (for backwards compatibility during transition) ===
    /** @deprecated Use statusEffect instead */
    effect?: string;
    /** @deprecated Use targetType: 'all_enemies' instead */
    isAoe?: boolean;
}

/**
 * Result of processing on-hit effects from equipment.
 * @interface
 */
export interface OnHitResult {
    /** Type of effect triggered */
    type: string;
    /** Value associated with the effect (damage, healing, etc.) */
    value?: number;
    /** Duration in turns (for DOT/debuff effects) */
    duration?: number;
}

/**
 * Serialized player data for save/load functionality.
 * @interface
 */
export interface PlayerJSON {
    /** Unique player ID */
    id: string;
    /** Player name */
    name: string;
    /** Player class */
    playerClass: PlayerClass;
    /** Current level */
    level: number;
    /** Total experience points */
    experience: number;
    /** Current gold */
    gold: number;
    /** Current stats */
    stats: PlayerStats;
    /** Equipment item IDs */
    equipment: {
        weapon: string | null;
        armor: string | null;
        accessory: string | null;
    };
    /** Inventory item IDs */
    inventory: string[];
    /** Current ability states */
    abilities: Ability[];
    /** Active buffs */
    activeBuffs: ActiveBuff[];
}

/**
 * Base ability scores per class.
 * All other stats (HP, MP, attack, defense, etc.) are derived from these.
 * @const
 */
const CLASS_BASE_ABILITY_SCORES: Record<PlayerClass, AbilityScores> = {
    [PlayerClass.FIGHTER]: {
        Strength: 16,      // +3 modifier - Fighters are strong
        Dexterity: 14,     // +2 modifier
        Constitution: 14,  // +2 modifier - Hardy
        Intelligence: 10,  // +0 modifier
        Wisdom: 12,        // +1 modifier
        Charisma: 8,       // -1 modifier
        Luck: 10           // +0 modifier
    },
    [PlayerClass.WARLOCK]: {
        Strength: 8,       // -1 modifier - Warlocks are weak
        Dexterity: 12,     // +1 modifier
        Constitution: 10,  // +0 modifier
        Intelligence: 16,  // +3 modifier - Smart casters
        Wisdom: 14,        // +2 modifier - Wise casters
        Charisma: 14,      // +2 modifier - Charismatic
        Luck: 12           // +1 modifier - Lucky charm
    },
    [PlayerClass.BLOOD_ASSASSIN]: {
        Strength: 12,      // +1 modifier - Decent strength
        Dexterity: 16,     // +3 modifier - Blood Assassins are agile
        Constitution: 12,  // +1 modifier - Medium durability
        Intelligence: 14,  // +2 modifier - Blood magic requires knowledge
        Wisdom: 10,        // +0 modifier
        Charisma: 10,      // +0 modifier
        Luck: 12           // +1 modifier - Lucky criticals
    },
    [PlayerClass.ZEPHYR]: {
        Strength: 8,       // -1 modifier - Zephyrs are physically weak
        Dexterity: 16,     // +3 modifier - Wind grants agility
        Constitution: 10,  // +0 modifier - Average durability
        Intelligence: 14,  // +2 modifier - Wind magic requires study
        Wisdom: 12,        // +1 modifier
        Charisma: 14,      // +2 modifier - Charismatic wind dancers
        Luck: 12           // +1 modifier - Winds of fortune
    }
};

/**
 * Ability score growth per level per class.
 * These values are added to ability scores on each level up.
 * @const
 */
const CLASS_ABILITY_GROWTH: Record<PlayerClass, Partial<AbilityScores>> = {
    [PlayerClass.FIGHTER]: {
        Strength: 1,      // Fighters grow stronger
        Constitution: 1   // And hardier
    },
    [PlayerClass.WARLOCK]: {
        Intelligence: 1,  // Warlocks grow smarter
        Charisma: 1       // And more charismatic
    },
    [PlayerClass.BLOOD_ASSASSIN]: {
        Dexterity: 1,     // Blood Assassins grow more agile
        Intelligence: 1   // And better at blood magic
    },
    [PlayerClass.ZEPHYR]: {
        Dexterity: 1,     // Zephyrs grow more agile
        Charisma: 1       // And more attuned to wind
    }
};


/**
 * Abstract base Player class - handles core player functionality.
 * 
 * This class provides:
 * - Stat calculations with equipment and buff bonuses
 * - Health and mana management
 * - Equipment and inventory management
 * - Buff/debuff system
 * - Experience and leveling
 * - Combat actions (basic attack, abilities)
 * - Serialization for save/load
 * 
 * Subclasses (Fighter, Warlock) implement class-specific abilities.
 * 
 * @abstract
 * @example
 * ```typescript
 * // Use a concrete subclass
 * const fighter = new Fighter('Hero');
 * const warlock = new Warlock('Mage');
 * 
 * // Common operations
 * player.equipItem(sword);
 * player.takeDamage(20);
 * player.heal(15);
 * player.useAbility('power_strike');
 * ```
 */
export abstract class Player {
    /** Unique identifier for the player */
    public readonly id: string = crypto.randomUUID();
    
    /** Player's display name */
    public name: string;
    
    /** Player's class type */
    public readonly playerClass: PlayerClass;
    
    /** Current level (1-20) */
    public level: number = 1;
    
    /** Total experience points earned */
    public experience: number = 0;
    
    /** Current gold amount */
    public gold: number = 0;
    
    /** Current stat values */
    public stats: PlayerStats;
    
    /** Currently equipped items */
    public equipment: Equipment = {
        weapon: null,
        armor: null,
        accessory: null
    };
    
    /** Items in inventory */
    public inventory: Item[] = [];
    
    /** Available abilities */
    public abilities: Ability[] = [];
    
    /** Currently active buffs */
    public activeBuffs: ActiveBuff[] = [];

    /** Collected relics (permanent bonuses) */
    public relics: Relic[] = [];

    /**
     * Creates a new player with the specified name and class.
     * 
     * @param name - The player's display name
     * @param playerClass - The player's class (FIGHTER or WARLOCK)
     */
    constructor(name: string, playerClass: PlayerClass) {
        this.name = name;
        this.playerClass = playerClass;
        
        // Initialize stats with ability scores (health/mana derived after)
        this.stats = {
            health: 0,
            mana: 0,
            abilityScores: { ...CLASS_BASE_ABILITY_SCORES[playerClass] }
        };
        
        // Set health and mana to max (derived from ability scores)
        this.stats.health = this.getMaxHealth();
        this.stats.mana = this.getMaxMana();
        
        this.initializeAbilities();
    }

    /**
     * Initialize class-specific abilities.
     * Must be implemented by subclasses.
     * @protected
     * @abstract
     */
    protected abstract initializeAbilities(): void;

    // =========================================================================
    // ABILITY SCORE CALCULATIONS
    // =========================================================================

    /**
     * Calculates the D&D-style modifier for an ability score.
     * Formula: floor((score - 10) / 2)
     * 
     * @param score - The ability score value (typically 1-20+)
     * @returns The modifier (-5 to +5 for typical scores)
     * 
     * @example
     * getAbilityScoreModifier(10) // returns 0
     * getAbilityScoreModifier(14) // returns +2
     * getAbilityScoreModifier(8)  // returns -1
     * getAbilityScoreModifier(18) // returns +4
     */
    getAbilityScoreModifier(score: number): number {
        return Math.floor((score - 10) / 2);
    }

    /**
     * Gets the modifier for a specific ability score by name.
     * 
     * @param ability - The ability score name
     * @returns The calculated modifier
     */
    getModifier(ability: keyof AbilityScores): number {
        return this.getAbilityScoreModifier(this.stats.abilityScores[ability]);
    }

    // =========================================================================
    // STAT CALCULATIONS (derived from ability scores + bonuses)
    // =========================================================================

    /**
     * Gets the total bonus from all equipment for a specific stat.
     * 
     * @param stat - The stat to get bonuses for
     * @returns Total bonus value from all equipped items
     * @private
     */
    private getEquipmentBonus(stat: keyof StatBonus): number {
        let bonus = 0;
        const slots: (Item | null)[] = [
            this.equipment.weapon,
            this.equipment.armor,
            this.equipment.accessory
        ];

        for (const item of slots) {
            if (item?.bonuses?.[stat]) {
                bonus += item.bonuses[stat]!;
            }
        }

        return bonus;
    }

    /**
     * Gets the total bonus from active buffs for a specific stat.
     * 
     * @param stat - The stat to get bonuses for
     * @returns Total bonus value from all active buffs
     * @private
     */
    private getBuffBonus(stat: keyof StatBonus): number {
        let bonus = 0;
        for (const buff of this.activeBuffs) {
            if (buff.bonuses[stat]) {
                bonus += buff.bonuses[stat]!;
            }
        }
        return bonus;
    }

    /**
     * Gets the total bonus from relics for a specific stat.
     * 
     * @param stat - The stat to get bonuses for
     * @returns Total bonus value from all relics with stat bonuses
     * @private
     */
    private getRelicBonus(stat: keyof StatBonus): number {
        let bonus = 0;
        for (const relic of this.relics) {
            if (relic.type === RelicType.STAT_BOOST && relic.statBonus?.[stat]) {
                bonus += relic.statBonus[stat]!;
            }
        }
        return bonus;
    }

    /**
     * Gets the attack bonus (modifier added to weapon damage roll).
     * Does NOT include weapon dice - those are rolled separately in combat.
     * 
     * Formula: STR mod + class bonus + equipment/buff/relic bonuses
     * 
     * @returns Attack bonus to add to weapon damage
     */
    getAttackBonus(): number {
        // Base attack from Strength modifier
        const strMod = this.getModifier('Strength');
        const classBonus = this.playerClass === PlayerClass.FIGHTER ? 2 : 0;
        let bonus = strMod + classBonus;

        // Add equipment bonuses (from items' attack stat, NOT weapon dice)
        bonus += this.getEquipmentBonus('attack');

        // Add buff bonuses
        bonus += this.getBuffBonus('attack');

        // Add relic bonuses
        bonus += this.getRelicBonus('attack');

        return bonus;
    }

    /**
     * Gets the effective attack power for display purposes.
     * Includes weapon damage dice average for UI stat display.
     * 
     * Formula: attack bonus + weapon damage average
     * 
     * @returns Total attack power (for display)
     */
    getAttackPower(): number {
        let attack = this.getAttackBonus();

        // Add weapon damage dice average (for display only)
        if (this.equipment.weapon?.damage) {
            attack += calculateAverageDamage(this.equipment.weapon.damage.dice);
        }

        return Math.floor(Math.max(1, attack)); // Minimum 1 attack
    }

    /**
     * Gets the spell attack bonus (modifier added to spell attack rolls).
     * Used for determining if spells hit (d20 + spell attack vs AC).
     * 
     * Formula: INT mod + level/2 (proficiency) + equipment/buff/relic bonuses
     * 
     * @returns Spell attack bonus to add to d20 roll
     */
    getSpellAttackBonus(): number {
        // Base spell attack from Intelligence modifier
        const intMod = this.getModifier('Intelligence');
        
        // Proficiency bonus scales with level (similar to D&D)
        const proficiencyBonus = Math.floor(this.level / 2) + 1;
        
        let bonus = intMod + proficiencyBonus;

        // Add equipment bonuses (spellPower affects spell attack)
        bonus += this.getEquipmentBonus('spellPower');

        // Add buff bonuses
        bonus += this.getBuffBonus('spellPower');

        // Add relic bonuses
        bonus += this.getRelicBonus('spellPower');

        return bonus;
    }

    /**
     * Gets the spell save DC (Difficulty Class) for status effects.
     * Targets must roll d20 + their ability modifier >= this DC to resist.
     * 
     * Formula: 8 + INT mod + proficiency (level/2 + 1)
     * 
     * @returns Spell save DC
     */
    getSpellSaveDC(): number {
        const intMod = this.getModifier('Intelligence');
        const proficiencyBonus = Math.floor(this.level / 2) + 1;
        return 8 + intMod + proficiencyBonus;
    }

    /**
     * Gets the physical save DC for status effects from physical abilities.
     * Uses STR modifier instead of INT.
     * 
     * Formula: 8 + STR mod + proficiency (level/2 + 1)
     * 
     * @returns Physical save DC
     */
    getPhysicalSaveDC(): number {
        const strMod = this.getModifier('Strength');
        const proficiencyBonus = Math.floor(this.level / 2) + 1;
        return 8 + strMod + proficiencyBonus;
    }

    /**
     * Gets the effective defense (AC) derived from Dexterity modifier.
     * Formula: 10 + DEX mod + armor class + equipment/buff/relic bonuses
     * 
     * @returns Total defense value
     */
    getDefense(): number {
        const dexMod = this.getModifier('Dexterity');
        let defense: number;

        // Check if wearing armor
        const armor = this.equipment.armor;
        if (armor?.armorClass) {
            // Armor provides base AC (replaces 10 + DEX)
            defense = armor.armorClass;
            
            // Add DEX bonus if armor allows it
            if (armor.dexBonus !== false) {
                // Some armor caps DEX bonus
                const maxDexBonus = armor.maxDexBonus ?? 99;
                defense += Math.min(dexMod, maxDexBonus);
            }
        } else {
            // Unarmored: 10 + DEX modifier
            defense = 10 + dexMod;
        }

        // Add defense bonuses from equipment (the +1/+2/+3 bonuses)
        defense += this.getEquipmentBonus('defense');

        // Add buff bonuses
        defense += this.getBuffBonus('defense');

        // Add relic bonuses
        defense += this.getRelicBonus('defense');

        return Math.max(0, defense);
    }

    /**
     * Gets effective max health derived from Constitution modifier.
     * Formula: baseHP + (hpPerLevel × level) + (CON mod × level × 0.5) + bonuses
     * 
     * Fighter: 20 base + 8 HP/level
     * Warlock: 15 base + 5 HP/level
     * 
     * @returns Total maximum health
     */
    getMaxHealth(): number {
        const conMod = this.getModifier('Constitution');
        
        // Class-specific base HP and per-level bonus
        // Fighter: 20 base + 8/level (tanky)
        // Blood Assassin: 18 base + 6/level (medium)
        // Zephyr: 14 base + 4/level (fragile but evasive)
        // Warlock: 15 base + 5/level (squishy)
        let baseHp: number;
        let hpPerLevel: number;
        
        switch (this.playerClass) {
            case PlayerClass.FIGHTER:
                baseHp = 20;
                hpPerLevel = 8;
                break;
            case PlayerClass.BLOOD_ASSASSIN:
                baseHp = 18;
                hpPerLevel = 6;
                break;
            case PlayerClass.ZEPHYR:
                baseHp = 14;
                hpPerLevel = 4;
                break;
            default: // WARLOCK and others
                baseHp = 15;
                hpPerLevel = 5;
        }
        
        // CON contributes at a reduced rate for smoother scaling
        const conBonus = Math.floor(conMod * this.level * 0.5);
        
        return baseHp + (hpPerLevel * this.level) + conBonus
            + this.getEquipmentBonus('maxHealth')
            + this.getBuffBonus('maxHealth')
            + this.getRelicBonus('maxHealth');
    }

    /**
     * Gets effective max mana derived from Intelligence modifier.
     * Formula: baseMP + (mpPerLevel × level) + (INT mod × level × 0.5) + bonuses
     * 
     * Fighter: 15 base + 2 MP/level
     * Warlock: 25 base + 6 MP/level
     * 
     * @returns Total maximum mana
     */
    getMaxMana(): number {
        const intMod = this.getModifier('Intelligence');
        
        // Class-specific base MP and per-level bonus
        // Warlock: 25 base + 6/level (high mana)
        // Zephyr: 22 base + 5/level (good mana for wind spells)
        // Blood Assassin: 20 base + 4/level (medium mana)
        // Fighter: 15 base + 2/level (low mana)
        let baseMp: number;
        let mpPerLevel: number;
        
        switch (this.playerClass) {
            case PlayerClass.WARLOCK:
                baseMp = 25;
                mpPerLevel = 6;
                break;
            case PlayerClass.ZEPHYR:
                baseMp = 22;
                mpPerLevel = 5;
                break;
            case PlayerClass.BLOOD_ASSASSIN:
                baseMp = 20;
                mpPerLevel = 4;
                break;
            default: // FIGHTER and others
                baseMp = 15;
                mpPerLevel = 2;
        }
        
        // INT contributes at a reduced rate for smoother scaling
        const intBonus = Math.floor(intMod * this.level * 0.5);
        
        return baseMp + (mpPerLevel * this.level) + intBonus
            + this.getEquipmentBonus('maxMana')
            + this.getBuffBonus('maxMana')
            + this.getRelicBonus('maxMana');
    }

    /**
     * Gets effective speed/initiative derived from Dexterity modifier.
     * Formula: 10 + DEX mod + bonuses
     * 
     * @returns Total speed value
     */
    getSpeed(): number {
        const dexMod = this.getModifier('Dexterity');
        const base = 10 + dexMod;
        
        return base
            + this.getEquipmentBonus('speed')
            + this.getBuffBonus('speed')
            + this.getRelicBonus('speed');
    }

    /**
     * Gets effective crit chance derived from Luck modifier.
     * Formula: 5% base + (LCK mod × 2%) + bonuses
     * 
     * @returns Total crit chance (0-100+)
     */
    getCritChance(): number {
        const lckMod = this.getModifier('Luck');
        const base = 5 + (lckMod * 2); // 5% base, +2% per luck mod
        
        return Math.max(0, base
            + this.getEquipmentBonus('critChance')
            + this.getBuffBonus('critChance')
            + this.getRelicBonus('critChance'));
    }

    /**
     * Gets effective crit multiplier derived from Luck modifier.
     * Formula: 1.5x base + (LCK mod × 0.1) + bonuses
     * 
     * @returns Total crit damage multiplier
     */
    getCritMultiplier(): number {
        const lckMod = this.getModifier('Luck');
        const base = 1.5 + (lckMod * 0.1); // 1.5x base, +0.1x per luck mod
        
        return base
            + (this.getEquipmentBonus('critMultiplier') ?? 0)
            + (this.getBuffBonus('critMultiplier') ?? 0)
            + (this.getRelicBonus('critMultiplier') ?? 0);
    }

    /**
     * Gets spell power for magic abilities (Warlock).
     * Uses the higher of Intelligence or Charisma modifier.
     * 
     * @returns Spell power modifier
     */
    getSpellPower(): number {
        const intMod = this.getModifier('Intelligence');
        const chaMod = this.getModifier('Charisma');
        return Math.max(intMod, chaMod);
    }

    // =========================================================================
    // ABILITIES (class + equipment + relics)
    // =========================================================================

    /**
     * Gets all available abilities (class abilities + equipment + relic granted abilities).
     * Equipment and relic abilities are merged with class abilities.
     * 
     * @returns Array of all available abilities
     */
    getAllAbilities(): Ability[] {
        const abilities: Ability[] = [...this.abilities];

        // Add abilities from equipment
        const slots: (Item | null)[] = [
            this.equipment.weapon,
            this.equipment.armor,
            this.equipment.accessory
        ];

        for (const item of slots) {
            if (item?.grantedAbility) {
                // Check if we already have this ability tracked
                const existingIndex = abilities.findIndex(a => a.id === item.grantedAbility!.id);
                if (existingIndex === -1) {
                    abilities.push({
                        ...item.grantedAbility,
                        currentCooldown: 0,
                        source: item.name
                    });
                }
            }
        }

        // Add abilities from relics
        for (const relic of this.relics) {
            if (relic.type === RelicType.ABILITY && relic.grantedAbility) {
                const existingIndex = abilities.findIndex(a => a.id === relic.grantedAbility!.id);
                if (existingIndex === -1) {
                    abilities.push({
                        ...relic.grantedAbility,
                        currentCooldown: 0,
                        source: relic.name
                    });
                }
            }
        }

        return abilities;
    }

    // =========================================================================
    // RELIC MANAGEMENT
    // =========================================================================

    /**
     * Adds a relic to the player's collection.
     * Applies immediate stat bonuses if applicable.
     * 
     * @param relic - The relic to add
     */
    addRelic(relic: Relic): void {
        this.relics.push(relic);

        // Apply immediate stat bonuses (health/mana increases)
        if (relic.type === RelicType.STAT_BOOST && relic.statBonus) {
            // If the relic grants max health, also heal for that amount
            if (relic.statBonus.maxHealth) {
                this.stats.health = Math.min(
                    this.stats.health + relic.statBonus.maxHealth,
                    this.getMaxHealth()
                );
            }
            // If the relic grants max mana, also restore that amount
            if (relic.statBonus.maxMana) {
                this.stats.mana = Math.min(
                    this.stats.mana + relic.statBonus.maxMana,
                    this.getMaxMana()
                );
            }
        }
    }

    /**
     * Gets all passive effects from relics.
     * 
     * @returns Array of all passive effects
     */
    getPassiveEffects(): PassiveEffect[] {
        return this.relics
            .filter(r => r.type === RelicType.PASSIVE && r.passiveEffect)
            .map(r => r.passiveEffect!);
    }

    /**
     * Gets all combat modifiers from relics.
     * 
     * @returns Array of all combat modifiers
     */
    getCombatModifiers(): CombatModifier[] {
        return this.relics
            .filter(r => r.type === RelicType.COMBAT_MODIFIER && r.combatModifier)
            .map(r => r.combatModifier!);
    }

    /**
     * Checks if the player has a specific passive effect.
     * 
     * @param effectType - The type of passive effect to check for
     * @returns The passive effect if found, undefined otherwise
     */
    hasPassiveEffect(effectType: PassiveEffectType): PassiveEffect | undefined {
        return this.getPassiveEffects().find(e => e.type === effectType);
    }

    /**
     * Gets the total value of a specific passive effect type.
     * Combines values from multiple relics with the same effect.
     * 
     * @param effectType - The type of passive effect
     * @returns Total value of the effect
     */
    getPassiveEffectValue(effectType: PassiveEffectType): number {
        return this.getPassiveEffects()
            .filter(e => e.type === effectType)
            .reduce((sum, e) => sum + e.value, 0);
    }

    /**
     * Processes start-of-turn passive effects (health/mana regen).
     * Should be called at the start of each turn.
     * 
     * @returns Object describing what happened
     */
    processPassiveEffects(): { healthRegen: number; manaRegen: number } {
        let healthRegen = 0;
        let manaRegen = 0;

        // Health regeneration
        const healthRegenEffect = this.getPassiveEffectValue(PassiveEffectType.HEALTH_REGEN);
        if (healthRegenEffect > 0 && this.stats.health < this.getMaxHealth()) {
            healthRegen = Math.min(healthRegenEffect, this.getMaxHealth() - this.stats.health);
            this.stats.health += healthRegen;
        }

        // Mana regeneration
        const manaRegenEffect = this.getPassiveEffectValue(PassiveEffectType.MANA_REGEN);
        if (manaRegenEffect > 0 && this.stats.mana < this.getMaxMana()) {
            manaRegen = Math.min(manaRegenEffect, this.getMaxMana() - this.stats.mana);
            this.stats.mana += manaRegen;
        }

        return { healthRegen, manaRegen };
    }

    /**
     * Gets IDs of all owned relics (for exclusion when generating new ones).
     * 
     * @returns Array of relic base IDs (without instance suffix)
     */
    getOwnedRelicBaseIds(): string[] {
        return this.relics.map(r => r.id.split('-')[0] + '_' + r.id.split('_').slice(1).join('_').split('-')[0]);
    }

    // =========================================================================
    // ON-HIT EFFECTS
    // =========================================================================

    /**
     * Processes on-hit effects from equipped items.
     * Uses seeded RNG for reproducible results.
     * 
     * @returns Array of triggered on-hit effects
     */
    processOnHitEffects(): OnHitResult[] {
        const results: OnHitResult[] = [];

        const slots: (Item | null)[] = [
            this.equipment.weapon,
            this.equipment.accessory
        ];

        for (const item of slots) {
            if (item?.onHit) {
                const triggered = isRNGInitialized()
                    ? getRNG().percentChance(item.onHit.chance)
                    : Math.random() * 100 < item.onHit.chance;

                if (triggered) {
                    results.push({
                        type: item.onHit.type,
                        value: item.onHit.value,
                        duration: item.onHit.duration
                    });
                }
            }
        }

        return results;
    }

    // =========================================================================
    // HEALTH & MANA
    // =========================================================================

    /**
     * Checks if the player is alive.
     * 
     * @returns true if health is greater than 0
     */
    isAlive(): boolean {
        return this.stats.health > 0;
    }

    /**
     * Applies damage to the player after defense reduction.
     * Used for traps, events, and other non-combat damage sources.
     * Damage reduction: (defense - 10) / 2, capped at 5.
     * Defense 10 = 0 reduction, Defense 20+ = 5 reduction (max).
     * 
     * @param amount - Raw damage amount before reduction
     * @returns Actual damage taken after defense
     */
    takeDamage(amount: number): number {
        if (amount <= 0) return 0;
        const defense = this.getDefense();
        // Same formula as combat engine: (defense - 10) / 2, capped at 5
        const damageReduction = Math.min(5, Math.max(0, Math.floor((defense - 10) / 2)));
        const actualDamage = Math.max(1, amount - damageReduction);

        this.stats.health = Math.max(0, this.stats.health - actualDamage);
        return actualDamage;
    }

    /**
     * Applies damage directly to the player without defense reduction.
     * Used by combat engine where reduction is already calculated.
     * 
     * @param amount - Final damage amount (already reduced)
     * @returns Actual damage taken
     */
    takeDamageRaw(amount: number): number {
        if (amount <= 0) return 0;
        const actualDamage = Math.max(1, amount);
        this.stats.health = Math.max(0, this.stats.health - actualDamage);
        return actualDamage;
    }

    /**
     * Heals the player, capped at max health.
     * 
     * @param amount - Amount to heal
     * @returns Actual amount healed
     */
    heal(amount: number): number {
        if (amount <= 0) return 0;
        const previousHealth = this.stats.health;
        const maxHealth = this.getMaxHealth();
        this.stats.health = Math.min(maxHealth, this.stats.health + amount);
        return this.stats.health - previousHealth;
    }

    /**
     * Restores mana, capped at max mana.
     * 
     * @param amount - Amount to restore
     * @returns Actual amount restored
     */
    restoreMana(amount: number): number {
        if (amount <= 0) return 0;
        const previousMana = this.stats.mana;
        const maxMana = this.getMaxMana();
        this.stats.mana = Math.min(maxMana, this.stats.mana + amount);
        return this.stats.mana - previousMana;
    }

    /**
     * Attempts to use mana for an ability.
     * 
     * @param amount - Mana cost
     * @returns true if mana was spent, false if insufficient
     */
    useMana(amount: number): boolean {
        if (this.stats.mana < amount) {
            return false;
        }
        this.stats.mana -= amount;
        return true;
    }

    // =========================================================================
    // BUFFS
    // =========================================================================

    /**
     * Applies a temporary buff to the player.
     * If the buff already exists, refreshes the duration.
     * 
     * @param name - Buff display name
     * @param bonuses - Stat bonuses to apply
     * @param duration - Duration in turns
     */
    applyBuff(name: string, bonuses: StatBonus, duration: number): void {
        // Check if buff already exists, refresh duration if so
        const existing = this.activeBuffs.find(b => b.name === name);
        if (existing) {
            existing.remainingTurns = Math.max(existing.remainingTurns, duration);
            return;
        }

        this.activeBuffs.push({ name, bonuses, remainingTurns: duration });
    }

    /**
     * Ticks down buff durations and removes expired buffs.
     * Called at end of turn.
     */
    tickBuffs(): void {
        for (let i = this.activeBuffs.length - 1; i >= 0; i--) {
            this.activeBuffs[i].remainingTurns--;
            if (this.activeBuffs[i].remainingTurns <= 0) {
                this.activeBuffs.splice(i, 1);
            }
        }
    }

    // =========================================================================
    // EXPERIENCE & LEVELING
    // =========================================================================

    /**
     * Adds experience and handles level ups.
     * Player is fully healed on level up.
     * 
     * @param amount - Experience points to add
     * @returns Object with levels gained and new level
     */
    addExperience(amount: number): { levelsGained: number; newLevel: number } {
        this.experience += amount;
        let levelsGained = 0;

        while (this.level < MAX_LEVEL && this.experience >= XP_PER_LEVEL[this.level]) {
            this.levelUp();
            levelsGained++;
        }

        return { levelsGained, newLevel: this.level };
    }

    /** Maximum ability score value (D&D-style cap) */
    private static readonly ABILITY_SCORE_CAP = 20;

    /**
     * Levels up the player, applying ability score growth.
     * All derived stats (HP, MP, attack, defense, etc.) are automatically
     * recalculated since they're based on ability scores and level.
     * Ability scores are capped at 20.
     * @private
     */
    private levelUp(): void {
        this.level++;
        
        // Apply ability score growth every other level (even levels), capped at 20
        if (this.level % 2 === 0) {
            const growth = CLASS_ABILITY_GROWTH[this.playerClass];
            const scores = this.stats.abilityScores;
            const cap = Player.ABILITY_SCORE_CAP;
            
            if (growth.Strength && scores.Strength < cap) {
                scores.Strength = Math.min(cap, scores.Strength + growth.Strength);
            }
            if (growth.Dexterity && scores.Dexterity < cap) {
                scores.Dexterity = Math.min(cap, scores.Dexterity + growth.Dexterity);
        }
            if (growth.Constitution && scores.Constitution < cap) {
                scores.Constitution = Math.min(cap, scores.Constitution + growth.Constitution);
            }
            if (growth.Intelligence && scores.Intelligence < cap) {
                scores.Intelligence = Math.min(cap, scores.Intelligence + growth.Intelligence);
            }
            if (growth.Wisdom && scores.Wisdom < cap) {
                scores.Wisdom = Math.min(cap, scores.Wisdom + growth.Wisdom);
        }
            if (growth.Charisma && scores.Charisma < cap) {
                scores.Charisma = Math.min(cap, scores.Charisma + growth.Charisma);
            }
            if (growth.Luck && scores.Luck < cap) {
                scores.Luck = Math.min(cap, scores.Luck + growth.Luck);
            }
        }

        // Full heal on level up (derived stats auto-update via getters)
        this.stats.health = this.getMaxHealth();
        this.stats.mana = this.getMaxMana();
    }

    /**
     * Gets experience needed for next level.
     * 
     * @returns XP remaining until next level, or 0 if max level
     */
    getExperienceToNextLevel(): number {
        if (this.level >= MAX_LEVEL) return 0;
        return XP_PER_LEVEL[this.level] - this.experience;
    }

    // =========================================================================
    // GOLD
    // =========================================================================

    /**
     * Adds gold to the player.
     * 
     * @param amount - Gold to add (must be positive)
     */
    addGold(amount: number): void {
        if (amount <= 0) return;
        this.gold += amount;
    }

    /**
     * Attempts to spend gold.
     * 
     * @param amount - Gold to spend
     * @returns true if gold was spent, false if insufficient
     */
    spendGold(amount: number): boolean {
        if (this.gold < amount) {
            return false;
        }
        this.gold -= amount;
        return true;
    }

    // =========================================================================
    // EQUIPMENT & INVENTORY
    // =========================================================================

    /**
     * Equips an item to the appropriate slot.
     * The previous item (if any) is moved to inventory.
     * 
     * @param item - Item to equip
     * @returns The previously equipped item, or null
     */
    equipItem(item: Item): Item | null {
        if (item.slot === ItemSlot.NONE || item.slot === ItemSlot.CONSUMABLE) {
            return null; // Can't equip these
        }

        let previousItem: Item | null = null;

        switch (item.slot) {
            case ItemSlot.WEAPON:
                previousItem = this.equipment.weapon;
                this.equipment.weapon = item;
                break;
            case ItemSlot.ARMOR:
                previousItem = this.equipment.armor;
                this.equipment.armor = item;
                break;
            case ItemSlot.ACCESSORY:
                previousItem = this.equipment.accessory;
                this.equipment.accessory = item;
                break;
        }

        // Remove from inventory if present
        const index = this.inventory.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.inventory.splice(index, 1);
        }

        // Add previous item to inventory if it exists
        if (previousItem) {
            this.inventory.push(previousItem);
        }

        return previousItem;
    }

    /**
     * Unequips an item from a slot and moves it to inventory.
     * 
     * @param slot - The slot to unequip
     * @returns The unequipped item, or null if slot was empty
     */
    unequipSlot(slot: ItemSlot): Item | null {
        let item: Item | null = null;

        switch (slot) {
            case ItemSlot.WEAPON:
                item = this.equipment.weapon;
                this.equipment.weapon = null;
                break;
            case ItemSlot.ARMOR:
                item = this.equipment.armor;
                this.equipment.armor = null;
                break;
            case ItemSlot.ACCESSORY:
                item = this.equipment.accessory;
                this.equipment.accessory = null;
                break;
        }

        if (item) {
            this.inventory.push(item);
        }

        return item;
    }

    /**
     * Uses a consumable item from inventory.
     * Applies healing, mana restore, and/or buffs.
     * 
     * @param item - The consumable item to use
     * @returns true if item was used, false if invalid or not in inventory
     */
    useConsumable(item: Item): boolean {
        if (item.type !== ItemType.CONSUMABLE || !item.consumeEffect) {
            return false;
        }

        const index = this.inventory.findIndex(i => i.id === item.id);
        if (index === -1) {
            return false;
        }

        const effect = item.consumeEffect;

        // Apply healing
        if (effect.healing) {
            const healAmount = rollDice(effect.healing.dice) + effect.healing.bonus;
            this.heal(healAmount);
        }

        // Apply mana restore
        if (effect.manaRestore) {
            this.restoreMana(effect.manaRestore);
        }

        // Apply temporary buff
        if (effect.buff && effect.buffDuration) {
            this.applyBuff(item.name, effect.buff, effect.buffDuration);
        }

        // Remove from inventory
        this.inventory.splice(index, 1);
        return true;
    }

    /**
     * Adds an item to the inventory.
     * 
     * @param item - Item to add
     */
    addToInventory(item: Item): void {
        this.inventory.push(item);
    }

    /**
     * Removes an item from inventory by ID.
     * 
     * @param itemId - ID of item to remove
     * @returns The removed item, or null if not found
     */
    removeFromInventory(itemId: string): Item | null {
        const index = this.inventory.findIndex(i => i.id === itemId);
        if (index === -1) return null;
        return this.inventory.splice(index, 1)[0];
    }

    /**
     * Gets inventory items filtered by type.
     * 
     * @param type - ItemType to filter by
     * @returns Array of matching items
     */
    getInventoryByType(type: ItemType): Item[] {
        return this.inventory.filter(item => item.type === type);
    }

    // =========================================================================
    // COMBAT
    // =========================================================================

    /**
     * Performs a basic attack.
     * Rolls weapon dice + attack bonus, with crit chance.
     * Uses seeded RNG for dice rolls and crit determination.
     * 
     * @returns Object with damage, crit status, and on-hit effects
     */
    basicAttack(): { damage: number; isCrit: boolean; onHitEffects: OnHitResult[] } {
        const attackBonus = this.getAttackBonus();
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        // Roll weapon dice or 1d4 for unarmed
        const weaponDice = this.equipment.weapon?.damage?.dice ?? '1d4';
        const weaponDamage = rollDice(weaponDice);
        
        // Base damage = weapon roll + attack bonus
        let damage = weaponDamage + attackBonus;

        // Check for crit
        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        
        if (isCrit) {
            damage = Math.floor(damage * critMultiplier);
        }

        const onHitEffects = this.processOnHitEffects();

        return { damage: Math.max(1, damage), isCrit, onHitEffects };
    }

    /**
     * Uses an ability by ID.
     * Checks mana cost and cooldown.
     * 
     * @param abilityId - ID of ability to use
     * @returns The ability if used, null if unavailable
     */
    useAbility(abilityId: string): Ability | null {
        // Check class abilities first
        let ability = this.abilities.find(a => a.id === abilityId);

        // Check equipment abilities if not found
        if (!ability) {
            const allAbilities = this.getAllAbilities();
            ability = allAbilities.find(a => a.id === abilityId);
        }

        if (!ability) return null;
        if (ability.currentCooldown > 0) return null;
        if (!this.useMana(ability.manaCost)) return null;

        ability.currentCooldown = ability.cooldown;
        return ability;
    }

    /**
     * Reduces all ability cooldowns by 1.
     * Called at start of player's turn.
     * Ticks both class abilities and item-granted abilities.
     */
    tickCooldowns(): void {
        // Tick class abilities
        for (const ability of this.abilities) {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown--;
            }
        }

        // Tick item-granted abilities from equipment
        const equippedItems: (Item | null)[] = [
            this.equipment.weapon,
            this.equipment.armor,
            this.equipment.accessory
        ];

        for (const item of equippedItems) {
            if (item?.grantedAbility && item.grantedAbility.currentCooldown > 0) {
                item.grantedAbility.currentCooldown--;
            }
        }
    }

    /**
     * Turn processing - ticks cooldowns and buffs.
     * Called at start of player's combat turn.
     */
    endTurn(): void {
        this.tickCooldowns();
        this.tickBuffs();
    }

    // =========================================================================
    // REST & RECOVERY
    // =========================================================================

    /**
     * Rests at a rest room - fully restores health and mana.
     * Also resets all cooldowns and clears buffs.
     */
    rest(): void {
        this.stats.health = this.getMaxHealth();
        this.stats.mana = this.getMaxMana();

        // Reset all cooldowns
        for (const ability of this.abilities) {
            ability.currentCooldown = 0;
        }

        // Clear all buffs (they don't persist through rest)
        this.activeBuffs = [];
    }

    // =========================================================================
    // SERIALIZATION
    // =========================================================================

    /**
     * Serializes the player to a JSON-compatible object.
     * 
     * @returns PlayerJSON object for save/load
     */
    toJSON(): PlayerJSON {
        return {
            id: this.id,
            name: this.name,
            playerClass: this.playerClass,
            level: this.level,
            experience: this.experience,
            gold: this.gold,
            stats: { ...this.stats },
            equipment: {
                weapon: this.equipment.weapon?.id ?? null,
                armor: this.equipment.armor?.id ?? null,
                accessory: this.equipment.accessory?.id ?? null
            },
            inventory: this.inventory.map(item => item.id),
            abilities: this.abilities.map(a => ({ ...a })),
            activeBuffs: this.activeBuffs.map(b => ({ ...b }))
        };
    }
}
