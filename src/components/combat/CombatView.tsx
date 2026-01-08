import { useState, useCallback, useEffect, useRef } from 'react';
import { Enemy } from '../../entities/enemy';
import { Action } from '../../game/gameState';
import { EnemyCard } from './EnemyCard';
import { ActionButtons } from '../ui/ActionButtons';
import { useGame } from '../../context/GameContext';
import { useTutorial } from '../../context/TutorialContext';

interface CombatViewProps {
  enemies: Enemy[];
  availableActions: Action[];
  onAction: (action: Action) => void;
  combatLog?: string[];
  currentTurn?: 'player' | 'enemy';
  targetedEnemyId?: string;
}

/** Auto-advance delay in milliseconds */
const ENEMY_TURN_DELAY = 1500;

/**
 * Main combat view showing enemies, actions, and combat state.
 */
export function CombatView({
  enemies,
  availableActions,
  onAction,
  combatLog = [],
  currentTurn = 'player',
  targetedEnemyId
}: CombatViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<Enemy | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  
  // Get enemy turn state from context
  const { enemyTurnState, advanceEnemyTurn, player } = useGame();
  
  // Tutorial context
  const { showHint, hasSeenHint } = useTutorial();
  
  // Timer ref for auto-advance
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Show abilities tutorial when player has abilities available
  useEffect(() => {
    if (!hasSeenHint('abilities')) {
      const hasAbilityAction = availableActions.some(a => a.type === 'ability');
      if (hasAbilityAction) {
        const timer = setTimeout(() => showHint('abilities'), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [availableActions, hasSeenHint, showHint]);
  
  // Show items tutorial when player has usable items
  useEffect(() => {
    if (!hasSeenHint('items')) {
      const hasItemAction = availableActions.some(a => a.type === 'use_item');
      if (hasItemAction) {
        const timer = setTimeout(() => showHint('items'), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [availableActions, hasSeenHint, showHint]);

  // Check if any action requires targeting
  const requiresTargeting = (action: Action): boolean => {
    // Attack and ability actions typically require a target
    return action.type === 'basic_attack' || action.type === 'ability';
  };

  // Get living enemies for targeting
  const livingEnemies = enemies.filter(e => e.health > 0);

  // Handle action button click
  const handleActionClick = useCallback((action: Action) => {
    // If action requires targeting and multiple enemies exist
    if (requiresTargeting(action) && livingEnemies.length > 1) {
      setPendingAction(action);
      setSelectedTarget(null);
    } else if (requiresTargeting(action) && livingEnemies.length === 1) {
      // Auto-target if only one enemy
      const targetedAction = { ...action, targetId: livingEnemies[0].id };
      onAction(targetedAction);
    } else {
      // Non-targeting actions (flee, use item, etc.)
      onAction(action);
    }
  }, [livingEnemies, onAction]);

  // Handle enemy selection for targeting
  const handleTargetSelect = useCallback((enemy: Enemy) => {
    if (pendingAction) {
      const targetedAction = { ...pendingAction, targetId: enemy.id };
      onAction(targetedAction);
      setPendingAction(null);
      setSelectedTarget(null);
    }
  }, [pendingAction, onAction]);

  // Cancel targeting mode
  const handleCancelTargeting = useCallback(() => {
    setPendingAction(null);
    setSelectedTarget(null);
  }, []);

  // Handle click anywhere to advance enemy turn faster
  const handleAdvanceClick = useCallback(() => {
    if (enemyTurnState.isAnimating && enemyTurnState.attackingEnemyId) {
      // Clear auto-advance timer
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      advanceEnemyTurn();
    }
  }, [enemyTurnState, advanceEnemyTurn]);

  // Auto-advance enemy turns after delay
  useEffect(() => {
    if (enemyTurnState.isAnimating) {
      // If we have an attacking enemy showing, set timer to advance
      if (enemyTurnState.attackingEnemyId) {
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceEnemyTurn();
        }, ENEMY_TURN_DELAY);
      } else {
        // Start the first enemy attack immediately
        advanceEnemyTurn();
      }
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [enemyTurnState.isAnimating, enemyTurnState.attackingEnemyId, advanceEnemyTurn]);

  const isTargetingMode = pendingAction !== null;
  const isPlayerTurn = currentTurn === 'player' && !enemyTurnState.isAnimating;
  const isEnemyTurnAnimating = enemyTurnState.isAnimating;

  return (
    <div className="combat-view" onClick={isEnemyTurnAnimating ? handleAdvanceClick : undefined}>
      {/* Combat Header */}
      <div className="combat-header">
        <h2>⚔️ Combat!</h2>
        <div className="turn-indicator">
          {isPlayerTurn ? (
            <span className="player-turn">Your Turn</span>
          ) : (
            <span className="enemy-turn">Enemy Turn</span>
          )}
        </div>
      </div>

      {/* Enemy Display Area */}
      <div className="enemies-section">
        <div className="enemies-list">
          {enemies.map((enemy, index) => (
            <EnemyCard
              key={enemy.id}
              enemy={enemy}
              index={index}
              isTargeted={targetedEnemyId === enemy.id || selectedTarget?.id === enemy.id}
              isSelectable={isTargetingMode && enemy.health > 0}
              isAttacking={enemyTurnState.attackingEnemyId === enemy.id}
              onSelect={handleTargetSelect}
            />
          ))}
        </div>
      </div>

      {/* Enemy Attack Message Overlay */}
      {isEnemyTurnAnimating && enemyTurnState.attackMessage && (
        <div className="enemy-attack-overlay" onClick={handleAdvanceClick}>
          <div 
            className="enemy-attack-message"
            dangerouslySetInnerHTML={{ __html: enemyTurnState.attackMessage }}
          />
          <p className="click-to-continue">Click anywhere to continue</p>
        </div>
      )}

      {/* Targeting Mode Overlay */}
      {isTargetingMode && (
        <div className="targeting-mode">
          <div className="targeting-prompt">
            <span className="targeting-text">
              Select a target for <strong>{pendingAction?.type === 'ability' ? pendingAction.name : 'Attack'}</strong>
            </span>
            <button 
              className="cancel-targeting-btn"
              onClick={handleCancelTargeting}
            >
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Action Area */}
      <div className="combat-actions">
        {!isTargetingMode && isPlayerTurn && (
          <ActionButtons
            actions={availableActions}
            onAction={handleActionClick}
            disabled={!isPlayerTurn}
          />
        )}
        
        {!isPlayerTurn && !isEnemyTurnAnimating && (
          <div className="waiting-message">
            <p>Waiting for enemies...</p>
          </div>
        )}
      </div>
    </div>
  );
}

