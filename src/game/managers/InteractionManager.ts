/**
 * @fileoverview Interaction Management System
 * 
 * Handles all interactable object interactions including:
 * - Chests (loot and gold)
 * - Traps (damage)
 * - Altars (blessings/curses)
 * - NPCs (dialogue)
 * 
 * @module game/managers/InteractionManager
 */

import { Player } from '../../entities/player';
import { Room } from '../../dungeon/room';
import { interact as interactWith, InteractionResult } from '../../dungeon/Interactable';
import { ActionResult, GameStats, GamePhase } from '../gameState';

/**
 * Result of an interaction that may affect game state.
 */
export interface InteractionOutcome {
    /** The action result to return */
    result: ActionResult;
    /** Whether the player died from the interaction */
    playerDied: boolean;
}

/**
 * Manages interactions with room objects.
 * Extracted from GameStateManager for better separation of concerns.
 */
export class InteractionManager {
    /**
     * Interacts with an object in the current room.
     * 
     * @param player - The player performing the interaction
     * @param room - The room containing the interactable
     * @param interactableIndex - Index of the interactable in the room
     * @param stats - Game stats to update
     * @returns InteractionOutcome with result and death status
     */
    interact(
        player: Player, 
        room: Room | null, 
        interactableIndex: number | undefined,
        stats: GameStats
    ): InteractionOutcome {
        if (!room) {
            return {
                result: { type: 'interact_failed', success: false, message: 'No room' },
                playerDied: false
            };
        }
        
        if (interactableIndex === undefined || !room.interactables[interactableIndex]) {
            return {
                result: { type: 'interact_failed', success: false, message: 'Nothing to interact with' },
                playerDied: false
            };
        }
        
        const interactable = room.interactables[interactableIndex];
        const interactResult: InteractionResult = interactWith(interactable);
        
        // Apply interaction results
        let playerDied = false;
        
        if (interactResult.gold && interactResult.gold > 0) {
            player.addGold(interactResult.gold);
            stats.goldCollected += interactResult.gold;
        }
        
        if (interactResult.items && interactResult.items.length > 0) {
            interactResult.items.forEach(item => {
                player.addToInventory(item);
                stats.itemsFound++;
            });
        }
        
        if (interactResult.damage && interactResult.damage > 0) {
            player.takeDamage(interactResult.damage);
            if (!player.isAlive()) {
                playerDied = true;
            }
        }
        
        if (interactResult.healing && interactResult.healing > 0) {
            player.heal(interactResult.healing);
        }
        
        if (interactResult.statBonus) {
            player.applyBuff('Blessing', interactResult.statBonus, interactResult.duration || 10);
        }
        
        return {
            result: { 
                type: 'interacted', 
                success: true, 
                message: interactResult.message,
                result: interactResult
            },
            playerDied
        };
    }
}

