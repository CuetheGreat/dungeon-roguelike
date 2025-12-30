/**
 * @fileoverview Mysterious Event System
 * 
 * This module handles random events that can occur in EVENT rooms.
 * Events can grant buffs, debuffs, powerful items, or other effects.
 * 
 * @module events/mysteriousEvent
 */

import { Item, ItemType, ItemSlot, ItemRarity, DamageType, createItem, StatBonus } from '../entities/item';
import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Types of mysterious event outcomes
 */
export enum EventOutcomeType {
    /** Grants a temporary buff to the player */
    BUFF = 'buff',
    /** Applies a temporary debuff to the player */
    DEBUFF = 'debuff',
    /** Grants a powerful weapon */
    WEAPON = 'weapon',
    /** Grants powerful armor */
    ARMOR = 'armor',
    /** Grants a healing potion */
    POTION = 'potion',
    /** Grants gold */
    GOLD = 'gold',
    /** Heals the player */
    HEAL = 'heal',
    /** Damages the player */
    DAMAGE = 'damage',
}

/**
 * Represents a mysterious event outcome
 */
export interface EventOutcome {
    /** Type of outcome */
    type: EventOutcomeType;
    /** Display name of the outcome */
    name: string;
    /** Description of what happened */
    description: string;
    /** Item granted (for WEAPON, ARMOR, POTION) */
    item?: Item;
    /** Buff/debuff stats (for BUFF, DEBUFF) */
    statBonus?: StatBonus;
    /** Duration in turns (for BUFF, DEBUFF) */
    duration?: number;
    /** Gold amount (for GOLD) */
    gold?: number;
    /** Health change (positive for HEAL, negative for DAMAGE) */
    healthChange?: number;
    /** Whether the outcome is positive for the player */
    isPositive: boolean;
}

/**
 * Represents a mysterious event with multiple possible outcomes
 */
export interface MysteriousEvent {
    /** Unique identifier */
    id: string;
    /** Event title */
    title: string;
    /** Event description/flavor text */
    description: string;
    /** The outcome of the event */
    outcome: EventOutcome;
}

// ============================================================================
// EVENT TEMPLATES
// ============================================================================

/** Buff templates with varying power levels */
const BUFF_TEMPLATES = [
    { name: 'Blessing of Strength', stat: 'attack', value: 5, duration: 10, desc: 'Your muscles surge with power!' },
    { name: 'Iron Skin', stat: 'defense', value: 5, duration: 10, desc: 'Your skin hardens like iron!' },
    { name: 'Swift Feet', stat: 'speed', value: 10, duration: 10, desc: 'You feel light as a feather!' },
    { name: 'Arcane Infusion', stat: 'maxMana', value: 20, duration: 15, desc: 'Magical energy flows through you!' },
    { name: 'Vitality Surge', stat: 'maxHealth', value: 30, duration: 15, desc: 'Life force courses through your veins!' },
    { name: 'Lucky Charm', stat: 'critChance', value: 10, duration: 10, desc: 'Fortune smiles upon you!' },
];

/** Debuff templates */
const DEBUFF_TEMPLATES = [
    { name: 'Curse of Weakness', stat: 'attack', value: -3, duration: 8, desc: 'A dark curse saps your strength...' },
    { name: 'Brittle Bones', stat: 'defense', value: -3, duration: 8, desc: 'Your defenses feel fragile...' },
    { name: 'Sluggish Mind', stat: 'speed', value: -5, duration: 8, desc: 'Your reactions slow...' },
    { name: 'Mana Drain', stat: 'maxMana', value: -10, duration: 10, desc: 'Your magical reserves diminish...' },
];

/** Powerful weapon templates */
const WEAPON_TEMPLATES = [
    {
        name: 'Blade of the Fallen',
        description: 'A sword that whispers of ancient battles',
        damage: { dice: '2d6', bonus: 3, type: DamageType.SLASHING },
        stats: { attack: 4, critChance: 5 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Thunderstrike Mace',
        description: 'Crackles with barely contained lightning',
        damage: { dice: '1d10', bonus: 4, type: DamageType.BLUDGEONING },
        stats: { attack: 5 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Shadowfang Dagger',
        description: 'Seems to drink in the light around it',
        damage: { dice: '1d6', bonus: 2, type: DamageType.PIERCING },
        stats: { attack: 2, speed: 5, critChance: 10 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Infernal Greataxe',
        description: 'Burns with hellfire that never dies',
        damage: { dice: '2d8', bonus: 5, type: DamageType.FIRE },
        stats: { attack: 6 },
        rarity: ItemRarity.VERY_RARE,
    },
];

/** Powerful armor templates */
const ARMOR_TEMPLATES = [
    {
        name: 'Dragonscale Mail',
        description: 'Forged from the scales of an ancient dragon',
        stats: { defense: 6, maxHealth: 20 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Cloak of Shadows',
        description: 'Makes you harder to hit',
        stats: { defense: 3, speed: 8 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Platemail of the Guardian',
        description: 'Heavy but nearly impenetrable',
        stats: { defense: 8, speed: -2 },
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Robes of the Archmage',
        description: 'Woven with threads of pure magic',
        stats: { defense: 2, maxMana: 30, mana: 15 },
        rarity: ItemRarity.VERY_RARE,
    },
];

/** Potion templates */
const POTION_TEMPLATES = [
    {
        name: 'Greater Healing Potion',
        description: 'Restores a significant amount of health',
        healing: { dice: '4d4', bonus: 8 },
        rarity: ItemRarity.UNCOMMON,
    },
    {
        name: 'Elixir of Vitality',
        description: 'Fully restores health and grants temporary vigor',
        healing: { dice: '6d6', bonus: 10 },
        buff: { maxHealth: 20 },
        buffDuration: 5,
        rarity: ItemRarity.RARE,
    },
    {
        name: 'Potion of Giant Strength',
        description: 'Grants immense strength for a time',
        buff: { attack: 8 },
        buffDuration: 8,
        rarity: ItemRarity.RARE,
    },
];

/** Event flavor text for different outcomes */
const EVENT_DESCRIPTIONS = {
    altar: [
        'You approach a mysterious altar glowing with ethereal light...',
        'An ancient shrine pulses with unknown energy...',
        'A weathered statue seems to watch you with knowing eyes...',
    ],
    chest: [
        'You discover a ornate chest hidden in the shadows...',
        'A golden coffer sits atop a stone pedestal...',
        'An ancient lockbox bears strange runes...',
    ],
    spirit: [
        'A ghostly figure materializes before you...',
        'The air shimmers and a spectral form appears...',
        'You sense a presence watching from beyond the veil...',
    ],
};

// ============================================================================
// EVENT GENERATION
// ============================================================================

/**
 * Generates a random mysterious event based on dungeon level.
 * Higher levels have better rewards but also worse debuffs.
 * 
 * @param level - Current dungeon level (1-20)
 * @returns A generated MysteriousEvent
 */
export function generateMysteriousEvent(level: number): MysteriousEvent {
    const rng = isRNGInitialized() ? getRNG() : null;
    const random = () => rng ? rng.nextFloat() : Math.random();
    const choice = <T>(arr: T[]): T => arr[Math.floor(random() * arr.length)];
    
    // Determine outcome type based on weighted probabilities
    // Higher levels have slightly better odds for good outcomes
    const levelBonus = Math.min(level / 40, 0.15); // Max 15% bonus at level 20
    const roll = random();
    
    let outcomeType: EventOutcomeType;
    if (roll < 0.20 + levelBonus) {
        outcomeType = EventOutcomeType.WEAPON;
    } else if (roll < 0.35 + levelBonus) {
        outcomeType = EventOutcomeType.ARMOR;
    } else if (roll < 0.50 + levelBonus) {
        outcomeType = EventOutcomeType.POTION;
    } else if (roll < 0.65 + levelBonus) {
        outcomeType = EventOutcomeType.BUFF;
    } else if (roll < 0.75) {
        outcomeType = EventOutcomeType.GOLD;
    } else if (roll < 0.85) {
        outcomeType = EventOutcomeType.HEAL;
    } else if (roll < 0.92) {
        outcomeType = EventOutcomeType.DEBUFF;
    } else {
        outcomeType = EventOutcomeType.DAMAGE;
    }
    
    const outcome = generateOutcome(outcomeType, level, choice);
    const eventType = choice(['altar', 'chest', 'spirit'] as const);
    const description = choice(EVENT_DESCRIPTIONS[eventType]);
    
    return {
        id: crypto.randomUUID(),
        title: getEventTitle(eventType),
        description,
        outcome,
    };
}

/**
 * Gets a title for the event based on type.
 */
function getEventTitle(type: 'altar' | 'chest' | 'spirit'): string {
    switch (type) {
        case 'altar': return 'Mysterious Altar';
        case 'chest': return 'Hidden Treasure';
        case 'spirit': return 'Spectral Encounter';
    }
}

/**
 * Generates a specific outcome based on type and level.
 */
function generateOutcome(
    type: EventOutcomeType,
    level: number,
    choice: <T>(arr: T[]) => T
): EventOutcome {
    switch (type) {
        case EventOutcomeType.BUFF: {
            const template = choice(BUFF_TEMPLATES);
            const scaledValue = Math.floor(template.value * (1 + level / 20));
            return {
                type: EventOutcomeType.BUFF,
                name: template.name,
                description: template.desc,
                statBonus: { [template.stat]: scaledValue },
                duration: template.duration,
                isPositive: true,
            };
        }
        
        case EventOutcomeType.DEBUFF: {
            const template = choice(DEBUFF_TEMPLATES);
            return {
                type: EventOutcomeType.DEBUFF,
                name: template.name,
                description: template.desc,
                statBonus: { [template.stat]: template.value },
                duration: template.duration,
                isPositive: false,
            };
        }
        
        case EventOutcomeType.WEAPON: {
            const template = choice(WEAPON_TEMPLATES);
            const item = createItem({
                id: `event-weapon-${crypto.randomUUID()}`,
                name: template.name,
                type: ItemType.WEAPON,
                slot: ItemSlot.WEAPON,
                rarity: template.rarity,
                value: 100 + level * 20,
                description: template.description,
                damage: template.damage,
                bonuses: template.stats,
            });
            return {
                type: EventOutcomeType.WEAPON,
                name: template.name,
                description: `You found ${template.name}! ${template.description}`,
                item,
                isPositive: true,
            };
        }
        
        case EventOutcomeType.ARMOR: {
            const template = choice(ARMOR_TEMPLATES);
            const item = createItem({
                id: `event-armor-${crypto.randomUUID()}`,
                name: template.name,
                type: ItemType.ARMOR,
                slot: ItemSlot.ARMOR,
                rarity: template.rarity,
                value: 80 + level * 15,
                description: template.description,
                bonuses: template.stats,
            });
            return {
                type: EventOutcomeType.ARMOR,
                name: template.name,
                description: `You found ${template.name}! ${template.description}`,
                item,
                isPositive: true,
            };
        }
        
        case EventOutcomeType.POTION: {
            const template = choice(POTION_TEMPLATES);
            const item = createItem({
                id: `event-potion-${crypto.randomUUID()}`,
                name: template.name,
                type: ItemType.CONSUMABLE,
                slot: ItemSlot.CONSUMABLE,
                rarity: template.rarity,
                value: 50 + level * 5,
                description: template.description,
                consumeEffect: {
                    healing: template.healing,
                    buff: template.buff,
                    buffDuration: template.buffDuration,
                },
            });
            return {
                type: EventOutcomeType.POTION,
                name: template.name,
                description: `You found ${template.name}! ${template.description}`,
                item,
                isPositive: true,
            };
        }
        
        case EventOutcomeType.GOLD: {
            const goldAmount = 50 + Math.floor(level * 15 * (0.8 + Math.random() * 0.4));
            return {
                type: EventOutcomeType.GOLD,
                name: 'Gold Cache',
                description: `You discovered a hidden cache of ${goldAmount} gold!`,
                gold: goldAmount,
                isPositive: true,
            };
        }
        
        case EventOutcomeType.HEAL: {
            const healPercent = 0.3 + Math.random() * 0.2; // 30-50% heal
            return {
                type: EventOutcomeType.HEAL,
                name: 'Healing Light',
                description: 'A warm light washes over you, healing your wounds.',
                healthChange: healPercent, // Will be converted to actual HP in execution
                isPositive: true,
            };
        }
        
        case EventOutcomeType.DAMAGE: {
            const damagePercent = 0.1 + Math.random() * 0.15; // 10-25% damage
            return {
                type: EventOutcomeType.DAMAGE,
                name: 'Dark Curse',
                description: 'A malevolent force strikes you!',
                healthChange: -damagePercent, // Negative for damage
                isPositive: false,
            };
        }
    }
}

/**
 * Gets a display message for the event outcome.
 */
export function getOutcomeMessage(outcome: EventOutcome): string {
    switch (outcome.type) {
        case EventOutcomeType.BUFF:
            return `${outcome.name} - ${outcome.description} (+${Object.entries(outcome.statBonus || {}).map(([k, v]) => `${v} ${k}`).join(', ')} for ${outcome.duration} turns)`;
        case EventOutcomeType.DEBUFF:
            return `${outcome.name} - ${outcome.description} (${Object.entries(outcome.statBonus || {}).map(([k, v]) => `${v} ${k}`).join(', ')} for ${outcome.duration} turns)`;
        case EventOutcomeType.WEAPON:
        case EventOutcomeType.ARMOR:
        case EventOutcomeType.POTION:
            return outcome.description;
        case EventOutcomeType.GOLD:
            return outcome.description;
        case EventOutcomeType.HEAL:
            return outcome.description;
        case EventOutcomeType.DAMAGE:
            return outcome.description;
        default:
            return outcome.description;
    }
}

