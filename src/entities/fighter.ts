/**
 * @fileoverview Fighter Class Implementation for Dungeon Roguelike
 * 
 * The Fighter is a melee-focused warrior class with:
 * - High base health and defense
 * - Strong physical attacks
 * - Abilities that enhance survivability and damage
 * - "Last Stand" passive for increased defense at low health
 * 
 * @module entities/fighter
 */

import { Item } from './item';
import { Player, PlayerClass, PlayerJSON } from './player';

/**
 * Fighter class - melee-focused warrior with high health and defense.
 * 
 * **Strengths:**
 * - High base health (120) and defense (10)
 * - Strong physical attacks
 * - Abilities that enhance survivability and damage
 * - "Last Stand" passive: +50% defense when below 25% health
 * 
 * **Weaknesses:**
 * - Low mana pool (30)
 * - Limited ranged options
 * - Abilities cost health or have long cooldowns
 * 
 * **Abilities:**
 * - Power Strike: 150% weapon damage (10 mana, 2 turn CD)
 * - Shield Bash: 75% damage + stun (15 mana, 3 turn CD)
 * - Battle Cry: +25% attack for 3 turns (20 mana, 5 turn CD)
 * - Second Wind: Heal 30% max HP (25 mana, 6 turn CD)
 * - Whirlwind: 75% damage to all enemies (30 mana, 4 turn CD)
 * 
 * @extends Player
 * 
 * @example
 * ```typescript
 * const fighter = new Fighter('Conan');
 * 
 * // Use abilities
 * const strike = fighter.powerStrike();
 * const bash = fighter.shieldBash();
 * fighter.battleCry();
 * fighter.secondWind();
 * const spin = fighter.whirlwind();
 * ```
 */
export class Fighter extends Player {
    /**
     * Creates a new Fighter with the specified name.
     * 
     * @param name - The fighter's display name
     */
    constructor(name: string) {
        super(name, PlayerClass.FIGHTER);
    }

    /**
     * Initializes Fighter-specific abilities.
     * @protected
     */
    protected initializeAbilities(): void {
        this.abilities = [
            {
                id: 'power_strike',
                name: 'Power Strike',
                description: 'A devastating blow that deals 150% weapon damage.',
                manaCost: 10,
                cooldown: 1,
                currentCooldown: 0,
                damage: 1.5, // Multiplier
                source: 'class'
            },
            {
                id: 'shield_bash',
                name: 'Shield Bash',
                description: 'Bash the enemy, dealing moderate damage and stunning them for 1 turn.',
                manaCost: 15,
                cooldown: 3,
                currentCooldown: 0,
                damage: 0.75,
                effect: 'stun',
                source: 'class'
            },
            {
                id: 'battle_cry',
                name: 'Battle Cry',
                description: 'Let out a fierce cry, increasing attack by 25% for 3 turns.',
                manaCost: 20,
                cooldown: 5,
                currentCooldown: 0,
                effect: 'attack_buff',
                source: 'class'
            },
            {
                id: 'second_wind',
                name: 'Second Wind',
                description: 'Catch your breath and recover 30% of max health.',
                manaCost: 25,
                cooldown: 6,
                currentCooldown: 0,
                healing: 0.3, // Percentage of max health
                source: 'class'
            },
            {
                id: 'whirlwind',
                name: 'Whirlwind',
                description: 'Spin and strike all enemies for 75% weapon damage.',
                manaCost: 30,
                cooldown: 4,
                currentCooldown: 0,
                damage: 0.75,
                effect: 'aoe',
                source: 'class'
            }
        ];
    }

    /**
     * Executes Power Strike ability.
     * Deals 150% of normal attack damage.
     * 
     * @returns Object with damage dealt and crit status, or null if ability unavailable
     */
    powerStrike(): { damage: number; isCrit: boolean } | null {
        const ability = this.useAbility('power_strike');
        if (!ability) return null;

        const baseAttack = this.basicAttack();
        const damage = Math.floor(baseAttack.damage * (ability.damage ?? 1.5));

        return { damage, isCrit: baseAttack.isCrit };
    }

    /**
     * Executes Shield Bash ability.
     * Deals 75% damage and stuns the target for 1 turn.
     * 
     * @returns Object with damage dealt and stun status, or null if ability unavailable
     */
    shieldBash(): { damage: number; stunned: boolean } | null {
        const ability = this.useAbility('shield_bash');
        if (!ability) return null;

        const baseAttack = this.basicAttack();
        const damage = Math.floor(baseAttack.damage * (ability.damage ?? 0.75));

        return { damage, stunned: true };
    }

    /**
     * Executes Battle Cry ability.
     * Increases attack by 25% for 3 turns.
     * 
     * @returns Object with attack bonus and duration, or null if ability unavailable
     */
    battleCry(): { attackBonus: number; duration: number } | null {
        const ability = this.useAbility('battle_cry');
        if (!ability) return null;

        // Apply buff using the new buff system
        const attackBonus = Math.floor(this.stats.attack * 0.25);
        this.applyBuff('Battle Cry', { attack: attackBonus }, 3);

        return { attackBonus, duration: 3 };
    }

    /**
     * Executes Second Wind ability.
     * Recovers 30% of max health.
     * 
     * @returns Amount healed, or null if ability unavailable
     */
    secondWind(): number | null {
        const ability = this.useAbility('second_wind');
        if (!ability) return null;

        const healAmount = Math.floor(this.getMaxHealth() * (ability.healing ?? 0.3));
        return this.heal(healAmount);
    }

    /**
     * Executes Whirlwind ability.
     * Deals 75% weapon damage to all enemies (AOE).
     * 
     * @returns Object with damage to apply to all enemies, or null if ability unavailable
     */
    whirlwind(): { damage: number; isAoe: true } | null {
        const ability = this.useAbility('whirlwind');
        if (!ability) return null;

        const baseAttack = this.basicAttack();
        const damage = Math.floor(baseAttack.damage * (ability.damage ?? 0.75));

        return { damage, isAoe: true };
    }

    /**
     * Checks if Last Stand passive is active.
     * Last Stand activates when health drops below 25%, granting +50% defense.
     * 
     * @returns Object with defense bonus and active status
     */
    checkLastStand(): { defenseBonus: number; active: boolean } {
        const healthPercent = this.stats.health / this.getMaxHealth();
        if (healthPercent <= 0.25) {
            return { defenseBonus: Math.floor(this.stats.defense * 0.5), active: true };
        }
        return { defenseBonus: 0, active: false };
    }

    /**
     * Gets effective defense including Last Stand passive.
     * Overrides base Player.getDefense() to include passive bonus.
     * 
     * @returns Total defense value
     */
    override getDefense(): number {
        const baseDefense = super.getDefense();
        const lastStand = this.checkLastStand();
        return baseDefense + lastStand.defenseBonus;
    }

    /**
     * Deserializes a Fighter from JSON data.
     * 
     * @param data - The serialized PlayerJSON data
     * @param itemLookup - Map of item IDs to Item objects for restoring equipment/inventory
     * @returns A fully restored Fighter instance
     * 
     * @example
     * ```typescript
     * const savedData = JSON.parse(saveFile);
     * const items = new Map<string, Item>();
     * // ... populate items map ...
     * const fighter = Fighter.fromJSON(savedData, items);
     * ```
     */
    static fromJSON(data: PlayerJSON, itemLookup: Map<string, Item>): Fighter {
        const fighter = new Fighter(data.name);
        
        // Restore basic properties
        fighter.level = data.level;
        fighter.experience = data.experience;
        fighter.gold = data.gold;
        fighter.stats = { ...data.stats };
        
        // Restore equipment from itemLookup
        if (data.equipment.weapon) {
            const weapon = itemLookup.get(data.equipment.weapon);
            if (weapon) fighter.equipment.weapon = weapon;
        }
        if (data.equipment.armor) {
            const armor = itemLookup.get(data.equipment.armor);
            if (armor) fighter.equipment.armor = armor;
        }
        if (data.equipment.accessory) {
            const accessory = itemLookup.get(data.equipment.accessory);
            if (accessory) fighter.equipment.accessory = accessory;
        }
        
        // Restore inventory from itemLookup
        fighter.inventory = data.inventory
            .map(id => itemLookup.get(id))
            .filter((item): item is Item => item !== undefined);
        
        // Restore abilities (with cooldown states)
        fighter.abilities = data.abilities.map(a => ({ ...a }));
        
        // Restore active buffs
        fighter.activeBuffs = data.activeBuffs.map(b => ({ ...b }));
        
        return fighter;
    }
}
