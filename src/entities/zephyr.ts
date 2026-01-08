/**
 * @fileoverview Zephyr (Wind Sorcerer) Class Implementation for Dungeon Roguelike
 * 
 * The Zephyr is a wind-themed sorcerer class with:
 * - High mobility and evasion
 * - Wind-based offensive and utility spells
 * - Gust Points resource that builds from casting spells
 * - Abilities that can push enemies or grant defensive bonuses
 * 
 * Inspired by the D&D 5e Zephyr homebrew class.
 * 
 * @module entities/zephyr
 */

import { Item, ItemType, ItemSlot, ItemRarity, DamageType, createItem } from './item';
import { Player, PlayerClass, PlayerJSON } from './player';
import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Zephyr class - wind-themed sorcerer with high mobility and evasive abilities.
 * 
 * **Strengths:**
 * - High evasion and speed
 * - Good AoE damage potential
 * - Gust Points mechanic for empowered abilities
 * - Defensive wind barriers
 * - Can apply "knocked down" status (reduces enemy accuracy)
 * 
 * **Weaknesses:**
 * - Low health (75)
 * - Low defense (6) - relies on evasion
 * - Medium mana pool
 * - Requires positioning awareness
 * 
 * **Abilities:**
 * - Wind Slash: Basic wind attack (5 mana, 1 turn CD)
 * - Gale Force: AoE wind damage to all enemies (18 mana, 3 turn CD)
 * - Tailwind: Speed buff + dodge chance (12 mana, 4 turn CD)
 * - Cyclone: Heavy single target + knockdown (15 mana, 2 turn CD)
 * - Wind Barrier: Defensive shield that reduces damage (20 mana, 5 turn CD)
 * - Tempest: Consume all Gust Points for massive AoE (25 mana, 6 turn CD)
 * 
 * **Gust Points:**
 * - Gain 1 point when casting any wind spell (max 4)
 * - Tempest consumes all points for bonus damage
 * - Passive: +2% dodge per Gust Point
 * 
 * @extends Player
 * 
 * @example
 * ```typescript
 * const zephyr = new Zephyr('Aero');
 * 
 * // Build Gust Points
 * const slash = zephyr.windSlash();
 * 
 * // AoE damage
 * const gale = zephyr.galeForce();
 * 
 * // Ultimate
 * const tempest = zephyr.tempest();
 * ```
 */
export class Zephyr extends Player {
    /** Current Gust Points (0-4) */
    public gustPoints: number = 0;
    
    /** Maximum Gust Points that can be held */
    public readonly maxGustPoints: number = 4;

    /**
     * Creates a new Zephyr with the specified name.
     * 
     * @param name - The zephyr's display name
     */
    constructor(name: string) {
        super(name, PlayerClass.ZEPHYR);
    }

    /**
     * Initializes Zephyr-specific abilities and starting equipment.
     * @protected
     */
    protected initializeAbilities(): void {
        // Equip starting weapon
        this.equipStartingWeapon();
        
        this.abilities = [
            {
                id: 'wind_slash',
                name: 'Wind Slash',
                description: 'Send a blade of compressed air at the enemy. Grants 1 Gust Point.',
                manaCost: 5,
                cooldown: 1,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'enemy',
                spellDamageDice: '1d8',
                effect: 'gain_gust_point'
            },
            {
                id: 'gale_force',
                name: 'Gale Force',
                description: 'Unleash a powerful gust that strikes all enemies. Grants 1 Gust Point.',
                manaCost: 18,
                cooldown: 3,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'all_enemies',
                spellDamageDice: '1d6',
                effect: 'gain_gust_point'
            },
            {
                id: 'tailwind',
                name: 'Tailwind',
                description: 'Surround yourself with accelerating winds. +20% speed and +15% dodge for 3 turns.',
                manaCost: 12,
                cooldown: 4,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'status_buff',
                targetType: 'self',
                selfBuff: { type: 'haste', duration: 3, value: 20 },
                effect: 'gain_gust_point'
            },
            {
                id: 'cyclone',
                name: 'Cyclone',
                description: 'Trap an enemy in a violent cyclone (DEX save). Deals damage and knocks them down.',
                manaCost: 15,
                cooldown: 2,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'enemy',
                spellDamageDice: '2d6',
                saveType: 'dexterity',
                statusEffect: { type: 'knockdown', duration: 1, value: 0 },
                effect: 'gain_gust_point'
            },
            {
                id: 'wind_barrier',
                name: 'Wind Barrier',
                description: 'Create a swirling barrier of wind. Reduces incoming damage by 30% for 2 turns.',
                manaCost: 20,
                cooldown: 5,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'status_buff',
                targetType: 'self',
                selfBuff: { type: 'fortify', duration: 2, value: 30 },
                effect: 'gain_gust_point'
            },
            {
                id: 'tempest',
                name: 'Tempest',
                description: 'Consume all Gust Points to unleash a devastating storm. 2d8 damage per point to all enemies.',
                manaCost: 25,
                cooldown: 6,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'all_enemies',
                spellDamageDice: '2d8',
                consumesGustPoints: true,
                effect: 'tempest'
            }
        ];
    }

    /**
     * Gains a Gust Point.
     * Gust Points are used to empower Tempest and provide passive dodge bonus.
     * 
     * @returns true if point was gained, false if already at max
     */
    gainGustPoint(): boolean {
        if (this.gustPoints < this.maxGustPoints) {
            this.gustPoints++;
            return true;
        }
        return false;
    }

    /**
     * Executes Wind Slash - basic wind attack.
     * Deals 1d8 damage and grants 1 Gust Point.
     * 
     * @returns Object with damage dealt and crit status
     */
    windSlash(): { damage: number; isCrit: boolean; gustPointGained: boolean } | null {
        const ability = this.useAbility('wind_slash');
        if (!ability) return null;

        const intMod = this.getModifier('Intelligence');
        const baseDamage = 8 + intMod + Math.floor(this.level * 0.8);
        
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const damage = isCrit 
            ? Math.floor(baseDamage * critMultiplier)
            : baseDamage;

        const gustPointGained = this.gainGustPoint();

        return { damage, isCrit, gustPointGained };
    }

    /**
     * Executes Gale Force - AoE wind damage.
     * Deals 1d6 damage to all enemies.
     * 
     * @returns Object with damage to apply to all enemies
     */
    galeForce(): { damage: number; isAoe: true; gustPointGained: boolean } | null {
        const ability = this.useAbility('gale_force');
        if (!ability) return null;

        const intMod = this.getModifier('Intelligence');
        const baseDamage = 6 + intMod + Math.floor(this.level * 0.6);
        
        const gustPointGained = this.gainGustPoint();

        return { damage: baseDamage, isAoe: true, gustPointGained };
    }

    /**
     * Executes Tailwind - speed and dodge buff.
     * 
     * @returns Object with speed bonus, dodge bonus, and duration
     */
    tailwind(): { speedBonus: number; dodgeBonus: number; duration: number } | null {
        const ability = this.useAbility('tailwind');
        if (!ability) return null;

        // Apply speed buff
        const speedBonus = Math.floor(this.getSpeed() * 0.20);
        this.applyBuff('Tailwind', { speed: speedBonus }, 3);
        
        this.gainGustPoint();

        return { speedBonus, dodgeBonus: 15, duration: 3 };
    }

    /**
     * Executes Cyclone - heavy single target damage with knockdown.
     * 
     * @returns Object with damage and knockdown status
     */
    cyclone(): { damage: number; isCrit: boolean; knockdown: boolean } | null {
        const ability = this.useAbility('cyclone');
        if (!ability) return null;

        const intMod = this.getModifier('Intelligence');
        const baseDamage = 12 + intMod + Math.floor(this.level * 1.0);
        
        const critChance = this.getCritChance();
        const critMultiplier = this.getCritMultiplier();

        const isCrit = isRNGInitialized()
            ? getRNG().percentChance(critChance)
            : Math.random() * 100 < critChance;
        const damage = isCrit 
            ? Math.floor(baseDamage * critMultiplier)
            : baseDamage;

        this.gainGustPoint();

        return { damage, isCrit, knockdown: true };
    }

    /**
     * Executes Wind Barrier - defensive damage reduction.
     * 
     * @returns Object with damage reduction percentage and duration
     */
    windBarrier(): { damageReduction: number; duration: number } | null {
        const ability = this.useAbility('wind_barrier');
        if (!ability) return null;

        // Apply fortify buff (damage reduction)
        this.applyBuff('Wind Barrier', { defense: 5 }, 2);
        
        this.gainGustPoint();

        return { damageReduction: 30, duration: 2 };
    }

    /**
     * Executes Tempest - consume all Gust Points for massive AoE damage.
     * Requires at least 1 Gust Point.
     * 
     * @returns Object with total damage and points consumed
     */
    tempest(): { damage: number; gustPointsConsumed: number; isAoe: true } | null {
        if (this.gustPoints === 0) return null;

        const ability = this.useAbility('tempest');
        if (!ability) return null;

        const intMod = this.getModifier('Intelligence');
        // 2d8 (avg 9) per gust point + INT mod + level scaling
        const damagePerPoint = 9 + Math.floor(intMod / 2) + Math.floor(this.level * 0.5);
        const damage = damagePerPoint * this.gustPoints;
        const gustPointsConsumed = this.gustPoints;

        this.gustPoints = 0;

        return { damage, gustPointsConsumed, isAoe: true };
    }

    /**
     * Zephyr passive: Bonus dodge chance based on Gust Points.
     * +2% dodge per Gust Point held.
     */
    getGustDodgeBonus(): number {
        return this.gustPoints * 2;
    }

    /**
     * Zephyr passive: Higher base speed from wind affinity.
     */
    override getSpeed(): number {
        return super.getSpeed() + 3 + this.getGustDodgeBonus();
    }

    /**
     * Serializes the Zephyr to JSON, including gust points.
     */
    override toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            gustPoints: this.gustPoints
        };
    }

    /**
     * Deserializes a Zephyr from JSON data.
     * 
     * @param data - The serialized PlayerJSON data (with zephyr extensions)
     * @param itemLookup - Map of item IDs to Item objects for restoring equipment/inventory
     * @returns A fully restored Zephyr instance
     */
    static fromJSON(
        data: PlayerJSON & { gustPoints?: number }, 
        itemLookup: Map<string, Item>
    ): Zephyr {
        const zephyr = new Zephyr(data.name);
        
        // Restore basic properties
        zephyr.level = data.level;
        zephyr.experience = data.experience;
        zephyr.gold = data.gold;
        zephyr.stats = { ...data.stats };
        
        // Restore zephyr-specific state
        zephyr.gustPoints = data.gustPoints ?? 0;
        
        // Restore equipment from itemLookup
        if (data.equipment.weapon) {
            const weapon = itemLookup.get(data.equipment.weapon);
            if (weapon) zephyr.equipment.weapon = weapon;
        }
        if (data.equipment.armor) {
            const armor = itemLookup.get(data.equipment.armor);
            if (armor) zephyr.equipment.armor = armor;
        }
        if (data.equipment.accessory) {
            const accessory = itemLookup.get(data.equipment.accessory);
            if (accessory) zephyr.equipment.accessory = accessory;
        }
        
        // Restore inventory from itemLookup
        zephyr.inventory = data.inventory
            .map(id => itemLookup.get(id))
            .filter((item): item is Item => item !== undefined);
        
        // Restore abilities (with cooldown states)
        zephyr.abilities = data.abilities.map(a => ({ ...a }));
        
        // Restore active buffs
        zephyr.activeBuffs = data.activeBuffs.map(b => ({ ...b }));
        
        return zephyr;
    }

    // =========================================================================
    // STARTING EQUIPMENT
    // =========================================================================

    /**
     * Equips the Zephyr's starting weapon - Windcaller Staff.
     * A staff that channels wind magic.
     * @private
     */
    private equipStartingWeapon(): void {
        this.equipment.weapon = createItem({
            id: 'zephyr_starting_staff',
            name: 'Windcaller Staff',
            type: ItemType.WEAPON,
            slot: ItemSlot.WEAPON,
            rarity: ItemRarity.COMMON,
            description: 'A light staff carved with swirling patterns, it hums with the power of the wind.',
            damage: { dice: '1d6', type: DamageType.MAGIC },
            bonuses: { speed: 2 },
            value: 15
        });
    }
}

