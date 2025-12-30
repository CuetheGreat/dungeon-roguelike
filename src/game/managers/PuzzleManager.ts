/**
 * @fileoverview Puzzle Management System
 * 
 * Handles all puzzle-related actions including:
 * - Attempting puzzle answers
 * - Calculating puzzle rewards
 * - Skipping puzzles
 * 
 * @module game/managers/PuzzleManager
 */

import { Player } from '../../entities/player';
import { Room } from '../../dungeon/room';
import { attemptPuzzle } from '../../puzzles/puzzle';
import { ActionResult, GameStats, GamePhase } from '../gameState';

/**
 * Result of a puzzle attempt that may change game phase.
 */
export interface PuzzleOutcome {
    /** The action result to return */
    result: ActionResult;
    /** The new game phase (if puzzle is complete) */
    newPhase?: GamePhase;
    /** Whether the room should be marked complete */
    roomComplete: boolean;
}

/**
 * Manages puzzle interactions.
 * Extracted from GameStateManager for better separation of concerns.
 */
export class PuzzleManager {
    /**
     * Attempts to answer a puzzle.
     * 
     * @param player - The player attempting the puzzle
     * @param room - The room containing the puzzle
     * @param answerIndex - Index of the selected answer
     * @param stats - Game stats to update
     * @returns PuzzleOutcome with result and phase changes
     */
    attemptAnswer(
        player: Player,
        room: Room | null,
        answerIndex: number | undefined,
        stats: GameStats
    ): PuzzleOutcome {
        if (!room?.puzzle) {
            return {
                result: { type: 'puzzle_failed', success: false, message: 'No puzzle here' },
                roomComplete: false
            };
        }
        
        if (answerIndex === undefined) {
            return {
                result: { type: 'puzzle_failed', success: false, message: 'No answer provided' },
                roomComplete: false
            };
        }
        
        const result = attemptPuzzle(room.puzzle, answerIndex);
        
        if (result.complete && result.correct) {
            // Puzzle solved - give rewards
            const baseXP = 50 * room.level;
            const xp = Math.floor(baseXP * room.puzzle.rewardMultiplier);
            const gold = Math.floor(30 * room.level * room.puzzle.rewardMultiplier);
            
            player.addExperience(xp);
            player.addGold(gold);
            stats.goldCollected += gold;
            
            return {
                result: { 
                    type: 'puzzle_solved', 
                    success: true, 
                    message: `${result.message} You earned ${xp} XP and ${gold} gold!`,
                    result: { gold }
                },
                newPhase: GamePhase.EXPLORATION,
                roomComplete: true
            };
        } else if (result.complete && !result.correct) {
            // Puzzle failed - no rewards
            return {
                result: { 
                    type: 'puzzle_failed', 
                    success: false, 
                    message: result.message
                },
                newPhase: GamePhase.EXPLORATION,
                roomComplete: true
            };
        } else {
            // Wrong answer but attempts remain
            return {
                result: { 
                    type: 'puzzle_wrong', 
                    success: false, 
                    message: result.message
                },
                roomComplete: false
            };
        }
    }

    /**
     * Skips the current puzzle, forfeiting rewards.
     * 
     * @param room - The room containing the puzzle
     * @returns PuzzleOutcome indicating the puzzle was skipped
     */
    skipPuzzle(room: Room | null): PuzzleOutcome {
        if (!room?.puzzle) {
            return {
                result: { type: 'puzzle_skipped', success: true, message: 'No puzzle to skip' },
                roomComplete: false
            };
        }
        
        return {
            result: { 
                type: 'puzzle_skipped', 
                success: true, 
                message: 'You decided to skip the puzzle, forfeiting any rewards.'
            },
            newPhase: GamePhase.EXPLORATION,
            roomComplete: true
        };
    }
}

