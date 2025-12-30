/**
 * @fileoverview Main Game Loop Controller for Dungeon Roguelike
 * 
 * This module contains the GameLoop class which orchestrates the entire game flow:
 * - Game initialization with player creation
 * - Main game loop (render -> input -> execute -> repeat)
 * - Combat turn management
 * - Game over and victory handling
 * 
 * The GameLoop acts as the bridge between the GameStateManager (logic) and
 * the UI/rendering layer (to be implemented).
 * 
 * @module game/gameLoop
 */

import { GameStateManager, GameState, GamePhase, Action, ActionResult } from './gameState';
import { CombatEngine, CombatStatus, AttackResult, AbilityResult } from './combatEngine';
import { generateRandomString } from './seed';
import { Player } from '../entities/player';

/**
 * Main controller for the dungeon roguelike game flow.
 * 
 * This class orchestrates the game by:
 * 1. Initializing a new game with player selection
 * 2. Running the main game loop (render -> input -> execute -> repeat)
 * 3. Managing combat turns when in combat phase
 * 4. Handling game over and victory conditions
 * 
 * @example
 * ```typescript
 * const loop = new GameLoop();
 * const player = new Fighter('Hero');
 * await loop.startGame(player);
 * ```
 */
/** Action types that do NOT consume a combat turn (menus, overlays) */
const NON_TURN_CONSUMING_ACTIONS = new Set([
    'open_inventory',
    'close_inventory',
    'view_character',
    'close_character',
    'equip_item',
    'unequip_item',
]);

export class GameLoop {
    /** The game state manager handling all game logic */
    protected gameManager: GameStateManager;
    
    /** Active combat engine instance, null when not in combat */
    protected combatEngine: CombatEngine | null = null;
    
    /** Whether the game loop is currently running */
    protected isRunning: boolean = false;

    /**
     * Creates a new GameLoop instance with a fresh GameStateManager.
     */
    constructor() {
        this.gameManager = new GameStateManager();
    }

    // =========================================================================
    // GAME INITIALIZATION
    // =========================================================================

    /**
     * Starts a new game with the provided player.
     * 
     * This method:
     * - Generates a random seed for the dungeon
     * - Initializes the game state with the player
     * - Enters the main game loop
     * 
     * @param player - The player instance to use for the game
     * @param seed - Optional seed for dungeon generation (random if not provided)
     * @returns Promise that resolves when the game ends
     */
    async startGame(player: Player, seed: string = generateRandomString(10)): Promise<void> {
        this.gameManager.startNewGame(player.playerClass, player.name, seed);
        this.isRunning = true;
        await this.mainLoop();
    }

    // =========================================================================
    // MAIN GAME LOOP
    // =========================================================================

    /**
     * Main game loop - runs until game over or victory.
     * 
     * Loop structure:
     * 1. Check for terminal states (GAME_OVER, VICTORY)
     * 2. Render current game state
     * 3. Get available actions for current phase
     * 4. Display actions to player
     * 5. Wait for player input
     * 6. Execute chosen action
     * 7. Display action result
     * 8. If combat phase, run combat loop
     * 9. Repeat
     * 
     * @private
     */
    private async mainLoop(): Promise<void> {
        while (this.isRunning) {
            const state = this.gameManager.getState();
            
            // Check for terminal states
            if (state.phase === GamePhase.GAME_OVER) {
                this.handleGameOver();
                break;
            }
            if (state.phase === GamePhase.VICTORY) {
                this.handleVictory();
                break;
            }
            
            // Render and get player action
            this.render(state);
            const actions = this.gameManager.getAvailableActions();
            this.displayActions(actions);
            const chosenAction = await this.getPlayerInput(actions);
            const result = await this.gameManager.executeAction(chosenAction);
            this.displayResult(result);
            
            // Re-fetch state after action execution to check for phase changes
            const updatedState = this.gameManager.getState();
            
            // Handle phase-specific logic
            await this.handlePhaseTransition(updatedState.phase);
        }
    }

    /**
     * Handles phase-specific logic when transitioning to or continuing in a phase.
     * 
     * @param phase - The current game phase
     * @private
     */
    private async handlePhaseTransition(phase: GamePhase): Promise<void> {
        switch (phase) {
            case GamePhase.COMBAT:
                this.initializeCombat();
                await this.runCombatLoop();
                this.handleCombatEnd();
                break;
            case GamePhase.EXPLORATION:
                this.handleExploration();
                break;
            case GamePhase.SHOP:
                this.handleShop();
                break;
            case GamePhase.EVENT:
                this.handleEvent();
                break;
            case GamePhase.REST:
                this.handleRest();
                break;
            case GamePhase.INVENTORY:
                this.handleInventory();
                break;
            case GamePhase.CHARACTER:
                this.handleCharacter();
                break;
            // GAME_OVER and VICTORY are handled at the start of mainLoop
        }
    }

    /**
     * Handles the end of combat by updating game state based on combat result.
     * @private
     */
    private handleCombatEnd(): void {
        if (!this.combatEngine) return;
        
        const status = this.combatEngine.getStatus();
        
        if (status === CombatStatus.VICTORY) {
            // Player won - complete the room and get rewards
            this.gameManager.completeRoom();
            
            // Display rewards
            const rewards = this.gameManager.getAndClearLastRewards();
            if (rewards) {
                this.displayRoomRewards(rewards);
            }
        } else if (status === CombatStatus.DEFEAT) {
            // Player died - trigger game over
            this.gameManager.handlePlayerDeath();
        }
        // FLED status: player escaped, stays in exploration without room completion
        
        // Clean up combat engine
        this.combatEngine = null;
    }

    /**
     * Displays room completion rewards to the player.
     * Override in UI implementations to show rewards appropriately.
     * 
     * @param rewards - The rewards received from completing the room
     */
    protected displayRoomRewards(rewards: { gold: number; experience: number; items: import('../entities/item').Item[]; healthRestore?: number }): void {
        // Default implementation - override in UI classes
        console.log('Room Rewards:', rewards);
    }

    // =========================================================================
    // COMBAT LOOP
    // =========================================================================

    /**
     * Initializes combat when entering a combat room.
     * 
     * This method:
     * - Gets the player from game state
     * - Gets enemies from the current room
     * - Creates a new CombatEngine instance
     * - Stores reference for the combat loop
     * 
     * @private
     * @throws Error if player or room not found
     */
    private initializeCombat(): void {
        const state = this.gameManager.getState();
        const player = state.player;
        
        if (!player) {
            throw new Error('Cannot initialize combat: Player not found');
        }
        
        const currentRoomId = state.dungeon.currentRoomId;
        if (!currentRoomId) {
            throw new Error('Cannot initialize combat: No current room');
        }
        
        const room = state.dungeon.rooms.get(currentRoomId);
        if (!room) {
            throw new Error(`Cannot initialize combat: Room ${currentRoomId} not found`);
        }
        
        const enemies = room.enemies ?? [];
        if (enemies.length === 0) {
            throw new Error('Cannot initialize combat: No enemies in room');
        }
        
        this.combatEngine = new CombatEngine(player, enemies);
    }

    /**
     * Runs the combat loop until resolved (victory, defeat, or fled).
     * 
     * Combat turn structure:
     * 1. Get current turn from combatEngine
     * 2. Process start-of-turn effects (DOT, status expiration)
     * 3. Check if combatant is incapacitated (skip turn if so)
     * 4. If player turn: get combat action input, execute
     * 5. If enemy turn: run enemy AI, execute attack
     * 6. Advance to next turn
     * 7. Check for combat end (victory/defeat)
     * 8. Repeat until combat resolved
     * 
     * @private
     */
    private async runCombatLoop(): Promise<void> {
        if (!this.combatEngine) return;
        
        while (this.combatEngine.getStatus() === CombatStatus.IN_PROGRESS) {
            // Process start-of-turn effects
            const turnResult = this.combatEngine.startTurn();
            this.displayStatusEffectMessages(turnResult.messages);
            
            // Check if combatant died from DOT damage
            if (this.combatEngine.getStatus() !== CombatStatus.IN_PROGRESS) {
                break;
            }
            
            // Skip turn if incapacitated (stunned, frozen, etc.)
            if (turnResult.isIncapacitated) {
                this.combatEngine.nextTurn();
                continue;
            }
            
            // Get current turn and process action
            const currentTurn = this.combatEngine.getCurrentTurn();
            if (!currentTurn) break;
            
            if (currentTurn.combatant.isPlayer) {
                const shouldContinue = await this.handlePlayerCombatTurn();
                if (!shouldContinue) {
                    // Player fled successfully
                    break;
                }
            } else {
                this.handleEnemyCombatTurn(currentTurn.combatant.id);
            }
            
            // Check combat status after action
            if (this.combatEngine.getStatus() !== CombatStatus.IN_PROGRESS) {
                break;
            }
            
            // Re-render combat state after each action
            this.displayCombatState();
            
            // Advance to next turn
            this.combatEngine.nextTurn();
        }
    }

    /**
     * Handles the player's combat turn.
     * 
     * This method:
     * - Displays combat state (enemy HP, player HP/mana)
     * - Gets available combat actions
     * - Waits for player input
     * - Executes the chosen action (attack/ability/item/flee)
     * - Non-turn-consuming actions (inventory, character) loop back for another action
     * 
     * @private
     * @returns true to continue combat, false if player fled
     */
    private async handlePlayerCombatTurn(): Promise<boolean> {
        if (!this.combatEngine) return false;
        
        // Loop until a turn-consuming action is taken
        while (true) {
            // Display current combat state
            this.displayCombatState();
            
            // Get available combat actions from game state manager
            const actions = this.gameManager.getAvailableActions();
            this.displayActions(actions);
            
            // Wait for player input
            const chosenAction = await this.getPlayerInput(actions);
            
            // Check if this is a non-turn-consuming action
            if (NON_TURN_CONSUMING_ACTIONS.has(chosenAction.type)) {
                const result = await this.gameManager.executeAction(chosenAction);
                this.displayResult(result);
                // Loop back to get another action - don't consume turn
                continue;
            }
            
            // Execute turn-consuming action
            const turnResult = await this.executeCombatAction(chosenAction);
            return turnResult;
        }
    }

    /**
     * Executes a turn-consuming combat action.
     * 
     * @param action - The action to execute
     * @returns true to continue combat, false if player fled
     * @private
     */
    private async executeCombatAction(action: Action): Promise<boolean> {
        if (!this.combatEngine) return false;
        
        switch (action.type) {
            case 'basic_attack': {
                const validTargets = this.combatEngine.getValidTargets();
                let targetId: string;
                
                if (validTargets.length === 1) {
                    targetId = validTargets[0];
                } else {
                    targetId = await this.getTargetSelection(validTargets);
                }
                
                const attackResult = this.combatEngine.playerAttack(targetId);
                this.displayAttackResult(attackResult);
                return true;
            }
            
            case 'ability': {
                const abilityId = action.abilityId as string;
                // Search all abilities including equipment-granted and relic-granted abilities
                const ability = this.gameManager.getState().player?.getAllAbilities().find(a => a.id === abilityId);
                
                const needsTarget = ability?.damage && ability?.effect !== 'aoe';
                let targetId: string | undefined;
                
                if (needsTarget) {
                    const validTargets = this.combatEngine.getValidTargets();
                    if (validTargets.length === 1) {
                        targetId = validTargets[0];
                    } else if (validTargets.length > 1) {
                        targetId = await this.getTargetSelection(validTargets);
                    }
                }
                
                const abilityResult = this.combatEngine.playerUseAbility(abilityId, targetId);
                this.displayAbilityResult(abilityResult);
                return true;
            }
            
            case 'use_item': {
                const result = await this.gameManager.executeAction(action);
                this.displayResult(result);
                return true;
            }
            
            case 'flee': {
                const result = await this.gameManager.executeAction(action);
                this.displayResult(result);
                if (result.success) {
                    return false; // Player fled - exit combat
                }
                return true; // Failed to flee - turn consumed
            }
            
            default: {
                // Unknown turn-consuming action - let game manager handle it
                const result = await this.gameManager.executeAction(action);
                this.displayResult(result);
                return true;
            }
        }
    }

    /**
     * Handles an enemy's combat turn.
     * 
     * This method:
     * - Executes enemy attack against player
     * - Displays the result
     * 
     * @param enemyId - The ID of the enemy taking their turn
     * @private
     */
    private handleEnemyCombatTurn(enemyId: string): void {
        if (!this.combatEngine) return;
        
        const attackResult = this.combatEngine.enemyAttack(enemyId);
        this.displayAttackResult(attackResult);
    }

    // =========================================================================
    // INPUT HANDLING
    // =========================================================================

    /**
     * Waits for and validates player input.
     * 
     * This is an abstract method that must be implemented by a concrete
     * UI layer (console, web, etc.). The base implementation throws an error.
     * 
     * @param availableActions - Array of valid actions the player can take
     * @returns Promise resolving to the selected Action
     * @throws Error - Must be overridden by UI implementation
     * @protected
     */
    protected async getPlayerInput(availableActions: Action[]): Promise<Action> {
        // This method should be overridden by a UI-specific subclass
        // For testing, you can also inject a mock input handler
        throw new Error('getPlayerInput must be implemented by UI layer');
    }

    /**
     * Gets target selection for attacks/abilities.
     * 
     * This is an abstract method that must be implemented by a concrete
     * UI layer (console, web, etc.). The base implementation throws an error.
     * 
     * @param validTargets - Array of valid target IDs
     * @returns Promise resolving to the selected target ID
     * @throws Error - Must be overridden by UI implementation
     * @protected
     */
    protected async getTargetSelection(validTargets: string[]): Promise<string> {
        // This method should be overridden by a UI-specific subclass
        throw new Error('getTargetSelection must be implemented by UI layer');
    }

    // =========================================================================
    // RENDERING / OUTPUT
    // =========================================================================

    /**
     * Renders the current game state to screen.
     * 
     * Displays:
     * - Current room info (type, description, enemies, interactables)
     * - Player stats (HP, mana, gold, level)
     * - Dungeon progress (current level, rooms cleared)
     * 
     * Override this method in a UI-specific subclass to implement rendering.
     * 
     * @param state - The current GameState to render
     * @protected
     */
    protected render(state: GameState): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays available actions to the player.
     * 
     * Override this method in a UI-specific subclass to implement action display.
     * 
     * @param actions - Array of actions to display
     * @protected
     */
    protected displayActions(actions: Action[]): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays the result of an action.
     * 
     * Override this method in a UI-specific subclass to implement result display.
     * 
     * @param result - The ActionResult to display
     * @protected
     */
    protected displayResult(result: ActionResult): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays the current combat state.
     * 
     * Shows:
     * - All enemies with HP bars
     * - Player HP/mana bars
     * - Active status effects
     * - Combat log (recent messages)
     * 
     * Override this method in a UI-specific subclass to implement combat display.
     * 
     * @protected
     */
    protected displayCombatState(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays status effect messages from turn processing.
     * 
     * @param messages - Array of status effect messages to display
     * @protected
     */
    protected displayStatusEffectMessages(messages: string[]): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays the result of an attack action.
     * 
     * @param result - The AttackResult from CombatEngine
     * @protected
     */
    protected displayAttackResult(result: AttackResult): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    /**
     * Displays the result of an ability usage.
     * 
     * @param result - The AbilityResult from CombatEngine
     * @protected
     */
    protected displayAbilityResult(result: AbilityResult): void {
        // Override in UI-specific subclass
        // Base implementation does nothing
    }

    // =========================================================================
    // GAME END HANDLING
    // =========================================================================

    /**
     * Handles game over (player death).
     * 
     * This method:
     * - Stops the game loop
     * - Displays game over message (via UI override)
     * - Shows final stats
     * 
     * Override this method in a UI-specific subclass to add visual feedback.
     * 
     * @protected
     */
    protected handleGameOver(): void {
        this.isRunning = false;
        // Override in UI-specific subclass to display game over screen
    }

    /**
     * Handles victory (boss defeated).
     * 
     * This method:
     * - Stops the game loop
     * - Displays victory message (via UI override)
     * - Shows final stats
     * 
     * Override this method in a UI-specific subclass to add visual feedback.
     * 
     * @protected
     */
    protected handleVictory(): void {
        this.isRunning = false;
        // Override in UI-specific subclass to display victory screen
    }

    // =========================================================================
    // PHASE HANDLERS
    // =========================================================================

    /**
     * Handles exploration phase logic.
     * Called when entering or continuing exploration.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleExploration(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - exploration is handled by main loop
    }

    /**
     * Handles shop phase logic.
     * Called when entering a shop room.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleShop(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - shop actions handled by getAvailableActions
    }

    /**
     * Handles event phase logic.
     * Called when entering an event room.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleEvent(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - event choices handled by getAvailableActions
    }

    /**
     * Handles rest phase logic.
     * Called when entering a rest room.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleRest(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - rest actions handled by getAvailableActions
    }

    /**
     * Handles inventory phase logic.
     * Called when player opens inventory.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleInventory(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - inventory actions handled by getAvailableActions
    }

    /**
     * Handles character sheet phase logic.
     * Called when player views character.
     * 
     * Override this method in a UI-specific subclass for custom behavior.
     * 
     * @protected
     */
    protected handleCharacter(): void {
        // Override in UI-specific subclass
        // Base implementation does nothing - character view handled by UI
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    /**
     * Gets the current game state.
     * Useful for UI implementations to read state.
     * 
     * @returns The current GameState
     */
    getState(): GameState {
        return this.gameManager.getState();
    }

    /**
     * Gets the current combat engine if in combat.
     * Useful for UI implementations to display combat details.
     * 
     * @returns The CombatEngine or null if not in combat
     */
    getCombatEngine(): CombatEngine | null {
        return this.combatEngine;
    }
}
