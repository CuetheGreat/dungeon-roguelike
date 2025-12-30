import { Player } from '../entities/player';
import { Enemy } from '../entities/enemy';
import { getRNG, isRNGInitialized } from './seed';
import { rollDice } from '../entities/item';

// ============================================================================
// STATUS EFFECT TYPES
// ============================================================================

/** Categories of status effects */
export enum StatusEffectCategory {
    /** Damage over time effects (poison, burn, bleed) */
    DOT = 'dot',
    /** Positive stat modifications */
    BUFF = 'buff',
    /** Negative stat modifications */
    DEBUFF = 'debuff',
    /** Effects that prevent actions (stun, freeze, sleep) */
    INCAPACITATION = 'incapacitation',
    /** Healing over time effects */
    HOT = 'hot'
}

/** Specific types of status effects */
export enum StatusEffectType {
    // DOT effects
    POISON = 'poison',
    BURN = 'burn',
    BLEED = 'bleed',
    
    // Incapacitation effects
    STUN = 'stun',
    FREEZE = 'freeze',
    SLEEP = 'sleep',
    
    // Debuffs
    SLOW = 'slow',
    WEAKEN = 'weaken',
    VULNERABLE = 'vulnerable',
    
    // Buffs
    HASTE = 'haste',
    STRENGTHEN = 'strengthen',
    FORTIFY = 'fortify',
    REGENERATION = 'regeneration'
}

/** Maps effect types to their categories */
const EFFECT_CATEGORIES: Record<StatusEffectType, StatusEffectCategory> = {
    [StatusEffectType.POISON]: StatusEffectCategory.DOT,
    [StatusEffectType.BURN]: StatusEffectCategory.DOT,
    [StatusEffectType.BLEED]: StatusEffectCategory.DOT,
    [StatusEffectType.STUN]: StatusEffectCategory.INCAPACITATION,
    [StatusEffectType.FREEZE]: StatusEffectCategory.INCAPACITATION,
    [StatusEffectType.SLEEP]: StatusEffectCategory.INCAPACITATION,
    [StatusEffectType.SLOW]: StatusEffectCategory.DEBUFF,
    [StatusEffectType.WEAKEN]: StatusEffectCategory.DEBUFF,
    [StatusEffectType.VULNERABLE]: StatusEffectCategory.DEBUFF,
    [StatusEffectType.HASTE]: StatusEffectCategory.BUFF,
    [StatusEffectType.STRENGTHEN]: StatusEffectCategory.BUFF,
    [StatusEffectType.FORTIFY]: StatusEffectCategory.BUFF,
    [StatusEffectType.REGENERATION]: StatusEffectCategory.HOT
};

/** A status effect applied to a combatant */
export interface StatusEffect {
    /** Unique identifier for this effect instance */
    id: string;
    /** The type of effect */
    type: StatusEffectType;
    /** Display name */
    name: string;
    /** Remaining duration in turns */
    remainingTurns: number;
    /** Damage/healing per turn (for DOT/HOT) */
    valuePerTurn?: number;
    /** Percentage modifier (for buffs/debuffs like +25% attack) */
    percentModifier?: number;
    /** The source of the effect (for tracking) */
    source: string;
    /** Source level (affects damage scaling) */
    sourceLevel: number;
}

/** Result of processing status effects at turn start */
export interface StatusEffectTickResult {
    /** Effects that were processed */
    processedEffects: StatusEffect[];
    /** Total DOT damage taken */
    dotDamage: number;
    /** Total HOT healing received */
    hotHealing: number;
    /** Effects that expired this turn */
    expiredEffects: StatusEffect[];
    /** Whether the combatant is incapacitated (can't act) */
    isIncapacitated: boolean;
    /** Log messages for what happened */
    messages: string[];
}

// ============================================================================
// COMBAT STATE TYPES
// ============================================================================

/** Represents any entity that can participate in combat */
export interface Combatant {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    speed: number;
    defense: number;
    isPlayer: boolean;
    /** Active status effects on this combatant */
    statusEffects: StatusEffect[];
}

/** Result of an attack roll */
export interface AttackRollResult {
    /** The raw d20 roll (1-20) */
    roll: number;
    /** Total attack value (roll + bonuses) */
    total: number;
    /** Target's defense value */
    targetDefense: number;
    /** Whether the attack hit */
    isHit: boolean;
    /** Whether this was a natural 20 */
    isNatural20: boolean;
    /** Whether this was a natural 1 */
    isNatural1: boolean;
}

/** Result of a damage calculation */
export interface DamageResult {
    /** Base damage before reduction */
    baseDamage: number;
    /** Damage reduction from defense */
    damageReduction: number;
    /** Final damage after reduction (minimum 1) */
    finalDamage: number;
    /** Whether this was a critical hit */
    isCritical: boolean;
    /** The crit multiplier applied (if crit) */
    critMultiplier?: number;
}

/** Complete result of an attack action */
export interface AttackResult {
    /** The attacker */
    attacker: Combatant;
    /** The defender */
    defender: Combatant;
    /** Attack roll details */
    attackRoll: AttackRollResult;
    /** Damage details (null if missed) */
    damage: DamageResult | null;
    /** Whether the defender died from this attack */
    defenderDied: boolean;
}

/** Represents a single combatant's turn in the order */
export interface TurnOrderEntry {
    combatant: Combatant;
    initiative: number;
}

/** Current state of combat */
export enum CombatStatus {
    /** Combat is ongoing */
    IN_PROGRESS = 'in_progress',
    /** Player won (all enemies defeated) */
    VICTORY = 'victory',
    /** Player lost (player HP = 0) */
    DEFEAT = 'defeat',
    /** Player fled successfully */
    FLED = 'fled'
}

/** Complete combat state */
export interface CombatState {
    /** Current round number (starts at 1) */
    round: number;
    /** Current turn index in the turn order */
    currentTurnIndex: number;
    /** Ordered list of combatants by initiative */
    turnOrder: TurnOrderEntry[];
    /** Current combat status */
    status: CombatStatus;
    /** Combat log of actions taken */
    log: string[];
}

/** Result of applying a status effect */
export interface ApplyEffectResult {
    /** Whether the effect was applied (false if immune or blocked) */
    applied: boolean;
    /** Whether this refreshed an existing effect */
    refreshed: boolean;
    /** Whether this upgraded an existing effect's damage */
    upgraded: boolean;
    /** Message describing what happened */
    message: string;
}

/** Result of using an ability */
export interface AbilityResult {
    /** Name of the ability used */
    abilityName: string;
    /** Whether the ability was successfully used */
    success: boolean;
    /** Total damage dealt (if applicable) */
    damage?: number;
    /** Total healing done (if applicable) */
    healing?: number;
    /** Whether the ability hit all enemies (AOE) */
    isAoe?: boolean;
    /** Status effect applied (if applicable) */
    effectApplied?: string;
    /** IDs of enemies that died from this ability */
    enemiesKilled: string[];
    /** Message describing what happened */
    message: string;
}

// ============================================================================
// COMBAT ENGINE
// ============================================================================

/**
 * Core combat engine implementing turn-based D&D-inspired combat.
 * 
 * Attack Formula: 1d20 + floor(Attack/5) + floor(Level/4) >= Defense
 * Damage Formula: Weapon Dice + floor(Attack/2) - floor(Defense/2)
 * 
 * Features:
 * - Speed-based turn order (player wins ties)
 * - Natural 20 auto-hit + auto-crit
 * - Natural 1 auto-miss
 * - Critical hit system (nat 20 or crit chance roll)
 * - Minimum 1 damage on hit
 */
export class CombatEngine {
    private player: Player;
    private enemies: Enemy[];
    private state: CombatState;

    constructor(player: Player, enemies: Enemy[]) {
        this.player = player;
        this.enemies = [...enemies]; // Clone to avoid mutation
        this.state = this.initializeCombat();
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize combat state and determine turn order.
     */
    private initializeCombat(): CombatState {
        const turnOrder = this.calculateTurnOrder();
        
        return {
            round: 1,
            currentTurnIndex: 0,
            turnOrder,
            status: CombatStatus.IN_PROGRESS,
            log: [`Combat begins! Round 1`]
        };
    }

    /**
     * Calculate turn order based on speed stats.
     * Player wins ties. Otherwise sorted by speed descending.
     */
    private calculateTurnOrder(): TurnOrderEntry[] {
        const entries: TurnOrderEntry[] = [];

        // Add player
        entries.push({
            combatant: this.playerToCombatant(),
            initiative: this.player.getSpeed()
        });

        // Add enemies
        for (const enemy of this.enemies) {
            entries.push({
                combatant: this.enemyToCombatant(enemy),
                initiative: enemy.speed
            });
        }

        // Sort by initiative (descending), player wins ties
        entries.sort((a, b) => {
            if (b.initiative !== a.initiative) {
                return b.initiative - a.initiative;
            }
            // Tie: player goes first
            if (a.combatant.isPlayer) return -1;
            if (b.combatant.isPlayer) return 1;
            return 0;
        });

        return entries;
    }

    /**
     * Convert Player to Combatant interface.
     */
    private playerToCombatant(): Combatant {
        // Find existing combatant to preserve status effects
        const existing = this.state?.turnOrder.find(e => e.combatant.isPlayer);
        return {
            id: this.player.id,
            name: this.player.name,
            health: this.player.stats.health,
            maxHealth: this.player.getMaxHealth(),
            speed: this.player.getSpeed(),
            defense: this.player.getDefense(),
            isPlayer: true,
            statusEffects: existing?.combatant.statusEffects ?? []
        };
    }

    /**
     * Convert Enemy to Combatant interface.
     */
    private enemyToCombatant(enemy: Enemy): Combatant {
        // Find existing combatant to preserve status effects
        const existing = this.state?.turnOrder.find(e => e.combatant.id === enemy.id);
        return {
            id: enemy.id,
            name: enemy.name,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            speed: enemy.speed,
            defense: enemy.defense,
            isPlayer: false,
            statusEffects: existing?.combatant.statusEffects ?? []
        };
    }

    // =========================================================================
    // DICE ROLLING
    // =========================================================================

    /**
     * Roll a d20 using seeded RNG if available.
     */
    private rollD20(): number {
        if (isRNGInitialized()) {
            return getRNG().nextInt(1, 20);
        }
        return Math.floor(Math.random() * 20) + 1;
    }

    /**
     * Roll a d100 for percentage checks.
     */
    private rollD100(): number {
        if (isRNGInitialized()) {
            return getRNG().nextInt(1, 100);
        }
        return Math.floor(Math.random() * 100) + 1;
    }

    // =========================================================================
    // ATTACK ROLL CALCULATION
    // =========================================================================

    /**
     * Calculate attack bonus for the player.
     * Formula: floor(AttackPower / 5) + floor(Level / 4)
     */
    private getPlayerAttackBonus(): number {
        const attackPower = this.player.getAttackPower();
        const level = this.player.level;
        return Math.floor(attackPower / 5) + Math.floor(level / 4);
    }

    /**
     * Calculate attack bonus for an enemy.
     * Formula: floor(AttackPower / 5) + floor(CR / 4)
     */
    private getEnemyAttackBonus(enemy: Enemy): number {
        return Math.floor(enemy.attackPower / 5) + Math.floor(enemy.challengeRating / 4);
    }

    /**
     * Perform an attack roll against a target.
     * 
     * @param attackBonus - The attacker's total attack bonus
     * @param targetDefense - The defender's defense value
     * @returns AttackRollResult with hit/miss determination
     */
    rollAttack(attackBonus: number, targetDefense: number): AttackRollResult {
        const roll = this.rollD20();
        const total = roll + attackBonus;
        const isNatural20 = roll === 20;
        const isNatural1 = roll === 1;

        // Natural 20 always hits, natural 1 always misses
        let isHit: boolean;
        if (isNatural20) {
            isHit = true;
        } else if (isNatural1) {
            isHit = false;
        } else {
            isHit = total >= targetDefense;
        }

        return {
            roll,
            total,
            targetDefense,
            isHit,
            isNatural20,
            isNatural1
        };
    }

    // =========================================================================
    // DAMAGE CALCULATION
    // =========================================================================

    /**
     * Calculate damage for a successful hit.
     * 
     * @param attackPower - Attacker's attack power
     * @param weaponDice - Weapon damage dice (e.g., "1d8") or null for unarmed
     * @param targetDefense - Defender's defense for damage reduction
     * @param critChance - Attacker's crit chance (0-100)
     * @param critMultiplier - Attacker's crit damage multiplier
     * @param isNatural20 - Whether the attack roll was a natural 20 (auto-crit)
     * @returns DamageResult with final damage calculation
     */
    calculateDamage(
        attackPower: number,
        weaponDice: string | null,
        targetDefense: number,
        critChance: number,
        critMultiplier: number,
        isNatural20: boolean
    ): DamageResult {
        // Roll weapon damage or use base 1d4 for unarmed
        const weaponDamage = weaponDice ? rollDice(weaponDice) : rollDice('1d4');
        
        // Base damage = weapon dice + floor(attack / 2)
        const attackBonus = Math.floor(attackPower / 2);
        let baseDamage = weaponDamage + attackBonus;

        // Check for critical hit
        let isCritical = isNatural20; // Natural 20 is auto-crit
        
        if (!isCritical) {
            // Roll for crit chance
            const critRoll = this.rollD100();
            isCritical = critRoll <= critChance;
        }

        // Apply crit multiplier
        if (isCritical) {
            baseDamage = Math.floor(baseDamage * critMultiplier);
        }

        // Calculate damage reduction from defense
        const damageReduction = Math.floor(targetDefense / 2);
        
        // Final damage (minimum 1)
        const finalDamage = Math.max(1, baseDamage - damageReduction);

        return {
            baseDamage,
            damageReduction,
            finalDamage,
            isCritical,
            critMultiplier: isCritical ? critMultiplier : undefined
        };
    }

    // =========================================================================
    // STATUS EFFECT MANAGEMENT
    // =========================================================================

    /**
     * Apply a status effect to a combatant.
     * Same effect type refreshes duration and upgrades to higher damage.
     * Different effect types stack.
     * 
     * @param targetId - ID of the target combatant
     * @param effectType - Type of effect to apply
     * @param duration - Duration in turns
     * @param source - Source of the effect (for tracking)
     * @param sourceLevel - Level of the source (affects damage)
     * @param valueOverride - Optional override for damage/healing value
     */
    applyStatusEffect(
        targetId: string,
        effectType: StatusEffectType,
        duration: number,
        source: string,
        sourceLevel: number,
        valueOverride?: number
    ): ApplyEffectResult {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        if (!entry) {
            return { applied: false, refreshed: false, upgraded: false, message: 'Target not found' };
        }

        const combatant = entry.combatant;
        const category = EFFECT_CATEGORIES[effectType];
        const effectName = this.getEffectDisplayName(effectType);
        const value = valueOverride ?? this.calculateEffectValue(effectType, sourceLevel, combatant.maxHealth);

        // Check for existing effect of same type
        const existingIndex = combatant.statusEffects.findIndex(e => e.type === effectType);

        if (existingIndex !== -1) {
            const existing = combatant.statusEffects[existingIndex];
            
            // Refresh duration
            existing.remainingTurns = Math.max(existing.remainingTurns, duration);
            
            // Upgrade damage if new value is higher
            let upgraded = false;
            if (existing.valuePerTurn !== undefined && value > existing.valuePerTurn) {
                existing.valuePerTurn = value;
                upgraded = true;
            }

            const message = upgraded
                ? `${combatant.name}'s ${effectName} is upgraded and refreshed!`
                : `${combatant.name}'s ${effectName} duration refreshed.`;

            this.state.log.push(message);
            return { applied: true, refreshed: true, upgraded, message };
        }

        // Apply new effect
        const newEffect: StatusEffect = {
            id: crypto.randomUUID(),
            type: effectType,
            name: effectName,
            remainingTurns: duration,
            source,
            sourceLevel
        };

        // Set value for DOT/HOT effects
        if (category === StatusEffectCategory.DOT || category === StatusEffectCategory.HOT) {
            newEffect.valuePerTurn = value;
        }

        // Set modifier for buff/debuff effects
        if (category === StatusEffectCategory.BUFF || category === StatusEffectCategory.DEBUFF) {
            newEffect.percentModifier = this.getEffectModifier(effectType);
        }

        combatant.statusEffects.push(newEffect);

        const message = `${combatant.name} is afflicted with ${effectName}!`;
        this.state.log.push(message);

        return { applied: true, refreshed: false, upgraded: false, message };
    }

    /**
     * Remove a specific status effect from a combatant.
     */
    removeStatusEffect(targetId: string, effectId: string): boolean {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        if (!entry) return false;

        const index = entry.combatant.statusEffects.findIndex(e => e.id === effectId);
        if (index === -1) return false;

        const removed = entry.combatant.statusEffects.splice(index, 1)[0];
        this.state.log.push(`${entry.combatant.name}'s ${removed.name} has worn off.`);
        return true;
    }

    /**
     * Remove all effects of a specific type from a combatant.
     */
    removeEffectsByType(targetId: string, effectType: StatusEffectType): number {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        if (!entry) return 0;

        const before = entry.combatant.statusEffects.length;
        entry.combatant.statusEffects = entry.combatant.statusEffects.filter(e => e.type !== effectType);
        return before - entry.combatant.statusEffects.length;
    }

    /**
     * Get all status effects on a combatant.
     */
    getStatusEffects(targetId: string): StatusEffect[] {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        return entry?.combatant.statusEffects ?? [];
    }

    /**
     * Check if a combatant has a specific effect type.
     */
    hasStatusEffect(targetId: string, effectType: StatusEffectType): boolean {
        return this.getStatusEffects(targetId).some(e => e.type === effectType);
    }

    /**
     * Check if a combatant is incapacitated (stunned, frozen, asleep).
     */
    isIncapacitated(targetId: string): boolean {
        const effects = this.getStatusEffects(targetId);
        return effects.some(e => EFFECT_CATEGORIES[e.type] === StatusEffectCategory.INCAPACITATION);
    }

    /**
     * Process status effects at the beginning of a combatant's turn.
     * - Decrements all timers
     * - Applies DOT damage
     * - Applies HOT healing
     * - Removes expired effects
     * - Checks for incapacitation
     */
    processStatusEffects(combatantId: string): StatusEffectTickResult {
        const entry = this.state.turnOrder.find(e => e.combatant.id === combatantId);
        if (!entry) {
            return {
                processedEffects: [],
                dotDamage: 0,
                hotHealing: 0,
                expiredEffects: [],
                isIncapacitated: false,
                messages: []
            };
        }

        const combatant = entry.combatant;
        const messages: string[] = [];
        const expiredEffects: StatusEffect[] = [];
        let dotDamage = 0;
        let hotHealing = 0;
        let isIncapacitated = false;

        // Process each effect
        for (const effect of combatant.statusEffects) {
            const category = EFFECT_CATEGORIES[effect.type];

            // Apply DOT damage
            if (category === StatusEffectCategory.DOT && effect.valuePerTurn) {
                dotDamage += effect.valuePerTurn;
                messages.push(`${combatant.name} takes ${effect.valuePerTurn} ${effect.name} damage.`);
            }

            // Apply HOT healing
            if (category === StatusEffectCategory.HOT && effect.valuePerTurn) {
                hotHealing += effect.valuePerTurn;
                messages.push(`${combatant.name} regenerates ${effect.valuePerTurn} health.`);
            }

            // Check incapacitation
            if (category === StatusEffectCategory.INCAPACITATION) {
                isIncapacitated = true;
                messages.push(`${combatant.name} is ${effect.name.toLowerCase()} and cannot act!`);
            }

            // Decrement timer
            effect.remainingTurns--;

            // Mark expired effects
            if (effect.remainingTurns <= 0) {
                expiredEffects.push(effect);
            }
        }

        // Remove expired effects
        for (const expired of expiredEffects) {
            const index = combatant.statusEffects.findIndex(e => e.id === expired.id);
            if (index !== -1) {
                combatant.statusEffects.splice(index, 1);
                messages.push(`${combatant.name}'s ${expired.name} has worn off.`);
            }
        }

        // Apply DOT damage
        if (dotDamage > 0) {
            this.applyDirectDamage(combatantId, dotDamage);
        }

        // Apply HOT healing
        if (hotHealing > 0) {
            this.applyDirectHealing(combatantId, hotHealing);
        }

        // Add messages to combat log
        for (const msg of messages) {
            this.state.log.push(msg);
        }

        // Check for death from DOT
        this.checkCombatEnd();

        return {
            processedEffects: [...combatant.statusEffects],
            dotDamage,
            hotHealing,
            expiredEffects,
            isIncapacitated,
            messages
        };
    }

    /**
     * Apply direct damage to a combatant (bypasses defense, used for DOT).
     */
    private applyDirectDamage(targetId: string, damage: number): void {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        if (!entry) return;

        if (entry.combatant.isPlayer) {
            this.player.stats.health = Math.max(0, this.player.stats.health - damage);
            entry.combatant.health = this.player.stats.health;
        } else {
            const enemy = this.enemies.find(e => e.id === targetId);
            if (enemy) {
                enemy.health = Math.max(0, enemy.health - damage);
                entry.combatant.health = enemy.health;

                // Check for enemy death
                if (enemy.health <= 0) {
                    this.state.log.push(`${entry.combatant.name} succumbs to their wounds!`);
                    this.removeDeadEnemy(targetId);
                }
            }
        }
    }

    /**
     * Apply direct healing to a combatant (used for HOT).
     */
    private applyDirectHealing(targetId: string, healing: number): void {
        const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
        if (!entry) return;

        if (entry.combatant.isPlayer) {
            this.player.heal(healing);
            entry.combatant.health = this.player.stats.health;
        } else {
            const enemy = this.enemies.find(e => e.id === targetId);
            if (enemy) {
                enemy.health = Math.min(enemy.maxHealth, enemy.health + healing);
                entry.combatant.health = enemy.health;
            }
        }
    }

    /**
     * Calculate the damage/healing value for an effect based on type and level.
     */
    private calculateEffectValue(effectType: StatusEffectType, sourceLevel: number, targetMaxHealth: number): number {
        switch (effectType) {
            case StatusEffectType.POISON:
                // 5% of max HP per turn
                return Math.max(1, Math.floor(targetMaxHealth * 0.05));
            case StatusEffectType.BURN:
                // 3 + (2 * level) per turn
                return 3 + (2 * sourceLevel);
            case StatusEffectType.BLEED:
                // Flat 5 damage per turn
                return 5;
            case StatusEffectType.REGENERATION:
                // 5 HP per turn (can scale with level)
                return 5 + Math.floor(sourceLevel / 2);
            default:
                return 0;
        }
    }

    /**
     * Get the percentage modifier for buff/debuff effects.
     */
    private getEffectModifier(effectType: StatusEffectType): number {
        switch (effectType) {
            case StatusEffectType.SLOW:
                return -50; // -50% speed
            case StatusEffectType.WEAKEN:
                return -25; // -25% attack
            case StatusEffectType.VULNERABLE:
                return 25;  // +25% damage taken
            case StatusEffectType.HASTE:
                return 50;  // +50% speed
            case StatusEffectType.STRENGTHEN:
                return 25;  // +25% attack
            case StatusEffectType.FORTIFY:
                return 25;  // +25% defense
            default:
                return 0;
        }
    }

    /**
     * Get display name for an effect type.
     */
    private getEffectDisplayName(effectType: StatusEffectType): string {
        const names: Record<StatusEffectType, string> = {
            [StatusEffectType.POISON]: 'Poison',
            [StatusEffectType.BURN]: 'Burn',
            [StatusEffectType.BLEED]: 'Bleed',
            [StatusEffectType.STUN]: 'Stunned',
            [StatusEffectType.FREEZE]: 'Frozen',
            [StatusEffectType.SLEEP]: 'Asleep',
            [StatusEffectType.SLOW]: 'Slowed',
            [StatusEffectType.WEAKEN]: 'Weakened',
            [StatusEffectType.VULNERABLE]: 'Vulnerable',
            [StatusEffectType.HASTE]: 'Haste',
            [StatusEffectType.STRENGTHEN]: 'Strengthened',
            [StatusEffectType.FORTIFY]: 'Fortified',
            [StatusEffectType.REGENERATION]: 'Regeneration'
        };
        return names[effectType];
    }

    /**
     * Get effective attack value considering buff/debuff effects.
     */
    getEffectiveAttackModifier(combatantId: string): number {
        const effects = this.getStatusEffects(combatantId);
        let modifier = 0;

        for (const effect of effects) {
            if (effect.type === StatusEffectType.WEAKEN && effect.percentModifier) {
                modifier += effect.percentModifier; // Negative value
            }
            if (effect.type === StatusEffectType.STRENGTHEN && effect.percentModifier) {
                modifier += effect.percentModifier; // Positive value
            }
        }

        return modifier;
    }

    /**
     * Get damage multiplier from vulnerability effect.
     */
    getDamageReceivedModifier(combatantId: string): number {
        const effects = this.getStatusEffects(combatantId);
        let modifier = 1.0;

        for (const effect of effects) {
            if (effect.type === StatusEffectType.VULNERABLE && effect.percentModifier) {
                modifier += effect.percentModifier / 100;
            }
            if (effect.type === StatusEffectType.FORTIFY && effect.percentModifier) {
                modifier -= effect.percentModifier / 100;
            }
        }

        return Math.max(0.25, modifier); // Minimum 25% damage
    }

    /**
     * Handle sleep effect breaking when damaged.
     */
    private breakSleepOnDamage(targetId: string): void {
        const effects = this.getStatusEffects(targetId);
        const sleepEffect = effects.find(e => e.type === StatusEffectType.SLEEP);
        
        if (sleepEffect) {
            this.removeStatusEffect(targetId, sleepEffect.id);
            const entry = this.state.turnOrder.find(e => e.combatant.id === targetId);
            if (entry) {
                this.state.log.push(`${entry.combatant.name} wakes up from the damage!`);
            }
        }
    }

    // =========================================================================
    // COMBAT ACTIONS
    // =========================================================================

    /**
     * Execute a player attack against a target enemy.
     * 
     * @param targetId - ID of the enemy to attack
     * @returns AttackResult with full attack details
     */
    playerAttack(targetId: string): AttackResult {
        const target = this.enemies.find(e => e.id === targetId);
        if (!target) {
            throw new Error(`Enemy with ID ${targetId} not found`);
        }

        const attacker = this.playerToCombatant();
        const defender = this.enemyToCombatant(target);

        // Roll attack
        const attackBonus = this.getPlayerAttackBonus();
        const attackRoll = this.rollAttack(attackBonus, target.defense);

        let damage: DamageResult | null = null;
        let defenderDied = false;

        if (attackRoll.isHit) {
            // Get weapon dice
            const weaponDice = this.player.equipment.weapon?.damage?.dice ?? null;
            
            // Calculate damage
            damage = this.calculateDamage(
                this.player.getAttackPower(),
                weaponDice,
                target.defense,
                this.player.getCritChance(),
                this.player.getCritMultiplier(),
                attackRoll.isNatural20
            );

            // Apply vulnerability modifier
            const damageModifier = this.getDamageReceivedModifier(target.id);
            damage.finalDamage = Math.max(1, Math.floor(damage.finalDamage * damageModifier));

            // Break sleep on damage
            this.breakSleepOnDamage(target.id);

            // Apply damage to enemy
            target.health = Math.max(0, target.health - damage.finalDamage);
            defenderDied = target.health <= 0;

            // Update combatant in turn order
            this.updateCombatantHealth(target.id, target.health);

            // Log the attack
            if (damage.isCritical) {
                this.state.log.push(
                    `${attacker.name} CRITICALLY hits ${defender.name} for ${damage.finalDamage} damage!`
                );
            } else {
                this.state.log.push(
                    `${attacker.name} hits ${defender.name} for ${damage.finalDamage} damage.`
                );
            }

            if (defenderDied) {
                this.state.log.push(`${defender.name} is defeated!`);
                this.removeDeadEnemy(target.id);
            }
        } else {
            // Log miss
            if (attackRoll.isNatural1) {
                this.state.log.push(`${attacker.name} critically misses ${defender.name}!`);
            } else {
                this.state.log.push(`${attacker.name} misses ${defender.name}.`);
            }
        }

        // Check for victory
        this.checkCombatEnd();

        return {
            attacker,
            defender,
            attackRoll,
            damage,
            defenderDied
        };
    }

    /**
     * Execute a player ability against a target or all enemies.
     * Handles damage abilities, healing abilities, buff abilities, and AOE abilities.
     * 
     * @param abilityId - ID of the ability to use
     * @param targetId - ID of the target enemy (optional for self-targeting or AOE abilities)
     * @returns AbilityResult with full ability details
     */
    playerUseAbility(abilityId: string, targetId?: string): AbilityResult {
        // Search all abilities including equipment-granted and relic-granted abilities
        const ability = this.player.getAllAbilities().find(a => a.id === abilityId);
        if (!ability) {
            return {
                abilityName: 'Unknown',
                success: false,
                enemiesKilled: [],
                message: 'Ability not found'
            };
        }

        // Check if ability can be used (mana, cooldown)
        if (ability.currentCooldown > 0) {
            return {
                abilityName: ability.name,
                success: false,
                enemiesKilled: [],
                message: `${ability.name} is on cooldown (${ability.currentCooldown} turns remaining)`
            };
        }

        if (this.player.stats.mana < ability.manaCost) {
            return {
                abilityName: ability.name,
                success: false,
                enemiesKilled: [],
                message: `Not enough mana for ${ability.name} (need ${ability.manaCost}, have ${this.player.stats.mana})`
            };
        }

        // Consume mana and set cooldown
        this.player.useMana(ability.manaCost);
        ability.currentCooldown = ability.cooldown;

        const enemiesKilled: string[] = [];
        let totalDamage = 0;
        let totalHealing = 0;
        let message = '';

        // Handle healing abilities (self-targeting)
        if (ability.healing) {
            const healAmount = Math.floor(this.player.getMaxHealth() * ability.healing);
            totalHealing = this.player.heal(healAmount);
            message = `${this.player.name} uses ${ability.name} and heals for ${totalHealing} HP!`;
            this.state.log.push(message);

            return {
                abilityName: ability.name,
                success: true,
                healing: totalHealing,
                enemiesKilled: [],
                message
            };
        }

        // Handle buff abilities (self-targeting)
        if (ability.effect === 'attack_buff') {
            const attackBonus = Math.floor(this.player.stats.attack * 0.25);
            this.player.applyBuff(ability.name, { attack: attackBonus }, 3);
            message = `${this.player.name} uses ${ability.name}, increasing attack by ${attackBonus} for 3 turns!`;
            this.state.log.push(message);

            return {
                abilityName: ability.name,
                success: true,
                effectApplied: 'attack_buff',
                enemiesKilled: [],
                message
            };
        }

        // Handle full restore abilities (like Wish)
        if (ability.effect === 'full_restore') {
            this.player.stats.health = this.player.getMaxHealth();
            this.player.stats.mana = this.player.getMaxMana();
            // Reset all cooldowns
            for (const ab of this.player.abilities) {
                ab.currentCooldown = 0;
            }
            message = `${this.player.name} uses ${ability.name}! Fully restored health, mana, and cooldowns!`;
            this.state.log.push(message);

            return {
                abilityName: ability.name,
                success: true,
                healing: this.player.getMaxHealth(),
                effectApplied: 'full_restore',
                enemiesKilled: [],
                message
            };
        }

        // Handle invulnerability abilities
        if (ability.effect === 'invulnerable' || ability.effect === 'magic_immunity') {
            this.player.applyBuff(ability.name, { defense: 999 }, 1);
            message = `${this.player.name} uses ${ability.name} and becomes temporarily invulnerable!`;
            this.state.log.push(message);

            return {
                abilityName: ability.name,
                success: true,
                effectApplied: ability.effect,
                enemiesKilled: [],
                message
            };
        }

        // Handle AOE damage abilities (check both effect === 'aoe' and isAoe flag)
        if (ability.effect === 'aoe' || ability.isAoe) {
            // Use ability's damage value directly, or scale from base attack
            const abilityDamage = ability.damage ?? Math.floor(this.player.basicAttack().damage * 0.8);
            
            const aliveEnemies = this.enemies.filter(e => e.health > 0);
            for (const enemy of aliveEnemies) {
                const damageModifier = this.getDamageReceivedModifier(enemy.id);
                const finalDamage = Math.max(1, Math.floor(abilityDamage * damageModifier));
                
                enemy.health = Math.max(0, enemy.health - finalDamage);
                totalDamage += finalDamage;
                
                this.state.log.push(`${ability.name} hits ${enemy.name} for ${finalDamage} damage!`);
                
                if (enemy.health <= 0) {
                    enemiesKilled.push(enemy.id);
                    this.state.log.push(`${enemy.name} is defeated!`);
                }
            }
            
            // Remove dead enemies
            for (const id of enemiesKilled) {
                this.removeDeadEnemy(id);
            }
            
            message = `${this.player.name} uses ${ability.name}, dealing ${totalDamage} total damage to all enemies!`;
            this.checkCombatEnd();

            return {
                abilityName: ability.name,
                success: true,
                damage: totalDamage,
                isAoe: true,
                enemiesKilled,
                message
            };
        }

        // Handle abilities with both damage AND healing (like Soul Drain)
        if (ability.damage && ability.healing && targetId) {
            const target = this.enemies.find(e => e.id === targetId);
            if (!target) {
                return {
                    abilityName: ability.name,
                    success: false,
                    enemiesKilled: [],
                    message: 'Target not found'
                };
            }

            // Deal damage
            const damageModifier = this.getDamageReceivedModifier(target.id);
            totalDamage = Math.max(1, Math.floor(ability.damage * damageModifier));
            target.health = Math.max(0, target.health - totalDamage);
            
            // Heal player
            totalHealing = this.player.heal(ability.healing);
            
            this.state.log.push(`${ability.name} drains ${target.name} for ${totalDamage} damage!`);
            this.state.log.push(`${this.player.name} heals for ${totalHealing} HP!`);

            if (target.health <= 0) {
                enemiesKilled.push(target.id);
                this.state.log.push(`${target.name} is defeated!`);
                this.removeDeadEnemy(target.id);
            }

            message = `${this.player.name} uses ${ability.name}, dealing ${totalDamage} damage and healing for ${totalHealing}!`;
            this.checkCombatEnd();

            return {
                abilityName: ability.name,
                success: true,
                damage: totalDamage,
                healing: totalHealing,
                enemiesKilled,
                message
            };
        }

        // Handle single-target damage abilities
        if (ability.damage && targetId) {
            const target = this.enemies.find(e => e.id === targetId);
            if (!target) {
                return {
                    abilityName: ability.name,
                    success: false,
                    enemiesKilled: [],
                    message: 'Target not found'
                };
            }

            const baseDamage = this.player.basicAttack().damage;
            const abilityDamage = Math.floor(baseDamage * ability.damage);
            const damageModifier = this.getDamageReceivedModifier(target.id);
            totalDamage = Math.max(1, Math.floor(abilityDamage * damageModifier));

            // Apply stun effect if ability has it
            if (ability.effect === 'stun') {
                this.applyStatusEffect(
                    target.id,
                    StatusEffectType.STUN,
                    1, // duration in turns
                    ability.name,
                    this.player.level
                );
                this.state.log.push(`${target.name} is stunned!`);
            }

            target.health = Math.max(0, target.health - totalDamage);
            this.state.log.push(`${ability.name} hits ${target.name} for ${totalDamage} damage!`);

            if (target.health <= 0) {
                enemiesKilled.push(target.id);
                this.state.log.push(`${target.name} is defeated!`);
                this.removeDeadEnemy(target.id);
            }

            message = `${this.player.name} uses ${ability.name} on ${target.name} for ${totalDamage} damage!`;
            this.checkCombatEnd();

            return {
                abilityName: ability.name,
                success: true,
                damage: totalDamage,
                effectApplied: ability.effect,
                enemiesKilled,
                message
            };
        }

        // Fallback for abilities without clear implementation
        message = `${this.player.name} uses ${ability.name}!`;
        this.state.log.push(message);

        return {
            abilityName: ability.name,
            success: true,
            enemiesKilled: [],
            message
        };
    }

    /**
     * Execute an enemy attack against the player.
     * 
     * @param enemyId - ID of the attacking enemy
     * @returns AttackResult with full attack details
     */
    enemyAttack(enemyId: string): AttackResult {
        const enemy = this.enemies.find(e => e.id === enemyId);
        if (!enemy) {
            throw new Error(`Enemy with ID ${enemyId} not found`);
        }

        const attacker = this.enemyToCombatant(enemy);
        const defender = this.playerToCombatant();

        // Roll attack
        const attackBonus = this.getEnemyAttackBonus(enemy);
        const attackRoll = this.rollAttack(attackBonus, this.player.getDefense());

        let damage: DamageResult | null = null;
        let defenderDied = false;

        if (attackRoll.isHit) {
            // Enemies use attackPower as their damage base (no weapon dice)
            // Simulate with a dice roll based on CR
            const enemyDice = this.getEnemyDamageDice(enemy);
            
            // Calculate damage (enemies have ~10% crit chance, 1.5x multiplier)
            damage = this.calculateDamage(
                enemy.attackPower,
                enemyDice,
                this.player.getDefense(),
                10, // Enemy crit chance
                1.5, // Enemy crit multiplier
                attackRoll.isNatural20
            );

            // Apply vulnerability/fortify modifier
            const damageModifier = this.getDamageReceivedModifier(this.player.id);
            damage.finalDamage = Math.max(1, Math.floor(damage.finalDamage * damageModifier));

            // Break sleep on damage
            this.breakSleepOnDamage(this.player.id);

            // Apply damage to player
            this.player.takeDamage(damage.finalDamage);
            defenderDied = !this.player.isAlive();

            // Update combatant in turn order
            this.updateCombatantHealth(this.player.id, this.player.stats.health);

            // Log the attack
            if (damage.isCritical) {
                this.state.log.push(
                    `${attacker.name} CRITICALLY hits ${defender.name} for ${damage.finalDamage} damage!`
                );
            } else {
                this.state.log.push(
                    `${attacker.name} hits ${defender.name} for ${damage.finalDamage} damage.`
                );
            }

            if (defenderDied) {
                this.state.log.push(`${defender.name} has fallen!`);
            }
        } else {
            // Log miss
            if (attackRoll.isNatural1) {
                this.state.log.push(`${attacker.name} critically misses ${defender.name}!`);
            } else {
                this.state.log.push(`${attacker.name} misses ${defender.name}.`);
            }
        }

        // Check for defeat
        this.checkCombatEnd();

        return {
            attacker,
            defender,
            attackRoll,
            damage,
            defenderDied
        };
    }

    /**
     * Get damage dice for an enemy based on CR.
     */
    private getEnemyDamageDice(enemy: Enemy): string {
        const cr = enemy.challengeRating;
        if (cr <= 0.5) return '1d4';
        if (cr <= 1) return '1d6';
        if (cr <= 2) return '1d8';
        if (cr <= 4) return '1d10';
        if (cr <= 8) return '2d6';
        if (cr <= 12) return '2d8';
        if (cr <= 16) return '2d10';
        return '2d12';
    }

    // =========================================================================
    // TURN MANAGEMENT
    // =========================================================================

    /**
     * Get the current combatant whose turn it is.
     */
    getCurrentTurn(): TurnOrderEntry | null {
        if (this.state.status !== CombatStatus.IN_PROGRESS) {
            return null;
        }
        return this.state.turnOrder[this.state.currentTurnIndex] ?? null;
    }

    /**
     * Start the current combatant's turn.
     * Processes status effects and returns whether they can act.
     * 
     * @returns StatusEffectTickResult with turn start information
     */
    startTurn(): StatusEffectTickResult {
        const current = this.getCurrentTurn();
        if (!current) {
            return {
                processedEffects: [],
                dotDamage: 0,
                hotHealing: 0,
                expiredEffects: [],
                isIncapacitated: false,
                messages: ['No current turn']
            };
        }

        // Process status effects at turn start
        return this.processStatusEffects(current.combatant.id);
    }

    /**
     * Advance to the next turn.
     * Handles round advancement when all combatants have acted.
     */
    nextTurn(): TurnOrderEntry | null {
        if (this.state.status !== CombatStatus.IN_PROGRESS) {
            return null;
        }

        this.state.currentTurnIndex++;

        // Check if round is complete
        if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
            this.state.currentTurnIndex = 0;
            this.state.round++;
            this.state.log.push(`Round ${this.state.round}`);
        }

        return this.getCurrentTurn();
    }

    /**
     * Update a combatant's health in the turn order.
     */
    private updateCombatantHealth(id: string, newHealth: number): void {
        const entry = this.state.turnOrder.find(e => e.combatant.id === id);
        if (entry) {
            entry.combatant.health = newHealth;
        }
    }

    /**
     * Remove a dead enemy from combat.
     */
    private removeDeadEnemy(enemyId: string): void {
        // Remove from enemies array
        const enemyIndex = this.enemies.findIndex(e => e.id === enemyId);
        if (enemyIndex !== -1) {
            this.enemies.splice(enemyIndex, 1);
        }

        // Remove from turn order
        const turnIndex = this.state.turnOrder.findIndex(e => e.combatant.id === enemyId);
        if (turnIndex !== -1) {
            this.state.turnOrder.splice(turnIndex, 1);
            
            // Adjust current turn index if needed
            if (turnIndex < this.state.currentTurnIndex) {
                this.state.currentTurnIndex--;
            } else if (turnIndex === this.state.currentTurnIndex) {
                // Current combatant died, don't increment on next turn
                this.state.currentTurnIndex--;
            }
        }
    }

    // =========================================================================
    // COMBAT STATE
    // =========================================================================

    /**
     * Check if combat has ended (victory or defeat).
     */
    private checkCombatEnd(): void {
        if (!this.player.isAlive()) {
            this.state.status = CombatStatus.DEFEAT;
            this.state.log.push('DEFEAT - You have been slain!');
        } else if (this.enemies.length === 0) {
            this.state.status = CombatStatus.VICTORY;
            this.state.log.push('VICTORY - All enemies defeated!');
        }
    }

    /**
     * Get the current combat state.
     */
    getState(): CombatState {
        return { ...this.state };
    }

    /**
     * Get the current combat status.
     */
    getStatus(): CombatStatus {
        return this.state.status;
    }

    /**
     * Get the combat log.
     */
    getLog(): string[] {
        return [...this.state.log];
    }

    /**
     * Get remaining enemies.
     */
    getEnemies(): Enemy[] {
        return [...this.enemies];
    }

    /**
     * Check if it's the player's turn.
     */
    isPlayerTurn(): boolean {
        const current = this.getCurrentTurn();
        return current?.combatant.isPlayer ?? false;
    }

    /**
     * Get all valid target IDs for the player.
     */
    getValidTargets(): string[] {
        return this.enemies.map(e => e.id);
    }
}
