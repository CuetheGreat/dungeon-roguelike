/**
 * @fileoverview Warlock Class Implementation for Dungeon Roguelike
 * 
 * The Warlock is a magic-focused spellcaster class with:
 * - Large mana pool for sustained spellcasting
 * - High damage spells
 * - Life drain and utility abilities
 * - Soul Shard mechanic for empowering abilities
 * 
 * @module entities/warlock
 */

import { Player, PlayerClass, PlayerJSON } from './player';
import { Item } from './item';
import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Warlock class - magic-focused spellcaster with powerful abilities.
 * 
 * **Strengths:**
 * - Large mana pool (100)
 * - High damage spells
 * - Life drain and utility abilities
 * - Higher crit multiplier (1.75x)
 * - Soul Shard mechanic for bonus damage
 * 
 * **Weaknesses:**
 * - Low health (80) and defense (6)
 * - Relies on mana management
 * - Weaker basic attacks
 * 
 * **Abilities:**
 * - Eldritch Blast: Magic damage (8 mana, 1 turn CD)
 * - Drain Life: Damage + 50% lifesteal (20 mana, 3 turn CD)
 * - Hex: +25% damage taken debuff for 3 turns (15 mana, 4 turn CD)
 * - Shadow Bolt: High damage + soul shard bonus (25 mana, 2 turn CD)
 * - Dark Pact: Sacrifice 20% HP for 40% mana (0 mana, 5 turn CD)
 * - Soul Harvest: Consume shards for massive damage (35 mana, 6 turn CD)
 * 
 * **Soul Shards:**
 * - Gain 1 shard when killing an enemy (max 3)
 * - Shadow Bolt consumes all shards for +10 damage each
 * - Soul Harvest consumes all shards for 20+ damage per shard
 * 
 * @extends Player
 * 
 * @example
 * ```typescript
 * const warlock = new Warlock('Gul\'dan');
 * 
 * // Basic spell
 * const blast = warlock.eldritchBlast();
 * 
 * // Life drain
 * const drain = warlock.drainLife();
 * 
 * // Soul shard mechanics
 * warlock.gainSoulShard(); // On enemy kill
 * const bolt = warlock.shadowBolt(); // Consumes shards
 * ```
 */
export class Warlock extends Player {
    /** Current number of soul shards (0-3) */
    public soulShards: number = 0;
    
    /** Maximum soul shards that can be held */
    public readonly maxSoulShards: number = 3;

    /**
     * Creates a new Warlock with the specified name.
     * 
     * @param name - The warlock's display name
     */
    constructor(name: string) {
        super(name, PlayerClass.WARLOCK);
    }

    /**
     * Initializes Warlock-specific abilities.
     * @protected
     */
    protected initializeAbilities(): void {
        this.abilities = [
            {
                id: 'eldritch_blast',
                name: 'Eldritch Blast',
                description: 'Fire a beam of crackling energy, dealing magic damage.',
                manaCost: 8,
                cooldown: 1,
                currentCooldown: 0,
                damage: 12,
                source: 'class'
            },
            {
                id: 'drain_life',
                name: 'Drain Life',
                description: 'Siphon life from an enemy, dealing damage and healing yourself for 50% of damage dealt.',
                manaCost: 20,
                cooldown: 3,
                currentCooldown: 0,
                damage: 12,
                effect: 'lifesteal',
                source: 'class'
            },
            {
                id: 'hex',
                name: 'Hex',
                description: 'Curse an enemy, increasing damage they take by 25% for 3 turns.',
                manaCost: 15,
                cooldown: 4,
                currentCooldown: 0,
                effect: 'debuff',
                source: 'class'
            },
            {
                id: 'shadow_bolt',
                name: 'Shadow Bolt',
                description: 'Hurl a bolt of shadow energy. Consumes soul shards for bonus damage.',
                manaCost: 25,
                cooldown: 2,
                currentCooldown: 0,
                damage: 25,
                source: 'class'
            },
            {
                id: 'dark_pact',
                name: 'Dark Pact',
                description: 'Sacrifice 20% of current health to restore 40% of max mana.',
                manaCost: 0,
                cooldown: 5,
                currentCooldown: 0,
                effect: 'mana_restore',
                source: 'class'
            },
            {
                id: 'soul_harvest',
                name: 'Soul Harvest',
                description: 'Passive: Killing an enemy grants a soul shard (max 3). Active: Consume all shards to deal massive damage.',
                manaCost: 35,
                cooldown: 6,
                currentCooldown: 0,
                damage: 20, // Per shard
                effect: 'consume_shards',
                source: 'class'
            }
        ];
    }

    /**
     * Gains a soul shard (called when enemy is killed).
     * Soul shards are used to empower Shadow Bolt and Soul Harvest.
     * 
     * @returns true if shard was gained, false if already at max
     */
    gainSoulShard(): boolean {
        if (this.soulShards < this.maxSoulShards) {
            this.soulShards++;
            return true;
        }
        return false;
    }

    /**
     * Executes Eldritch Blast - basic magic attack.
     * Deals 12 base damage + 1.5 per level, can crit.
     * Uses seeded RNG for crit determination.
     * 
     * @returns Object with damage dealt and crit status, or null if ability unavailable
     */
    eldritchBlast(): { damage: number; isCrit: boolean } | null {
        const ability = this.useAbility('eldritch_blast');
        if (!ability) return null;

        const baseDamage = ability.damage ?? 15;
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const damage = isCrit 
            ? Math.floor(baseDamage * critMultiplier)
            : baseDamage;

        // Scale with level
        const scaledDamage = damage + Math.floor(this.level * 1.5);

        return { damage: scaledDamage, isCrit };
    }

    /**
     * Executes Drain Life - damage + heal.
     * Deals 12 base damage + 1.2 per level, heals for 50% of damage dealt.
     * Uses seeded RNG for crit determination.
     * 
     * @returns Object with damage dealt and amount healed, or null if ability unavailable
     */
    drainLife(): { damage: number; healed: number } | null {
        const ability = this.useAbility('drain_life');
        if (!ability) return null;

        const baseDamage = (ability.damage ?? 12) + Math.floor(this.level * 1.2);
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const damage = isCrit 
            ? Math.floor(baseDamage * critMultiplier)
            : baseDamage;

        const healed = this.heal(Math.floor(damage * 0.5));

        return { damage, healed };
    }

    /**
     * Executes Hex - applies damage vulnerability debuff to enemy.
     * Target takes 25% more damage for 3 turns.
     * 
     * @returns Object with damage increase percentage and duration, or null if ability unavailable
     */
    hex(): { damageIncrease: number; duration: number } | null {
        const ability = this.useAbility('hex');
        if (!ability) return null;

        return { damageIncrease: 0.25, duration: 3 };
    }

    /**
     * Executes Shadow Bolt - consumes soul shards for bonus damage.
     * Deals 25 base damage + 2 per level + 10 per soul shard consumed.
     * Uses seeded RNG for crit determination.
     * 
     * @returns Object with damage, crit status, and shards consumed, or null if ability unavailable
     */
    shadowBolt(): { damage: number; isCrit: boolean; shardsConsumed: number } | null {
        const ability = this.useAbility('shadow_bolt');
        if (!ability) return null;

        const baseDamage = (ability.damage ?? 25) + Math.floor(this.level * 2);
        
        // Bonus damage per soul shard
        const shardBonus = this.soulShards * 10;
        const shardsConsumed = this.soulShards;
        this.soulShards = 0;

        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const totalDamage = baseDamage + shardBonus;
        const damage = isCrit 
            ? Math.floor(totalDamage * critMultiplier)
            : totalDamage;

        return { damage, isCrit, shardsConsumed };
    }

    /**
     * Executes Dark Pact - sacrifice health for mana.
     * Sacrifices 20% of current health to restore 40% of max mana.
     * Cannot be used if it would kill the warlock.
     * 
     * @returns Object with health lost and mana restored, or null if ability unavailable or would kill
     */
    darkPact(): { healthLost: number; manaRestored: number } | null {
        const ability = this.useAbility('dark_pact');
        if (!ability) return null;

        const healthCost = Math.floor(this.stats.health * 0.2);
        const manaRestore = Math.floor(this.getMaxMana() * 0.4);

        // Can't kill yourself with Dark Pact
        if (this.stats.health <= healthCost) {
            return null;
        }

        this.stats.health -= healthCost;
        const actualManaRestored = this.restoreMana(manaRestore);

        return { healthLost: healthCost, manaRestored: actualManaRestored };
    }

    /**
     * Executes Soul Harvest - consume all shards for massive damage.
     * Deals (20 + 3 per level) damage per soul shard consumed.
     * Requires at least 1 soul shard to use.
     * 
     * @returns Object with total damage and shards consumed, or null if no shards or ability unavailable
     */
    soulHarvest(): { damage: number; shardsConsumed: number } | null {
        if (this.soulShards === 0) return null;

        const ability = this.useAbility('soul_harvest');
        if (!ability) return null;

        const damagePerShard = (ability.damage ?? 20) + Math.floor(this.level * 3);
        const damage = damagePerShard * this.soulShards;
        const shardsConsumed = this.soulShards;

        this.soulShards = 0;

        return { damage, shardsConsumed };
    }

    /**
     * Warlock passive: Mana regeneration on basic attacks.
     * Restores 3 mana per basic attack.
     * 
     * @returns Basic attack result with on-hit effects
     */
    override basicAttack(): { damage: number; isCrit: boolean; onHitEffects: import('./player').OnHitResult[] } {
        const result = super.basicAttack();
        
        // Restore small amount of mana on basic attack
        this.restoreMana(3);

        return result;
    }

    /**
     * Serializes the warlock to JSON, including soul shards.
     * 
     * @returns PlayerJSON object extended with soulShards
     */
    override toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            soulShards: this.soulShards
        };
    }

    /**
     * Deserializes a Warlock from JSON data.
     * 
     * @param data - The serialized PlayerJSON data (with soulShards extension)
     * @param itemLookup - Map of item IDs to Item objects for restoring equipment/inventory
     * @returns A fully restored Warlock instance
     * 
     * @example
     * ```typescript
     * const savedData = JSON.parse(saveFile);
     * const items = new Map<string, Item>();
     * // ... populate items map ...
     * const warlock = Warlock.fromJSON(savedData, items);
     * ```
     */
    static fromJSON(data: PlayerJSON & { soulShards?: number }, itemLookup: Map<string, Item>): Warlock {
        const warlock = new Warlock(data.name);
        
        // Restore basic properties
        warlock.level = data.level;
        warlock.experience = data.experience;
        warlock.gold = data.gold;
        warlock.stats = { ...data.stats };
        
        // Restore soul shards (warlock-specific)
        warlock.soulShards = data.soulShards ?? 0;
        
        // Restore equipment from itemLookup
        if (data.equipment.weapon) {
            const weapon = itemLookup.get(data.equipment.weapon);
            if (weapon) warlock.equipment.weapon = weapon;
        }
        if (data.equipment.armor) {
            const armor = itemLookup.get(data.equipment.armor);
            if (armor) warlock.equipment.armor = armor;
        }
        if (data.equipment.accessory) {
            const accessory = itemLookup.get(data.equipment.accessory);
            if (accessory) warlock.equipment.accessory = accessory;
        }
        
        // Restore inventory from itemLookup
        warlock.inventory = data.inventory
            .map(id => itemLookup.get(id))
            .filter((item): item is Item => item !== undefined);
        
        // Restore abilities (with cooldown states)
        warlock.abilities = data.abilities.map(a => ({ ...a }));
        
        // Restore active buffs
        warlock.activeBuffs = data.activeBuffs.map(b => ({ ...b }));
        
        return warlock;
    }
}
