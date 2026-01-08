/**
 * @fileoverview Blood Assassin Class Implementation for Dungeon Roguelike
 * 
 * The Blood Assassin is a hybrid melee/magic class that uses hemomancy (blood magic):
 * - Medium health pool with high damage potential
 * - Sacrifices health to empower abilities (high risk, high reward)
 * - Life steal mechanics to sustain in combat
 * - Bleed effects and assassination techniques
 * - Blood Points resource that builds from dealing damage
 * 
 * Inspired by the D&D 5e Blood Assassin homebrew class.
 * 
 * @module entities/bloodAssassin
 */

import { Item, ItemType, ItemSlot, ItemRarity, DamageType, createItem } from './item';
import { Player, PlayerClass, PlayerJSON } from './player';
import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Blood Assassin class - hemomancy-focused hybrid with health sacrifice mechanics.
 * 
 * **Strengths:**
 * - High single-target damage
 * - Life steal to sustain health
 * - Blood Points mechanic for empowered abilities
 * - Bleed effects for damage over time
 * - Critical hit bonuses
 * 
 * **Weaknesses:**
 * - Medium health pool (90)
 * - Abilities cost health as well as mana
 * - Risky playstyle - must manage health carefully
 * - Low defense (8)
 * 
 * **Abilities:**
 * - Crimson Strike: Deal damage and gain Blood Points (5 mana, 1 turn CD)
 * - Blood Blade: Sacrifice HP for massive damage (10 mana + 10% HP, 2 turn CD)
 * - Sanguine Drain: Damage + 50% lifesteal (15 mana, 3 turn CD)
 * - Hemorrhage: Apply bleed DOT (12 mana, 3 turn CD)
 * - Blood Frenzy: Buff that increases damage but costs HP per turn (20 mana, 5 turn CD)
 * - Exsanguinate: Consume all Blood Points for massive damage (25 mana, 6 turn CD)
 * 
 * **Blood Points:**
 * - Gain 1 point when dealing damage with Crimson Strike
 * - Gain 1 point when an enemy dies from bleed
 * - Max 5 Blood Points
 * - Exsanguinate consumes all points for bonus damage
 * 
 * @extends Player
 * 
 * @example
 * ```typescript
 * const assassin = new BloodAssassin('Vex');
 * 
 * // Build Blood Points
 * const strike = assassin.crimsonStrike();
 * 
 * // Sacrifice health for damage
 * const blade = assassin.bloodBlade();
 * 
 * // Sustain with lifesteal
 * const drain = assassin.sanguineDrain();
 * ```
 */
export class BloodAssassin extends Player {
    /** Current Blood Points (0-5) */
    public bloodPoints: number = 0;
    
    /** Maximum Blood Points that can be held */
    public readonly maxBloodPoints: number = 5;
    
    /** Whether Blood Frenzy is active */
    public bloodFrenzyActive: boolean = false;

    /**
     * Creates a new Blood Assassin with the specified name.
     * 
     * @param name - The assassin's display name
     */
    constructor(name: string) {
        super(name, PlayerClass.BLOOD_ASSASSIN);
    }

    /**
     * Initializes Blood Assassin-specific abilities and starting equipment.
     * @protected
     */
    protected initializeAbilities(): void {
        // Equip starting weapon
        this.equipStartingWeapon();
        
        this.abilities = [
            {
                id: 'crimson_strike',
                name: 'Crimson Strike',
                description: 'A swift strike that draws blood. Deals weapon damage and grants 1 Blood Point.',
                manaCost: 5,
                cooldown: 1,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'physical',
                targetType: 'enemy',
                damage: 1.0,
                damageCalc: 'multiplier',
                effect: 'gain_blood_point'
            },
            {
                id: 'blood_blade',
                name: 'Blood Blade',
                description: 'Sacrifice 10% of your HP to coat your blade in blood, dealing 200% weapon damage.',
                manaCost: 10,
                cooldown: 2,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'physical',
                targetType: 'enemy',
                damage: 2.0,
                damageCalc: 'multiplier',
                resourceCost: { type: 'health', percent: 10 }
            },
            {
                id: 'sanguine_drain',
                name: 'Sanguine Drain',
                description: 'Drain the life force from your target. Deals 1d8 damage and heals for 50% of damage dealt.',
                manaCost: 15,
                cooldown: 3,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'enemy',
                spellDamageDice: '1d8',
                lifestealPercent: 50
            },
            {
                id: 'hemorrhage',
                name: 'Hemorrhage',
                description: 'Cause the target to bleed profusely (CON save). Deals 1d4 damage per turn for 3 turns.',
                manaCost: 12,
                cooldown: 3,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'status_debuff',
                targetType: 'enemy',
                saveType: 'constitution',
                statusEffect: { type: 'bleed', duration: 3, value: 4 } // 1d4 per turn
            },
            {
                id: 'blood_frenzy',
                name: 'Blood Frenzy',
                description: 'Enter a blood frenzy, increasing damage by 30% but losing 5% HP per turn for 3 turns.',
                manaCost: 20,
                cooldown: 5,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'status_buff',
                targetType: 'self',
                selfBuff: { type: 'strengthen', duration: 3, value: 30 },
                resourceCost: { type: 'health_per_turn', percent: 5 }
            },
            {
                id: 'exsanguinate',
                name: 'Exsanguinate',
                description: 'Consume all Blood Points to deal 2d6 damage per point. Requires at least 1 Blood Point.',
                manaCost: 25,
                cooldown: 6,
                currentCooldown: 0,
                source: 'class',
                abilityType: 'spell',
                targetType: 'enemy',
                spellDamageDice: '2d6',
                consumesBloodPoints: true,
                effect: 'exsanguinate'
            }
        ];
    }

    /**
     * Gains a Blood Point.
     * Blood Points are used to empower Exsanguinate.
     * 
     * @returns true if point was gained, false if already at max
     */
    gainBloodPoint(): boolean {
        if (this.bloodPoints < this.maxBloodPoints) {
            this.bloodPoints++;
            return true;
        }
        return false;
    }

    /**
     * Executes Crimson Strike - basic attack that grants Blood Points.
     * Deals 100% weapon damage and grants 1 Blood Point.
     * 
     * @returns Object with damage dealt, crit status, and blood point gained
     */
    crimsonStrike(): { damage: number; isCrit: boolean; bloodPointGained: boolean } | null {
        const ability = this.useAbility('crimson_strike');
        if (!ability) return null;

        const baseAttack = this.basicAttack();
        const damage = Math.floor(baseAttack.damage * (ability.damage ?? 1.0));
        const bloodPointGained = this.gainBloodPoint();

        return { damage, isCrit: baseAttack.isCrit, bloodPointGained };
    }

    /**
     * Executes Blood Blade - sacrifice HP for massive damage.
     * Costs 10% of current HP and deals 200% weapon damage.
     * 
     * @returns Object with damage dealt, HP cost, and crit status
     */
    bloodBlade(): { damage: number; healthCost: number; isCrit: boolean } | null {
        const healthCost = Math.floor(this.stats.health * 0.10);
        
        // Can't kill yourself with Blood Blade
        if (this.stats.health <= healthCost + 1) {
            return null;
        }

        const ability = this.useAbility('blood_blade');
        if (!ability) return null;

        // Pay the health cost
        this.stats.health -= healthCost;

        const baseAttack = this.basicAttack();
        const damage = Math.floor(baseAttack.damage * (ability.damage ?? 2.0));

        return { damage, healthCost, isCrit: baseAttack.isCrit };
    }

    /**
     * Executes Sanguine Drain - damage + 50% lifesteal.
     * 
     * @returns Object with damage dealt and amount healed
     */
    sanguineDrain(): { damage: number; healed: number } | null {
        const ability = this.useAbility('sanguine_drain');
        if (!ability) return null;

        // Calculate spell damage with INT modifier
        const intMod = this.getModifier('Intelligence');
        const dexMod = this.getModifier('Dexterity');
        const bestMod = Math.max(intMod, dexMod); // Blood Assassins can use DEX or INT
        
        const baseDamage = 8 + bestMod + Math.floor(this.level * 0.8);
        
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
     * Executes Hemorrhage - applies bleed DOT to target.
     * 
     * @returns Object with bleed damage per turn and duration
     */
    hemorrhage(): { damagePerTurn: number; duration: number } | null {
        const ability = this.useAbility('hemorrhage');
        if (!ability) return null;

        // Bleed scales slightly with level
        const damagePerTurn = 4 + Math.floor(this.level * 0.5);

        return { damagePerTurn, duration: 3 };
    }

    /**
     * Executes Blood Frenzy - damage buff with HP cost per turn.
     * 
     * @returns Object with damage bonus and duration
     */
    bloodFrenzy(): { damageBonus: number; duration: number; hpCostPerTurn: number } | null {
        const ability = this.useAbility('blood_frenzy');
        if (!ability) return null;

        // Apply buff using the buff system
        const damageBonus = Math.floor(this.getAttackPower() * 0.30);
        this.applyBuff('Blood Frenzy', { attack: damageBonus }, 3);
        this.bloodFrenzyActive = true;

        const hpCostPerTurn = Math.floor(this.getMaxHealth() * 0.05);

        return { damageBonus, duration: 3, hpCostPerTurn };
    }

    /**
     * Executes Exsanguinate - consume all Blood Points for massive damage.
     * Requires at least 1 Blood Point.
     * 
     * @returns Object with total damage and points consumed
     */
    exsanguinate(): { damage: number; bloodPointsConsumed: number } | null {
        if (this.bloodPoints === 0) return null;

        const ability = this.useAbility('exsanguinate');
        if (!ability) return null;

        // 2d6 per blood point, scaled with level
        const damagePerPoint = 12 + Math.floor(this.level * 1.5); // Average of 2d6 = 7, but we scale it
        const damage = damagePerPoint * this.bloodPoints;
        const bloodPointsConsumed = this.bloodPoints;

        this.bloodPoints = 0;

        return { damage, bloodPointsConsumed };
    }

    /**
     * Process Blood Frenzy HP cost at start of turn.
     * Should be called by combat engine at start of Blood Assassin's turn.
     * 
     * @returns HP lost this turn, or 0 if not active
     */
    processBloodFrenzyTick(): number {
        if (!this.bloodFrenzyActive) return 0;

        // Check if Blood Frenzy buff is still active
        const hasFrenzyBuff = this.activeBuffs.some(b => b.name === 'Blood Frenzy');
        if (!hasFrenzyBuff) {
            this.bloodFrenzyActive = false;
            return 0;
        }

        const hpCost = Math.floor(this.getMaxHealth() * 0.05);
        // Don't let it kill the player
        const actualCost = Math.min(hpCost, this.stats.health - 1);
        this.stats.health -= actualCost;

        return actualCost;
    }

    /**
     * Blood Assassin passive: Increased crit chance and crit damage.
     * +5% base crit chance, +0.25 crit multiplier.
     */
    override getCritChance(): number {
        return super.getCritChance() + 5;
    }

    override getCritMultiplier(): number {
        return super.getCritMultiplier() + 0.25;
    }

    /**
     * Serializes the Blood Assassin to JSON, including blood points and frenzy state.
     */
    override toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            bloodPoints: this.bloodPoints,
            bloodFrenzyActive: this.bloodFrenzyActive
        };
    }

    /**
     * Deserializes a Blood Assassin from JSON data.
     * 
     * @param data - The serialized PlayerJSON data (with blood assassin extensions)
     * @param itemLookup - Map of item IDs to Item objects for restoring equipment/inventory
     * @returns A fully restored Blood Assassin instance
     */
    static fromJSON(
        data: PlayerJSON & { bloodPoints?: number; bloodFrenzyActive?: boolean }, 
        itemLookup: Map<string, Item>
    ): BloodAssassin {
        const assassin = new BloodAssassin(data.name);
        
        // Restore basic properties
        assassin.level = data.level;
        assassin.experience = data.experience;
        assassin.gold = data.gold;
        assassin.stats = { ...data.stats };
        
        // Restore blood assassin-specific state
        assassin.bloodPoints = data.bloodPoints ?? 0;
        assassin.bloodFrenzyActive = data.bloodFrenzyActive ?? false;
        
        // Restore equipment from itemLookup
        if (data.equipment.weapon) {
            const weapon = itemLookup.get(data.equipment.weapon);
            if (weapon) assassin.equipment.weapon = weapon;
        }
        if (data.equipment.armor) {
            const armor = itemLookup.get(data.equipment.armor);
            if (armor) assassin.equipment.armor = armor;
        }
        if (data.equipment.accessory) {
            const accessory = itemLookup.get(data.equipment.accessory);
            if (accessory) assassin.equipment.accessory = accessory;
        }
        
        // Restore inventory from itemLookup
        assassin.inventory = data.inventory
            .map(id => itemLookup.get(id))
            .filter((item): item is Item => item !== undefined);
        
        // Restore abilities (with cooldown states)
        assassin.abilities = data.abilities.map(a => ({ ...a }));
        
        // Restore active buffs
        assassin.activeBuffs = data.activeBuffs.map(b => ({ ...b }));
        
        return assassin;
    }

    // =========================================================================
    // STARTING EQUIPMENT
    // =========================================================================

    /**
     * Equips the Blood Assassin's starting weapon - Bloodletter Dagger.
     * A curved dagger designed to cause bleeding wounds.
     * @private
     */
    private equipStartingWeapon(): void {
        this.equipment.weapon = createItem({
            id: 'blood_assassin_starting_dagger',
            name: 'Bloodletter Dagger',
            type: ItemType.WEAPON,
            slot: ItemSlot.WEAPON,
            rarity: ItemRarity.COMMON,
            description: 'A curved dagger with serrated edges, designed to cause bleeding wounds.',
            damage: { dice: '1d6', type: DamageType.PIERCING },
            bonuses: { critChance: 2 },
            value: 15
        });
    }
}

