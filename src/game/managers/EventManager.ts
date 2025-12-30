/**
 * @fileoverview Event Management System
 * 
 * Handles mysterious event room outcomes including:
 * - Buffs and debuffs
 * - Item rewards
 * - Gold rewards
 * - Health changes
 * 
 * @module game/managers/EventManager
 */

import { Player } from '../../entities/player';
import { Room } from '../../dungeon/room';
import { EventOutcomeType, getOutcomeMessage } from '../../events/mysteriousEvent';
import { ActionResult, GameStats, GamePhase } from '../gameState';

/**
 * Result of executing an event that may affect game state.
 */
export interface EventOutcome {
    /** The action result to return */
    result: ActionResult;
    /** Whether the player died from the event */
    playerDied: boolean;
    /** The new game phase */
    newPhase: GamePhase;
}

/**
 * Manages mysterious event execution.
 * Extracted from GameStateManager for better separation of concerns.
 */
export class EventManager {
    /**
     * Executes the event in the current room.
     * 
     * @param player - The player experiencing the event
     * @param room - The room containing the event
     * @param stats - Game stats to update
     * @returns EventOutcome with result, death status, and phase change
     */
    executeEvent(player: Player, room: Room | null, stats: GameStats): EventOutcome {
        if (!room) {
            return {
                result: { type: 'event', success: false, message: 'Cannot execute event' },
                playerDied: false,
                newPhase: GamePhase.EXPLORATION
            };
        }
        
        if (!room.event) {
            return {
                result: { type: 'event', success: false, message: 'No event in this room' },
                playerDied: false,
                newPhase: GamePhase.EXPLORATION
            };
        }
        
        const event = room.event;
        const outcome = event.outcome;
        let message = getOutcomeMessage(outcome);
        let playerDied = false;
        
        // Apply the outcome
        switch (outcome.type) {
            case EventOutcomeType.BUFF:
                if (outcome.statBonus && outcome.duration) {
                    player.applyBuff(event.title, outcome.statBonus, outcome.duration);
                }
                break;
                
            case EventOutcomeType.DEBUFF:
                if (outcome.statBonus && outcome.duration) {
                    // Debuffs are negative stat bonuses
                    const negativeBonus = { ...outcome.statBonus };
                    for (const key in negativeBonus) {
                        if (negativeBonus[key as keyof typeof negativeBonus] !== undefined) {
                            (negativeBonus as Record<string, number>)[key] = -(negativeBonus[key as keyof typeof negativeBonus] as number);
                        }
                    }
                    player.applyBuff(event.title, negativeBonus, outcome.duration);
                }
                break;
                
            case EventOutcomeType.WEAPON:
            case EventOutcomeType.ARMOR:
            case EventOutcomeType.POTION:
                if (outcome.item) {
                    player.addToInventory(outcome.item);
                    stats.itemsFound++;
                }
                break;
                
            case EventOutcomeType.GOLD:
                if (outcome.gold) {
                    player.addGold(outcome.gold);
                    stats.goldCollected += outcome.gold;
                }
                break;
                
            case EventOutcomeType.HEAL:
                if (outcome.healthChange) {
                    const healAmount = Math.floor(player.getMaxHealth() * outcome.healthChange);
                    player.heal(healAmount);
                    message = `You feel revitalized! Healed for ${healAmount} HP.`;
                }
                break;
                
            case EventOutcomeType.DAMAGE:
                if (outcome.healthChange) {
                    const damageAmount = Math.floor(player.getMaxHealth() * Math.abs(outcome.healthChange));
                    player.takeDamage(damageAmount);
                    message = `Dark energy surges through you! Took ${damageAmount} damage.`;
                    if (!player.isAlive()) {
                        playerDied = true;
                        message += ' You have been slain!';
                    }
                }
                break;
        }
        
        // Mark room as complete and transition to exploration
        room.complete();
        
        return {
            result: { 
                type: 'event', 
                success: true, 
                message
            },
            playerDied,
            newPhase: GamePhase.EXPLORATION
        };
    }
}

