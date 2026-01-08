import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { GameStateManager, GameState, GamePhase, Action, ActionResult } from '../game/gameState';
import { CombatEngine, CombatStatus, AttackResult, AbilityResult, TurnOrderEntry } from '../game/combatEngine';
import { PlayerClass, Player } from '../entities/player';
import { Room, RoomState } from '../dungeon/room';

/**
 * Enemy turn animation state.
 * Tracks which enemy is currently attacking for visual feedback.
 */
interface EnemyTurnState {
  /** Whether enemy turns are being animated */
  isAnimating: boolean;
  /** ID of the currently attacking enemy */
  attackingEnemyId: string | null;
  /** The attack message to display */
  attackMessage: string | null;
  /** Queue of pending enemy attacks */
  pendingAttacks: Array<{
    enemyId: string;
    enemyName: string;
  }>;
}

/**
 * Game context value interface.
 * Provides access to game state and actions throughout the React component tree.
 */
interface GameContextValue {
  // State
  gameState: GameState | null;
  combatEngine: CombatEngine | null;
  isLoading: boolean;
  error: string | null;
  
  // Derived state
  player: Player | null;
  currentRoom: Room | null;
  availableActions: Action[];
  
  // Enemy turn animation state
  enemyTurnState: EnemyTurnState;
  /** Advance to next enemy attack (or end enemy turns if done) */
  advanceEnemyTurn: () => void;
  
  // Message log
  /** Register a callback to receive log messages */
  setLogCallback: (callback: ((message: string) => void) | null) => void;
  
  // Game lifecycle
  startGame: (playerClass: PlayerClass, name: string, seed?: string) => Promise<void>;
  resetGame: () => void;
  
  // Actions
  executeAction: (action: Action) => Promise<ActionResult>;
  
  // Combat
  initializeCombat: () => void;
  endCombat: () => void;
  
  // Utility
  refreshState: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
}

/**
 * Checks if an action is a combat action.
 */
function isCombatAction(action: Action): boolean {
  return action.type === 'basic_attack' || action.type === 'ability' || action.type === 'flee';
}

/**
 * GameProvider component.
 * Wraps the application and provides game state management via context.
 * 
 * This is the bridge between React and the existing game logic.
 * The GameStateManager handles all game logic - React just renders the state.
 */
export function GameProvider({ children }: GameProviderProps) {
  // Core game manager (persists across renders)
  const gameManagerRef = useRef<GameStateManager>(new GameStateManager());
  
  // Combat engine ref (persists across renders)
  const combatEngineRef = useRef<CombatEngine | null>(null);
  
  // React state for triggering re-renders
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [combatEngine, setCombatEngine] = useState<CombatEngine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Enemy turn animation state
  const [enemyTurnState, setEnemyTurnState] = useState<EnemyTurnState>({
    isAnimating: false,
    attackingEnemyId: null,
    attackMessage: null,
    pendingAttacks: []
  });
  
  // Ref to track if we're in the middle of processing enemy turns
  const processingEnemyTurnsRef = useRef(false);
  
  // Log callback ref for sending messages to the UI
  const logCallbackRef = useRef<((message: string) => void) | null>(null);
  
  /**
   * Set the log callback function.
   */
  const setLogCallback = useCallback((callback: ((message: string) => void) | null) => {
    logCallbackRef.current = callback;
  }, []);
  
  /**
   * Add a message to the log via the callback.
   */
  const addLogMessage = useCallback((message: string) => {
    if (logCallbackRef.current && message) {
      logCallbackRef.current(message);
    }
  }, []);

  /**
   * Refresh React state from the game manager.
   * Call this after any action that modifies game state.
   */
  const refreshState = useCallback(() => {
    const state = gameManagerRef.current.getState();
    setGameState({ ...state });
  }, []);

  /**
   * Initialize combat engine for the current room.
   */
  const initializeCombat = useCallback(() => {
    const state = gameManagerRef.current.getState();
    const currentRoom = gameManagerRef.current.getCurrentRoom();
    
    if (state.player && currentRoom?.enemies && currentRoom.enemies.length > 0) {
      const engine = new CombatEngine(state.player, currentRoom.enemies);
      combatEngineRef.current = engine;
      setCombatEngine(engine);
    }
  }, []);

  /**
   * End combat and clean up.
   */
  const endCombat = useCallback(() => {
    combatEngineRef.current = null;
    setCombatEngine(null);
    refreshState();
  }, [refreshState]);

  /**
   * Sync enemy health from CombatEngine back to the room.
   * This is necessary because CombatEngine works with copies of enemies.
   */
  const syncEnemyHealth = useCallback(() => {
    const engine = combatEngineRef.current;
    const currentRoom = gameManagerRef.current.getCurrentRoom();
    
    if (!engine || !currentRoom?.enemies) return;
    
    // Get enemy health from combat engine state
    const combatState = engine.getState();
    
    // Update room enemies with current health
    currentRoom.enemies.forEach(roomEnemy => {
      const combatEntry = combatState.turnOrder.find(
        entry => entry.combatant.id === roomEnemy.id
      );
      if (combatEntry) {
        roomEnemy.health = combatEntry.combatant.health;
      }
    });
  }, []);

  /**
   * Check if combat should end and handle transitions.
   * Returns reward message if combat was won.
   */
  const checkCombatEnd = useCallback((): string | null => {
    const engine = combatEngineRef.current;
    if (!engine) return null;

    const status = engine.getStatus();

    if (status === CombatStatus.VICTORY) {
      // Sync enemy health to room before completing
      syncEnemyHealth();
      
      // Combat won - use GameStateManager.completeRoom() to properly grant rewards
      try {
        gameManagerRef.current.completeRoom();
        
        // Get the rewards that were granted
        const rewards = gameManagerRef.current.getAndClearLastRewards();
        endCombat();
        
        if (rewards) {
          let rewardMsg = `<span class="log-crit">Victory!</span> Gained <span class="log-gold">${rewards.gold}</span> gold, <span class="log-gold">${rewards.experience}</span> XP`;
          if (rewards.items.length > 0) {
            const itemNames = rewards.items.map(item => formatItemWithRarity(item.name, item.rarity)).join(', ');
            rewardMsg += `. Found: ${itemNames}`;
          }
          if (rewards.relic) {
            rewardMsg += `. <span class="log-item-legendary">Relic obtained: ${rewards.relic.name}!</span>`;
          }
          if (rewards.healthRestore) {
            rewardMsg += `. Restored <span class="log-heal">${rewards.healthRestore}</span> HP`;
          }
          return rewardMsg;
        }
        return '<span class="log-crit">Victory!</span>';
      } catch (err) {
        // Room completion might fail if already completed
        console.warn('Room completion error:', err);
        endCombat();
        return 'Victory!';
      }
    } else if (status === CombatStatus.DEFEAT) {
      // Player died - use GameStateManager to handle death
      gameManagerRef.current.handlePlayerDeath();
      endCombat();
      return null;
    }
    
    return null;
  }, [endCombat, syncEnemyHealth]);

  /**
   * Build queue of enemies that will attack this round.
   * Returns all living enemies since they all get a turn each round.
   */
  const buildEnemyAttackQueue = useCallback((): Array<{ enemyId: string; enemyName: string }> => {
    const engine = combatEngineRef.current;
    if (!engine) return [];

    const queue: Array<{ enemyId: string; enemyName: string }> = [];
    
    // Get current turn - if it's an enemy's turn, add them and subsequent enemies
    let currentTurn = engine.getCurrentTurn();
    
    // If it's not an enemy's turn, no enemies to process
    if (!currentTurn || currentTurn.combatant.isPlayer) {
      return [];
    }
    
    // Add the current enemy
    if (currentTurn.combatant.health > 0) {
      queue.push({
        enemyId: currentTurn.combatant.id,
        enemyName: currentTurn.combatant.name
      });
    }
    
    // We'll process one enemy at a time through advanceEnemyTurn
    // The queue just holds the first enemy - subsequent ones will be found dynamically
    
    return queue;
  }, []);

  /**
   * Process a single enemy's turn and return the result.
   */
  const processSingleEnemyTurn = useCallback((enemyId: string): string | null => {
    const engine = combatEngineRef.current;
    if (!engine) return null;

    const currentTurn = engine.getCurrentTurn();
    if (!currentTurn || currentTurn.combatant.id !== enemyId) {
      // Not this enemy's turn, advance to find them
      return null;
    }

    // Start the enemy's turn (handles status effects)
    engine.startTurn();
    
    let message: string | null = null;
    
    // Enemy attacks if alive
    if (currentTurn.combatant.health > 0) {
      try {
        const attackResult = engine.enemyAttack(currentTurn.combatant.id);
        message = formatAttackResult(attackResult);
      } catch (e) {
        // Enemy might be dead or invalid
      }
    }
    
    // Move to next turn
    engine.nextTurn();
    
    return message;
  }, []);

  /**
   * Start enemy turn animation sequence.
   */
  const startEnemyTurnSequence = useCallback(() => {
    const queue = buildEnemyAttackQueue();
    
    if (queue.length === 0) {
      // No enemies to attack, player's turn
      return;
    }

    // Set up the animation state with the queue
    setEnemyTurnState({
      isAnimating: true,
      attackingEnemyId: null,
      attackMessage: null,
      pendingAttacks: queue
    });
    
    processingEnemyTurnsRef.current = true;
  }, [buildEnemyAttackQueue]);

  /**
   * Advance to the next enemy attack in the sequence.
   * Called automatically after delay or when player clicks.
   */
  const advanceEnemyTurn = useCallback(() => {
    const engine = combatEngineRef.current;
    if (!engine || !processingEnemyTurnsRef.current) return;

    // Check current turn
    const currentTurn = engine.getCurrentTurn();
    
    // If it's player's turn or combat ended, stop the sequence
    if (!currentTurn || currentTurn.combatant.isPlayer || engine.getStatus() !== CombatStatus.IN_PROGRESS) {
      processingEnemyTurnsRef.current = false;
      syncEnemyHealth();
      checkCombatEnd();
      refreshState();
      
      setEnemyTurnState({
        isAnimating: false,
        attackingEnemyId: null,
        attackMessage: null,
        pendingAttacks: []
      });
      return;
    }

    // Process the current enemy's turn
    const enemyId = currentTurn.combatant.id;
    const enemyName = currentTurn.combatant.name;
    const message = processSingleEnemyTurn(enemyId);
    
    // Add enemy attack message to the log
    if (message) {
      addLogMessage(message);
    }
    
    syncEnemyHealth();
    
    // Check if combat ended after this attack
    if (engine.getStatus() !== CombatStatus.IN_PROGRESS) {
      processingEnemyTurnsRef.current = false;
      checkCombatEnd();
      refreshState();
      
      setEnemyTurnState({
        isAnimating: false,
        attackingEnemyId: null,
        attackMessage: message,
        pendingAttacks: []
      });
      return;
    }
    
    // Check if next turn is player's
    const nextTurn = engine.getCurrentTurn();
    const moreEnemies = nextTurn && !nextTurn.combatant.isPlayer;
    
    setEnemyTurnState({
      isAnimating: true,
      attackingEnemyId: enemyId,
      attackMessage: message,
      pendingAttacks: moreEnemies ? [{ enemyId: nextTurn!.combatant.id, enemyName: nextTurn!.combatant.name }] : []
    });
    
    refreshState();
  }, [addLogMessage, checkCombatEnd, processSingleEnemyTurn, refreshState, syncEnemyHealth]);

  /**
   * Process enemy turns after player action (legacy - now starts animation).
   */
  const processEnemyTurns = useCallback((): string[] => {
    // Start the step-through animation instead of processing all at once
    startEnemyTurnSequence();
    // Return empty - messages will be shown one at a time
    return [];
  }, [startEnemyTurnSequence]);

  /**
   * Execute a combat action through the CombatEngine.
   */
  const executeCombatAction = useCallback(async (action: Action): Promise<ActionResult> => {
    const engine = combatEngineRef.current;
    if (!engine) {
      return { type: 'error', success: false, message: 'No combat in progress' };
    }

    const state = gameManagerRef.current.getState();
    if (!state.player) {
      return { type: 'error', success: false, message: 'No player' };
    }

    let message = '';

    try {
      // Start player's turn (handles cooldown ticking, status effects)
      engine.startTurn();
      
      switch (action.type) {
        case 'basic_attack': {
          // Get valid targets
          const validTargets = engine.getValidTargets();
          if (validTargets.length === 0) {
            return { type: 'combat', success: false, message: 'No valid targets' };
          }
          
          // Use specified target or first valid target
          const targetId = (action as any).targetId || validTargets[0];
          const result = engine.playerAttack(targetId);
          
          message = formatAttackResult(result);
          break;
        }
        
        case 'ability': {
          const abilityId = (action as any).abilityId as string;
          if (!abilityId) {
            return { type: 'combat', success: false, message: 'No ability specified' };
          }
          
          // Get valid targets for abilities that need them
          const ability = state.player.getAllAbilities().find(a => a.id === abilityId);
          let targetId = (action as any).targetId;
          
          if (!targetId && ability?.targetType === 'enemy') {
            const validTargets = engine.getValidTargets();
            if (validTargets.length > 0) {
              targetId = validTargets[0];
            }
          }
          
          const result = engine.playerUseAbility(abilityId, targetId);
          message = formatAbilityResult(result);
          break;
        }
        
        case 'flee': {
          // Flee attempt - use GameStateManager's flee logic
          const fleeResult = await gameManagerRef.current.executeAction(action);
          if (fleeResult.success) {
            message = 'You fled from combat!';
            endCombat();
            refreshState();
            return { type: 'flee', success: true, message };
          } else {
            message = fleeResult.message || 'Failed to flee!';
          }
          break;
        }
        
        default:
          return { type: 'error', success: false, message: `Unknown combat action: ${action.type}` };
      }

      // Sync enemy health to room after player action (for UI updates)
      syncEnemyHealth();
      
      // Move to next turn (enemy turns)
      engine.nextTurn();
      
      // Process enemy turns after player action
      if (combatEngineRef.current && engine.getStatus() === CombatStatus.IN_PROGRESS) {
        const enemyMessages = processEnemyTurns();
        if (enemyMessages.length > 0) {
          message += ' ' + enemyMessages.join(' ');
        }
        // Sync after enemy turns too
        syncEnemyHealth();
      }

      // Check if combat ended and get reward message
      const rewardMessage = checkCombatEnd();
      if (rewardMessage) {
        message += ' ' + rewardMessage;
      }
      
      refreshState();

      return { type: 'combat', success: true, message };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Combat action failed';
      return { type: 'error', success: false, message: errorMessage };
    }
  }, [checkCombatEnd, endCombat, processEnemyTurns, refreshState]);

  /**
   * Start a new game with the specified class and name.
   */
  const startGame = useCallback(async (playerClass: PlayerClass, name: string, seed?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Create new game manager for fresh start
      gameManagerRef.current = new GameStateManager();
      combatEngineRef.current = null;
      
      // Start the game (this generates the dungeon)
      const gameSeed = seed || Math.random().toString(36).substring(2, 12);
      gameManagerRef.current.startNewGame(playerClass, name, gameSeed);
      
      refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  /**
   * Reset the game to initial state.
   */
  const resetGame = useCallback(() => {
    gameManagerRef.current = new GameStateManager();
    combatEngineRef.current = null;
    setGameState(null);
    setCombatEngine(null);
    setError(null);
  }, []);

  /**
   * Execute a game action and update state.
   * Routes combat actions to CombatEngine, other actions to GameStateManager.
   */
  const executeAction = useCallback(async (action: Action): Promise<ActionResult> => {
    try {
      // Check if we're in combat and need to initialize the engine
      const state = gameManagerRef.current.getState();
      if (state.phase === GamePhase.COMBAT && !combatEngineRef.current) {
        initializeCombat();
      }

      // Route combat actions to the combat engine
      if (isCombatAction(action) && combatEngineRef.current) {
        return await executeCombatAction(action);
      }

      // Non-combat actions go through GameStateManager
      const result = await gameManagerRef.current.executeAction(action);
      
      // Format the message with styling
      if (result.message) {
        result.message = formatGameMessage(result.message);
      }
      
      // Check if we entered combat
      const newState = gameManagerRef.current.getState();
      if (newState.phase === GamePhase.COMBAT && !combatEngineRef.current) {
        initializeCombat();
      }
      
      refreshState();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      return { type: 'error', success: false, message };
    }
  }, [executeCombatAction, initializeCombat, refreshState]);

  // Auto-initialize combat when entering combat phase
  useEffect(() => {
    if (gameState?.phase === GamePhase.COMBAT && !combatEngineRef.current) {
      initializeCombat();
    }
  }, [gameState?.phase, initializeCombat]);

  // Derived state
  const player = gameState?.player ?? null;
  const currentRoom = gameManagerRef.current.getCurrentRoom();
  const availableActions = gameState ? gameManagerRef.current.getAvailableActions() : [];

  const value: GameContextValue = {
    gameState,
    combatEngine,
    isLoading,
    error,
    player,
    currentRoom,
    availableActions,
    enemyTurnState,
    advanceEnemyTurn,
    setLogCallback,
    startGame,
    resetGame,
    executeAction,
    initializeCombat,
    endCombat,
    refreshState,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Format attack result into a readable message with HTML styling.
 * Shows main result with parenthetical breakdown for transparency.
 */
function formatAttackResult(result: AttackResult): string {
  const attackerName = result.attacker?.name || 'Unknown';
  const defenderName = result.defender?.name || 'Unknown';
  const isPlayerAttacking = result.attacker?.isPlayer ?? false;
  
  // Style names based on who's attacking
  const styledAttacker = isPlayerAttacking 
    ? `<span class="log-player">${attackerName}</span>`
    : `<span class="log-enemy">${attackerName}</span>`;
  const styledDefender = isPlayerAttacking 
    ? `<span class="log-enemy">${defenderName}</span>`
    : `<span class="log-player">${defenderName}</span>`;
  
  const roll = result.attackRoll;
  const rollBonus = roll ? roll.total - roll.roll : 0;
  
  // Check if attack missed
  if (!roll?.isHit) {
    if (roll?.isNatural1) {
      return `${styledAttacker} <span class="log-miss">fumbles!</span> <span class="log-roll">(rolled 1)</span>`;
    }
    const rollInfo = `rolled ${roll?.roll}+${rollBonus} vs AC ${roll?.targetDefense}`;
    return `${styledAttacker} <span class="log-miss">misses</span> ${styledDefender} <span class="log-roll">(${rollInfo})</span>`;
  }
  
  const dmg = result.damage;
  const finalDamage = dmg?.finalDamage ?? 0;
  const isCrit = dmg?.isCritical ?? false;
  
  // Style damage based on who's taking it
  const damageClass = isPlayerAttacking ? 'log-heal' : 'log-damage';
  const styledFinalDamage = `<span class="${damageClass}">${finalDamage}</span>`;
  
  // Build parenthetical breakdown
  // Format bonus with proper sign (avoid "+-1")
  const formatBonus = (value: number) => value >= 0 ? `+${value}` : `${value}`;
  
  let breakdown = `rolled ${roll.roll}${formatBonus(rollBonus)}`;
  if (dmg) {
    // Damage part: weaponDamageRoll+bonus, with crit multiplier if applicable
    const weaponRoll = dmg.weaponDamageRoll ?? 0;
    const atkBonus = dmg.attackBonus ?? 0;
    const bonusStr = formatBonus(atkBonus);
    
    if (isCrit && dmg.critMultiplier) {
      breakdown += `, dmg: ${weaponRoll}${bonusStr}×${dmg.critMultiplier}`;
    } else {
      breakdown += `, dmg: ${weaponRoll}${bonusStr}`;
    }
    if (dmg.damageReduction > 0) {
      breakdown += `-${dmg.damageReduction}`;
    }
  }
  
  // Build final message
  const hitVerb = isCrit ? '<span class="log-crit">CRITS</span>' : 'hits';
  let msg = `${styledAttacker} ${hitVerb} ${styledDefender} for ${styledFinalDamage} damage <span class="log-roll">(${breakdown})</span>`;
  
  if (result.defenderDied) {
    msg += ` - <span class="log-crit">defeated!</span>`;
  }
  return msg;
}

/**
 * Format ability result into a readable message with HTML styling.
 */
function formatAbilityResult(result: AbilityResult): string {
  if (!result.success) {
    return `<span class="log-miss">${result.message || 'Ability failed'}</span>`;
  }
  
  // Parse and style the message from CombatEngine
  let msg = result.message || 'Used ability';
  
  // Style ability names
  if (result.abilityName) {
    msg = msg.replace(result.abilityName, `<span class="log-ability">${result.abilityName}</span>`);
  }
  
  // Style damage numbers (look for patterns like "for X damage" or "dealing X damage")
  msg = msg.replace(/(\d+)\s*damage/gi, '<span class="log-heal">$1</span> damage');
  
  // Style healing numbers
  msg = msg.replace(/heals?\s*(?:for\s*)?(\d+)/gi, 'heals <span class="log-heal">$1</span>');
  
  // Style "defeated" text
  msg = msg.replace(/defeated/gi, '<span class="log-crit">defeated</span>');
  
  // Style gold amounts
  msg = msg.replace(/(\d+)\s*gold/gi, '<span class="log-gold">$1</span> gold');
  
  // Style XP amounts
  msg = msg.replace(/(\d+)\s*(?:XP|experience)/gi, '<span class="log-gold">$1</span> XP');
  
  return msg;
}

/**
 * Format an item name with its rarity color.
 */
function formatItemWithRarity(name: string, rarity: string): string {
  const rarityClass = getRarityClass(rarity);
  return `<span class="${rarityClass}">${name}</span>`;
}

/**
 * Get the CSS class for an item rarity.
 */
function getRarityClass(rarity: string): string {
  switch (rarity?.toLowerCase()) {
    case 'common': return 'log-item-common';
    case 'uncommon': return 'log-item-uncommon';
    case 'rare': return 'log-item-rare';
    case 'very_rare': return 'log-item-veryrare';
    case 'legendary': return 'log-item-legendary';
    default: return 'log-item';
  }
}

/**
 * Format a generic game message with HTML styling.
 */
function formatGameMessage(message: string): string {
  let msg = message;
  
  // Style gold amounts
  msg = msg.replace(/(\d+)\s*gold/gi, '<span class="log-gold">$1</span> gold');
  
  // Style XP amounts  
  msg = msg.replace(/(\d+)\s*(?:XP|experience)/gi, '<span class="log-gold">$1</span> XP');
  
  // Style damage numbers
  msg = msg.replace(/(\d+)\s*damage/gi, '<span class="log-damage">$1</span> damage');
  
  // Style healing/restoration
  msg = msg.replace(/(?:heals?|restored?|gained?|refreshed)\s*(\d+)?\s*(?:HP|health|mana|MP)?/gi, 
    (match, num) => {
      if (num) {
        return match.replace(num, `<span class="log-heal">${num}</span>`);
      }
      return `<span class="log-heal">${match}</span>`;
    });
  
  // Style "refreshed" for rest
  msg = msg.replace(/feel refreshed/gi, '<span class="log-heal">feel refreshed</span>');
  
  // Style "Victory" and "defeated"
  msg = msg.replace(/victory/gi, '<span class="log-crit">Victory</span>');
  msg = msg.replace(/defeated/gi, '<span class="log-crit">defeated</span>');
  
  // Style "escaped" and flee messages
  msg = msg.replace(/escaped/gi, '<span class="log-flee">escaped</span>');
  msg = msg.replace(/failed to escape/gi, '<span class="log-damage">failed to escape</span>');
  
  // Style item actions (bought, sold, equipped, unequipped, used, found)
  msg = msg.replace(/(Bought|Sold|Equipped|Unequipped|Used|Found)\s+([^for]+?)(?:\s+for|\s*$)/gi, 
    (match, action, item) => `<span class="log-item">${action}</span> <span class="log-item-uncommon">${item.trim()}</span> `);
  
  // Style room type mentions
  msg = msg.replace(/(Combat|Elite|Boss|Treasure|Shop|Rest|Event|Puzzle)\s*(Room|room)?/gi, 
    '<span class="log-room">$1 $2</span>');
  
  // Style puzzle messages
  msg = msg.replace(/puzzle solved/gi, '<span class="log-crit">Puzzle Solved!</span>');
  msg = msg.replace(/puzzle failed/gi, '<span class="log-damage">Puzzle Failed</span>');
  msg = msg.replace(/wrong answer/gi, '<span class="log-damage">Wrong Answer</span>');
  msg = msg.replace(/correct/gi, '<span class="log-heal">Correct!</span>');
  
  // Style status effects
  msg = msg.replace(/(poisoned|burned|frozen|stunned|weakened|cursed)/gi, 
    '<span class="log-status">$1</span>');
  msg = msg.replace(/(blessed|strengthened|shielded|regenerating)/gi, 
    '<span class="log-heal">$1</span>');
  
  // Style trap messages
  msg = msg.replace(/trap/gi, '<span class="log-damage">trap</span>');
  msg = msg.replace(/disarmed/gi, '<span class="log-heal">disarmed</span>');
  
  // Style chest/treasure messages
  msg = msg.replace(/opened.*chest/gi, '<span class="log-gold">opened a chest</span>');
  
  return msg;
}

/**
 * Hook to access game context.
 * Must be used within a GameProvider.
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
