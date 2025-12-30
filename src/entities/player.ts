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
    WARLOCK = 'warlock'
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
 * Base stats for a player character.
 * These values are modified by equipment, buffs, and level.
 * @interface
 */
export interface PlayerStats {
    /** Maximum health points */
    maxHealth: number;
    /** Current health points */
    health: number;
    /** Base attack power (modified by weapon and class) */
    attack: number;
    /** Base defense (modified by armor and class) */
    defense: number;
    /** Current mana/resource pool for abilities */
    mana: number;
    /** Maximum mana */
    maxMana: number;
    /** Speed/initiative for turn order */
    speed: number;
    /** Critical hit chance (0-100) */
    critChance: number;
    /** Critical hit damage multiplier (e.g., 1.5 = 150% damage) */
    critMultiplier: number;
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

/**
 * Class-specific or equipment-granted ability.
 * Abilities are special actions that cost mana and may have cooldowns.
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
    /** Damage dealt (if applicable) */
    damage?: number;
    /** Healing provided (if applicable) */
    healing?: number;
    /** Special effect type */
    effect?: string;
    /** Source of the ability ('class' or item name) */
    source?: string;
    /** Whether this ability hits all enemies */
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
 * Base stat configurations per class.
 * @const
 */
const CLASS_BASE_STATS: Record<PlayerClass, PlayerStats> = {
    [PlayerClass.FIGHTER]: {
        maxHealth: 120,
        health: 120,
        attack: 14,
        defense: 10,
        mana: 30,
        maxMana: 30,
        speed: 25,
        critChance: 15,
        critMultiplier: 1.75
    },
    [PlayerClass.WARLOCK]: {
        maxHealth: 80,
        health: 80,
        attack: 6,
        defense: 6,
        mana: 100,
        maxMana: 100,
        speed: 20,
        critChance: 10,
        critMultiplier: 1.75
    }
};

/**
 * Stat growth per level per class.
 * @const
 */
const CLASS_STAT_GROWTH: Record<PlayerClass, Partial<PlayerStats>> = {
    [PlayerClass.FIGHTER]: {
        maxHealth: 15,
        attack: 2,
        defense: 2,
        mana: 5,
        maxMana: 5,
        speed: 1,
        critChance: 0.5
    },
    [PlayerClass.WARLOCK]: {
        maxHealth: 8,
        attack: 1,
        defense: 1,
        mana: 15,
        maxMana: 15,
        speed: 1,
        critChance: 1
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
        this.stats = { ...CLASS_BASE_STATS[playerClass] };
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
    // STAT CALCULATIONS (with equipment and buff bonuses)
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
     * Gets the effective attack power including equipment, buff, and relic bonuses.
     * Includes weapon damage dice average.
     * 
     * @returns Total attack power
     */
    getAttackPower(): number {
        let attack = this.stats.attack;

        // Add weapon damage dice average
        if (this.equipment.weapon?.damage) {
            attack += calculateAverageDamage(this.equipment.weapon.damage.dice);
        }

        // Add equipment bonuses
        attack += this.getEquipmentBonus('attack');

        // Add buff bonuses
        attack += this.getBuffBonus('attack');

        // Add relic bonuses
        attack += this.getRelicBonus('attack');

        return Math.floor(attack);
    }

    /**
     * Gets the effective defense including equipment, buff, and relic bonuses.
     * Includes armor class from equipped armor.
     * 
     * @returns Total defense value
     */
    getDefense(): number {
        let defense = this.stats.defense;

        // Add armor class from armor
        if (this.equipment.armor?.armorClass) {
            defense += this.equipment.armor.armorClass;
        }

        // Add equipment bonuses
        defense += this.getEquipmentBonus('defense');

        // Add buff bonuses
        defense += this.getBuffBonus('defense');

        // Add relic bonuses
        defense += this.getRelicBonus('defense');

        return defense;
    }

    /**
     * Gets effective max health including equipment, buff, and relic bonuses.
     * 
     * @returns Total maximum health
     */
    getMaxHealth(): number {
        return this.stats.maxHealth
            + this.getEquipmentBonus('maxHealth')
            + this.getBuffBonus('maxHealth')
            + this.getRelicBonus('maxHealth');
    }

    /**
     * Gets effective max mana including equipment, buff, and relic bonuses.
     * 
     * @returns Total maximum mana
     */
    getMaxMana(): number {
        return this.stats.maxMana
            + this.getEquipmentBonus('maxMana')
            + this.getBuffBonus('maxMana')
            + this.getRelicBonus('maxMana');
    }

    /**
     * Gets effective speed including equipment, buff, and relic bonuses.
     * 
     * @returns Total speed value
     */
    getSpeed(): number {
        return this.stats.speed
            + this.getEquipmentBonus('speed')
            + this.getBuffBonus('speed')
            + this.getRelicBonus('speed');
    }

    /**
     * Gets effective crit chance including equipment, buff, and relic bonuses.
     * 
     * @returns Total crit chance (0-100+)
     */
    getCritChance(): number {
        return this.stats.critChance
            + this.getEquipmentBonus('critChance')
            + this.getBuffBonus('critChance')
            + this.getRelicBonus('critChance');
    }

    /**
     * Gets effective crit multiplier including equipment, buff, and relic bonuses.
     * 
     * @returns Total crit damage multiplier
     */
    getCritMultiplier(): number {
        return this.stats.critMultiplier
            + (this.getEquipmentBonus('critMultiplier') ?? 0)
            + (this.getBuffBonus('critMultiplier') ?? 0)
            + (this.getRelicBonus('critMultiplier') ?? 0);
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
     * Damage is reduced by floor(defense/2), minimum 1 damage.
     * 
     * @param amount - Raw damage amount before reduction
     * @returns Actual damage taken after defense
     */
    takeDamage(amount: number): number {
        if (amount <= 0) amount = 0;
        const defense = this.getDefense();
        const damageReduction = Math.floor(defense / 2);
        const actualDamage = Math.max(1, amount - damageReduction);

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

    /**
     * Levels up the player, applying stat growth.
     * @private
     */
    private levelUp(): void {
        this.level++;
        const growth = CLASS_STAT_GROWTH[this.playerClass];

        // Apply stat growth
        if (growth.maxHealth) {
            this.stats.maxHealth += growth.maxHealth;
            this.stats.health += growth.maxHealth;
        }
        if (growth.attack) this.stats.attack += growth.attack;
        if (growth.defense) this.stats.defense += growth.defense;
        if (growth.mana) {
            this.stats.maxMana += growth.mana;
            this.stats.mana += growth.mana;
        }
        if (growth.maxMana) this.stats.maxMana += growth.maxMana;
        if (growth.speed) this.stats.speed += growth.speed;
        if (growth.critChance) this.stats.critChance += growth.critChance;

        // Full heal on level up
        this.stats.health = this.stats.maxHealth;
        this.stats.mana = this.stats.maxMana;
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
     * Uses seeded RNG for crit determination.
     * 
     * @returns Object with damage, crit status, and on-hit effects
     */
    basicAttack(): { damage: number; isCrit: boolean; onHitEffects: OnHitResult[] } {
        const attackPower = this.getAttackPower();
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const damage = isCrit
            ? Math.floor(attackPower * critMultiplier)
            : attackPower;

        const onHitEffects = this.processOnHitEffects();

        return { damage, isCrit, onHitEffects };
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
     * Called at end of turn.
     */
    tickCooldowns(): void {
        for (const ability of this.abilities) {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown--;
            }
        }
    }

    /**
     * End of turn processing.
     * Ticks cooldowns and buffs.
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
