/**
 * @fileoverview Interactable Objects System for Dungeon Roguelike
 * 
 * This module defines interactable objects that players can interact with
 * in dungeon rooms. Interactables include:
 * - Chests: Contain loot and gold
 * - Traps: Deal damage when triggered
 * - Altars: May grant blessings or curses
 * - Levers: Trigger dungeon mechanisms
 * - NPCs: Non-player characters for dialogue/trading
 * 
 * @module dungeon/Interactable
 */

import { Item } from '../entities/item';
import { generateLootForLevel, cloneItem } from '../entities/itemDatabase';
import { getRNG, isRNGInitialized } from '../game/seed';
import { Relic, generateTrapRelic, cloneRelic } from '../entities/relic';

/**
 * Types of interactable objects that can appear in rooms.
 * @enum {string}
 */
export enum InteractableType {
    /** A container that can be opened for loot */
    CHEST = 'chest',
    /** A mechanism that triggers events when activated */
    LEVER = 'lever',
    /** A sacred object that may grant blessings or curses */
    ALTAR = 'altar',
    /** A hazard that triggers when approached */
    TRAP = 'trap',
    /** A non-player character for dialogue or trading */
    NPC = 'npc'
}

/**
 * Types of traps with different effects.
 * @enum {string}
 */
export enum TrapType {
    /** Basic damage trap */
    SPIKE = 'spike',
    /** Deals damage over time (poison) */
    POISON = 'poison',
    /** Slows the player (reduces speed) */
    FROST = 'frost',
    /** Deals fire damage and may burn items */
    FIRE = 'fire',
    /** Stuns the player (lose a turn in combat) */
    STUN = 'stun',
    /** Teleports player to a random room */
    TELEPORT = 'teleport',
    /** Drains gold */
    GOLD_DRAIN = 'gold_drain',
    /** Summons additional enemies */
    ALARM = 'alarm'
}

/**
 * Trap effect result containing damage and status effects.
 * @interface
 */
export interface TrapEffect {
    /** Immediate damage dealt */
    damage?: number;
    /** Status effect applied */
    statusEffect?: {
        type: 'poison' | 'slow' | 'burn' | 'stun';
        duration: number;
        damagePerTurn?: number;
        statReduction?: number;
    };
    /** Gold lost */
    goldLost?: number;
    /** Whether player should be teleported */
    teleport?: boolean;
    /** Whether alarm was triggered (summons enemies) */
    alarmTriggered?: boolean;
}

/**
 * Result of interacting with an object.
 * Contains all possible outcomes of an interaction.
 * @interface
 */
export interface InteractionResult {
    /** Message describing what happened */
    message: string;
    /** Items received from the interaction */
    items?: Item[];
    /** Gold received from the interaction */
    gold?: number;
    /** Damage taken from the interaction (e.g., trap) */
    damage?: number;
    /** Healing received from the interaction */
    healing?: number;
    /** Whether the interactable was consumed/destroyed */
    consumed: boolean;
    /** Stat bonuses from the interaction (e.g., altar blessing) */
    statBonus?: { attack?: number; defense?: number; speed?: number; health?: number };
    /** Duration of stat bonus in turns */
    duration?: number;
    /** Trap effect details (for enhanced trap system) */
    trapEffect?: TrapEffect;
    /** Gold lost (e.g., from gold drain trap) */
    goldLost?: number;
}

/**
 * Represents an object in a room that the player can interact with.
 * Interactables can provide loot, trigger events, or offer services.
 * @interface
 */
export interface Interactable {
    /** Unique identifier for the interactable */
    id: string;
    /** The type of interactable object */
    type: InteractableType;
    /** Display name shown to the player */
    name: string;
    /** Whether this interactable has been used */
    used: boolean;
    /** Items contained (for chests) */
    contents?: Item[];
    /** Gold contained (for chests) */
    gold?: number;
    /** Damage dealt (for traps) */
    damage?: number;
    /** Whether the trap has been disarmed */
    disarmed?: boolean;
    /** Type of trap (for TRAP type interactables) */
    trapType?: TrapType;
    /** Difficulty class to disarm the trap (1-20) */
    disarmDC?: number;
    /** Whether the trap is hidden (requires perception to spot) */
    hidden?: boolean;
    /** Whether the trap has been detected */
    detected?: boolean;
}

/**
 * Names for different interactable types.
 * Used to randomly assign flavor names to interactables.
 * @const
 */
const INTERACTABLE_NAMES: Record<InteractableType, string[]> = {
    [InteractableType.CHEST]: ['Wooden Chest', 'Iron Chest', 'Ornate Chest', 'Ancient Chest'],
    [InteractableType.LEVER]: ['Rusty Lever', 'Stone Lever', 'Golden Lever'],
    [InteractableType.ALTAR]: ['Stone Altar', 'Dark Altar', 'Blessed Altar', 'Ancient Shrine'],
    [InteractableType.TRAP]: ['Spike Trap', 'Poison Dart Trap', 'Fire Trap', 'Pit Trap'],
    [InteractableType.NPC]: ['Wandering Merchant', 'Lost Adventurer', 'Mysterious Figure']
};

/**
 * Names for different trap types.
 * @const
 */
const TRAP_TYPE_NAMES: Record<TrapType, string[]> = {
    [TrapType.SPIKE]: ['Spike Trap', 'Pit Trap', 'Blade Trap', 'Crushing Wall'],
    [TrapType.POISON]: ['Poison Dart Trap', 'Venomous Needle', 'Toxic Gas Vent', 'Serpent Trap'],
    [TrapType.FROST]: ['Frost Trap', 'Ice Shard Trap', 'Freezing Glyph', 'Cryogenic Vent'],
    [TrapType.FIRE]: ['Fire Trap', 'Flame Jet', 'Inferno Glyph', 'Lava Pit'],
    [TrapType.STUN]: ['Lightning Trap', 'Thunder Rune', 'Shock Plate', 'Static Glyph'],
    [TrapType.TELEPORT]: ['Teleportation Circle', 'Displacement Trap', 'Warp Rune'],
    [TrapType.GOLD_DRAIN]: ['Cursed Chest', 'Greed Trap', 'Gold Siphon'],
    [TrapType.ALARM]: ['Alarm Trap', 'Summoning Circle', 'Warning Glyph', 'Sentry Rune']
};

/**
 * Gets available trap types for a given dungeon level.
 * More dangerous traps appear at higher levels.
 * 
 * @param level - The dungeon level
 * @returns Array of available trap types
 */
function getTrapTypesForLevel(level: number): TrapType[] {
    const types: TrapType[] = [TrapType.SPIKE]; // Always available
    
    if (level >= 2) types.push(TrapType.POISON);
    if (level >= 3) types.push(TrapType.FROST);
    if (level >= 4) types.push(TrapType.FIRE);
    if (level >= 5) types.push(TrapType.STUN);
    if (level >= 7) types.push(TrapType.GOLD_DRAIN);
    if (level >= 8) types.push(TrapType.ALARM);
    if (level >= 10) types.push(TrapType.TELEPORT);
    
    return types;
}

/**
 * Gets a random name for a trap type.
 * 
 * @param trapType - The type of trap
 * @param rng - Optional seeded RNG
 * @returns A flavor name for the trap
 */
function getTrapName(trapType: TrapType, rng: ReturnType<typeof getRNG> | null): string {
    const names = TRAP_TYPE_NAMES[trapType];
    return rng ? rng.choice(names) : names[Math.floor(Math.random() * names.length)];
}

/**
 * Creates an interactable object appropriate for the given room level.
 * 
 * The interactable is populated with:
 * - A random name from the type's name pool
 * - Contents/gold (for chests)
 * - Damage value (for traps)
 * - Offerings (for altars, 30% chance)
 * 
 * @param type - The type of interactable to create
 * @param level - The dungeon level (affects loot quality and trap damage)
 * @returns A new Interactable object
 * 
 * @example
 * ```typescript
 * const chest = createInteractable(InteractableType.CHEST, 5);
 * const trap = createInteractable(InteractableType.TRAP, 10);
 * ```
 */
export function createInteractable(type: InteractableType, level: number): Interactable {
    const rng = isRNGInitialized() ? getRNG() : null;
    const names = INTERACTABLE_NAMES[type];
    const name = rng ? rng.choice(names) : names[Math.floor(Math.random() * names.length)];

    const base: Interactable = {
        id: crypto.randomUUID(),
        type,
        name,
        used: false
    };

    switch (type) {
        case InteractableType.CHEST:
            // Chests contain loot and gold
            base.contents = generateLootForLevel(level).map(item => cloneItem(item));
            base.gold = Math.floor((rng ? rng.nextInt(10, 50) : Math.random() * 40 + 10) * level);
            break;

        case InteractableType.TRAP: {
            // Select trap type based on level and randomness
            const trapTypes = getTrapTypesForLevel(level);
            base.trapType = rng ? rng.choice(trapTypes) : trapTypes[Math.floor(Math.random() * trapTypes.length)];
            
            // Base damage scales with level
            base.damage = Math.floor(5 + level * 2 + (rng ? rng.nextInt(0, level) : Math.random() * level));
            base.disarmed = false;
            
            // Disarm difficulty scales with level (DC 8 at level 1, up to DC 20 at level 20)
            base.disarmDC = Math.min(20, 8 + Math.floor(level * 0.6));
            
            // Higher level traps are more likely to be hidden
            const hiddenChance = 0.3 + (level * 0.02);
            base.hidden = rng ? rng.chance(hiddenChance) : Math.random() < hiddenChance;
            base.detected = !base.hidden; // If not hidden, it's automatically detected
            
            // Update name based on trap type
            base.name = getTrapName(base.trapType, rng);
            break;
        }

        case InteractableType.ALTAR:
            // Altars may contain offerings
            const hasOffering = rng ? rng.chance(0.3) : Math.random() < 0.3;
            if (hasOffering) {
                base.contents = generateLootForLevel(level + 1).map(item => cloneItem(item));
            }
            break;

        // Levers and NPCs don't need additional setup here
        // Their effects are handled by game logic
    }

    return base;
}

/**
 * Processes interaction with an interactable object.
 * 
 * Interaction outcomes by type:
 * - **CHEST**: Opens and gives contents/gold (one-time use)
 * - **TRAP**: Triggers and deals damage (unless disarmed)
 * - **ALTAR**: Either gives offerings, blessing (heal), or curse (damage)
 * - **LEVER**: Activates (triggers dungeon events)
 * - **NPC**: Greets player (can interact multiple times)
 * 
 * @param interactable - The object being interacted with
 * @returns The result of the interaction
 * 
 * @example
 * ```typescript
 * const result = interact(chest);
 * if (result.items) {
 *   player.inventory.push(...result.items);
 * }
 * if (result.damage) {
 *   player.takeDamage(result.damage);
 * }
 * ```
 */
export function interact(interactable: Interactable): InteractionResult {
    if (interactable.used && interactable.type !== InteractableType.NPC) {
        return {
            message: `The ${interactable.name} has already been used.`,
            consumed: false
        };
    }

    switch (interactable.type) {
        case InteractableType.CHEST: {
            interactable.used = true;
            
            // Build detailed message about chest contents
            const lootParts: string[] = [];
            if (interactable.contents && interactable.contents.length > 0) {
                const itemNames = interactable.contents.map(item => item.name);
                if (itemNames.length === 1) {
                    lootParts.push(itemNames[0]);
                } else if (itemNames.length === 2) {
                    lootParts.push(`${itemNames[0]} and ${itemNames[1]}`);
                } else {
                    const lastItem = itemNames.pop();
                    lootParts.push(`${itemNames.join(', ')}, and ${lastItem}`);
                }
            }
            if (interactable.gold && interactable.gold > 0) {
                lootParts.push(`${interactable.gold} gold`);
            }
            
            const lootDescription = lootParts.length > 0 
                ? lootParts.join(' and ') 
                : 'nothing';
            
            return {
                message: `You open the ${interactable.name} and find ${lootDescription}!`,
                items: interactable.contents,
                gold: interactable.gold,
                consumed: true
            };
        }

        case InteractableType.TRAP:
            if (interactable.disarmed) {
                return {
                    message: `The ${interactable.name} has been disarmed.`,
                    consumed: false
                };
            }
            interactable.used = true;
            return triggerTrap(interactable);

        case InteractableType.ALTAR: {
            interactable.used = true;
            if (interactable.contents && interactable.contents.length > 0) {
                const itemNames = interactable.contents.map(item => item.name).join(', ');
                return {
                    message: `You pray at the ${interactable.name} and find offerings: ${itemNames}.`,
                    items: interactable.contents,
                    consumed: true
                };
            }
            // Random blessing or curse
            const rng = isRNGInitialized() ? getRNG() : null;
            const roll = rng ? rng.nextFloat() : Math.random();
            
            if (roll < 0.4) {
                // Stat blessing
                const statTypes = ['attack', 'defense', 'speed'] as const;
                const statType = statTypes[Math.floor((rng ? rng.nextFloat() : Math.random()) * statTypes.length)];
                const bonus = rng ? rng.nextInt(2, 5) : Math.floor(Math.random() * 3) + 2;
                const duration = rng ? rng.nextInt(5, 10) : Math.floor(Math.random() * 5) + 5;
                return {
                    message: `The ${interactable.name} bestows a blessing upon you! +${bonus} ${statType} for ${duration} turns.`,
                    statBonus: { [statType]: bonus },
                    duration,
                    consumed: true
                };
            } else if (roll < 0.7) {
                // Healing
                const healAmount = rng ? rng.nextInt(15, 40) : Math.floor(Math.random() * 25 + 15);
                return {
                    message: `The ${interactable.name} glows warmly. You feel restored.`,
                    healing: healAmount,
                    consumed: true
                };
            } else if (roll < 0.85) {
                // Gold offering
                const goldAmount = rng ? rng.nextInt(20, 50) : Math.floor(Math.random() * 30 + 20);
                return {
                    message: `You find gold offerings at the ${interactable.name}.`,
                    gold: goldAmount,
                    consumed: true
                };
            } else {
                // Curse
                const damageAmount = rng ? rng.nextInt(8, 20) : Math.floor(Math.random() * 12 + 8);
                return {
                    message: `Dark energy surges from the ${interactable.name}!`,
                    damage: damageAmount,
                    consumed: true
                };
            }
        }

        case InteractableType.LEVER:
            interactable.used = true;
            return {
                message: `You pull the ${interactable.name}. You hear a distant rumbling...`,
                consumed: true
            };

        case InteractableType.NPC:
            // NPCs can be interacted with multiple times
            return {
                message: `The ${interactable.name} greets you.`,
                consumed: false
            };

        default:
            return {
                message: 'Nothing happens.',
                consumed: false
            };
    }
}

/**
 * Triggers a trap and returns the full effect based on trap type.
 * 
 * @param trap - The trap being triggered
 * @returns InteractionResult with damage and status effects
 */
function triggerTrap(trap: Interactable): InteractionResult {
    const rng = isRNGInitialized() ? getRNG() : null;
    const trapType = trap.trapType ?? TrapType.SPIKE;
    
    const baseResult: InteractionResult = {
        message: `You trigger the ${trap.name}!`,
        damage: trap.damage,
        consumed: true
    };
    
    switch (trapType) {
        case TrapType.SPIKE:
            baseResult.message = `You trigger the ${trap.name}! Sharp spikes pierce your flesh for ${trap.damage} damage!`;
            break;
            
        case TrapType.POISON: {
            const poisonDuration = rng ? rng.nextInt(3, 6) : Math.floor(Math.random() * 3) + 3;
            const poisonDamage = Math.floor((trap.damage ?? 10) / 3);
            baseResult.message = `You trigger the ${trap.name}! Venomous darts strike you for ${trap.damage} damage and poison courses through your veins!`;
            baseResult.trapEffect = {
                statusEffect: {
                    type: 'poison',
                    duration: poisonDuration,
                    damagePerTurn: poisonDamage
                }
            };
            break;
        }
        
        case TrapType.FROST: {
            const slowDuration = rng ? rng.nextInt(2, 4) : Math.floor(Math.random() * 2) + 2;
            baseResult.damage = Math.floor((trap.damage ?? 10) * 0.7); // Less direct damage
            baseResult.message = `You trigger the ${trap.name}! Freezing cold blasts you for ${baseResult.damage} damage and slows your movements!`;
            baseResult.trapEffect = {
                statusEffect: {
                    type: 'slow',
                    duration: slowDuration,
                    statReduction: 3
                }
            };
            break;
        }
        
        case TrapType.FIRE: {
            const burnDuration = rng ? rng.nextInt(2, 4) : Math.floor(Math.random() * 2) + 2;
            const burnDamage = Math.floor((trap.damage ?? 10) / 4);
            baseResult.damage = Math.floor((trap.damage ?? 10) * 1.2); // More direct damage
            baseResult.message = `You trigger the ${trap.name}! Flames engulf you for ${baseResult.damage} damage and you catch fire!`;
            baseResult.trapEffect = {
                statusEffect: {
                    type: 'burn',
                    duration: burnDuration,
                    damagePerTurn: burnDamage
                }
            };
            break;
        }
        
        case TrapType.STUN: {
            const stunDuration = rng ? rng.nextInt(1, 2) : 1;
            baseResult.damage = Math.floor((trap.damage ?? 10) * 0.5); // Less direct damage
            baseResult.message = `You trigger the ${trap.name}! Lightning courses through you for ${baseResult.damage} damage and stuns you!`;
            baseResult.trapEffect = {
                statusEffect: {
                    type: 'stun',
                    duration: stunDuration
                }
            };
            break;
        }
        
        case TrapType.TELEPORT:
            baseResult.damage = 0; // No damage, just teleport
            baseResult.message = `You trigger the ${trap.name}! Reality warps around you and you find yourself elsewhere!`;
            baseResult.trapEffect = {
                teleport: true
            };
            break;
        
        case TrapType.GOLD_DRAIN: {
            const goldLost = rng ? rng.nextInt(20, 100) : Math.floor(Math.random() * 80) + 20;
            baseResult.damage = Math.floor((trap.damage ?? 10) * 0.3); // Minimal damage
            baseResult.message = `You trigger the ${trap.name}! A curse drains ${goldLost} gold from your pouch!`;
            baseResult.goldLost = goldLost;
            baseResult.trapEffect = {
                goldLost
            };
            break;
        }
        
        case TrapType.ALARM:
            baseResult.damage = 0; // No direct damage
            baseResult.message = `You trigger the ${trap.name}! A loud alarm sounds and you hear footsteps approaching!`;
            baseResult.trapEffect = {
                alarmTriggered: true
            };
            break;
    }
    
    return baseResult;
}

/**
 * Attempts to detect a hidden trap.
 * 
 * @param trap - The trap to detect
 * @param perceptionBonus - Player's perception skill bonus
 * @returns Object with success status and message
 */
export function detectTrap(trap: Interactable, perceptionBonus: number = 0): { success: boolean; message: string } {
    if (trap.type !== InteractableType.TRAP) {
        return { success: false, message: 'Nothing suspicious here.' };
    }
    
    if (trap.detected) {
        return { success: true, message: `You already know about the ${trap.name}.` };
    }
    
    if (!trap.hidden) {
        trap.detected = true;
        return { success: true, message: `You spot the ${trap.name}!` };
    }
    
    const rng = isRNGInitialized() ? getRNG() : null;
    const dc = trap.disarmDC ?? 10;
    const roll = (rng ? rng.nextInt(1, 20) : Math.floor(Math.random() * 20) + 1) + perceptionBonus;
    
    if (roll >= dc) {
        trap.detected = true;
        trap.hidden = false;
        return { success: true, message: `Your keen senses detect a hidden ${trap.name}!` };
    }
    
    return { success: false, message: 'You don\'t notice anything unusual.' };
}

/**
 * Result of a trap disarm attempt.
 * @interface
 */
export interface DisarmResult {
    /** Whether the disarm was successful */
    success: boolean;
    /** Message describing what happened */
    message: string;
    /** Damage taken if trap triggered */
    damage?: number;
    /** Trap effect if trap triggered */
    trapEffect?: TrapEffect;
    /** Whether this was a critical failure (natural 1) */
    criticalFail?: boolean;
    /** Relic reward for successful disarm */
    relic?: Relic;
}

/**
 * Attempts to disarm a trap using a skill check.
 * 
 * The disarm uses a D20 roll + skillBonus vs the trap's DC.
 * - Success: Trap is disarmed, chance for relic reward
 * - Critical Success (nat 20): Guaranteed relic reward
 * - Failure by 5+: Trap triggers immediately
 * - Failure by less than 5: No trigger, can try again
 * 
 * @param trap - The trap to disarm
 * @param skillBonus - Player's trap disarm skill bonus (typically 0-10)
 * @param level - Dungeon level (affects relic quality)
 * @param ownedRelicIds - IDs of relics already owned (to avoid duplicates)
 * @returns DisarmResult with success status, message, and optional rewards/effects
 * 
 * @example
 * ```typescript
 * const result = disarmTrap(trap, player.dexterityModifier, dungeonLevel, player.getOwnedRelicBaseIds());
 * if (result.relic) {
 *   player.addRelic(result.relic);
 * }
 * if (!result.success && result.trapEffect) {
 *   // Handle trap triggering
 * }
 * ```
 */
export function disarmTrap(
    trap: Interactable, 
    skillBonus: number = 0,
    level: number = 1,
    ownedRelicIds: string[] = []
): DisarmResult {
    if (trap.type !== InteractableType.TRAP) {
        return { success: false, message: 'This is not a trap.' };
    }

    if (trap.disarmed) {
        return { success: true, message: 'The trap is already disarmed.' };
    }

    if (trap.used) {
        return { success: false, message: 'The trap has already been triggered.' };
    }
    
    if (!trap.detected) {
        return { success: false, message: 'You need to detect the trap first!' };
    }

    const rng = isRNGInitialized() ? getRNG() : null;
    const dc = trap.disarmDC ?? 10;
    const roll = (rng ? rng.nextInt(1, 20) : Math.floor(Math.random() * 20) + 1);
    const total = roll + skillBonus;
    
    // Natural 20 always succeeds with guaranteed relic
    if (roll === 20) {
        trap.disarmed = true;
        const relic = cloneRelic(generateTrapRelic(dc, level, ownedRelicIds));
        return { 
            success: true, 
            message: `Critical success! You expertly disarm the ${trap.name} and discover a hidden ${relic.name}!`,
            relic
        };
    }
    
    // Regular success
    if (total >= dc) {
        trap.disarmed = true;
        
        // Chance for relic based on DC difficulty
        // DC 8-10: 30% chance, DC 11-14: 50% chance, DC 15-17: 70% chance, DC 18+: 90% chance
        let relicChance = 0.3;
        if (dc >= 18) relicChance = 0.9;
        else if (dc >= 15) relicChance = 0.7;
        else if (dc >= 11) relicChance = 0.5;
        
        const getsRelic = rng ? rng.chance(relicChance) : Math.random() < relicChance;
        
        if (getsRelic) {
            const relic = cloneRelic(generateTrapRelic(dc, level, ownedRelicIds));
            return { 
                success: true, 
                message: `You carefully disarm the ${trap.name} and find a ${relic.name}! (Rolled ${roll}+${skillBonus}=${total} vs DC ${dc})`,
                relic
            };
        }
        
        return { 
            success: true, 
            message: `You carefully disarm the ${trap.name}. (Rolled ${roll}+${skillBonus}=${total} vs DC ${dc})`
        };
    }
    
    // Natural 1 or failing by 5+ triggers the trap
    const failMargin = dc - total;
    if (roll === 1 || failMargin >= 5) {
        trap.used = true;
        const triggerResult = triggerTrap(trap);
        return { 
            success: false, 
            message: `You fumble the disarm attempt and trigger the ${trap.name}! (Rolled ${roll}+${skillBonus}=${total} vs DC ${dc})`,
            damage: triggerResult.damage,
            trapEffect: triggerResult.trapEffect,
            criticalFail: roll === 1
        };
    }
    
    // Failed but didn't trigger - can try again
    return { 
        success: false, 
        message: `You fail to disarm the ${trap.name}, but avoid triggering it. (Rolled ${roll}+${skillBonus}=${total} vs DC ${dc})`
    };
}
