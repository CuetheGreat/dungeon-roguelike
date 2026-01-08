import { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTutorial } from '../context/TutorialContext';
import { GamePhase, Action } from '../game/gameState';
import { StartScreen, GameOverScreen, VictoryScreen } from './screens';
import { LeftSidebar, RightSidebar, MainContent } from './layout';
import { InventoryModal, CharacterModal } from './modals';

/**
 * Loading screen component.
 */
function LoadingScreen() {
  return (
    <div id="loading-screen" className="screen">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p className="loading-text">Generating dungeon...</p>
      </div>
    </div>
  );
}

/**
 * Seed display component with copy functionality.
 */
function SeedDisplay({ seed }: { seed: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(seed).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [seed]);

  return (
    <div className="seed-display">
      <span className="seed-label">Seed:</span>
      <span 
        className="seed-value" 
        title="Click to copy"
        onClick={handleCopy}
        style={{ cursor: 'pointer' }}
      >
        {copied ? 'Copied!' : seed}
      </span>
    </div>
  );
}

/**
 * Main game screen with full layout.
 */
function GameScreen() {
  const { gameState, player, currentRoom, availableActions, executeAction, setLogCallback } = useGame();
  const [messageLog, setMessageLog] = useState<string[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  
  // Import tutorial hook
  const { showHint, hasSeenHint } = useTutorial();

  // Show welcome hint when game starts
  useEffect(() => {
    if (gameState && !hasSeenHint('welcome')) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        showHint('welcome');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameState, showHint, hasSeenHint]);

  // Register log callback for enemy turn messages
  useEffect(() => {
    const addMessage = (message: string) => {
      setMessageLog(prev => [...prev.slice(-19), message]);
    };
    setLogCallback(addMessage);
    
    return () => {
      setLogCallback(null);
    };
  }, [setLogCallback]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowInventory(false);
        setShowCharacter(false);
        return;
      }
      
      // Don't handle number keys if modals are open
      if (showInventory || showCharacter) return;
      
      // Number keys 1-9 for action selection
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < availableActions.length) {
          handleAction(availableActions[index]);
        }
      }
      
      // 'I' for inventory
      if (e.key.toLowerCase() === 'i') {
        setShowInventory(true);
      }
      
      // 'C' for character
      if (e.key.toLowerCase() === 'c') {
        setShowCharacter(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [availableActions, showInventory, showCharacter]);

  // Handle action execution
  const handleAction = useCallback(async (action: Action) => {
    // Handle special UI actions
    if (action.type === 'open_inventory') {
      setShowInventory(true);
      // Show inventory tutorial on first open
      if (!hasSeenHint('inventory')) {
        setTimeout(() => showHint('inventory'), 300);
      }
      return;
    }
    if (action.type === 'view_character') {
      setShowCharacter(true);
      return;
    }
    
    const result = await executeAction(action);
    
    // Add result message to log
    if (result.message) {
      setMessageLog(prev => [...prev.slice(-19), result.message!]);
    }
  }, [executeAction, hasSeenHint, showHint]);

  // Handle modal actions
  const handleModalAction = useCallback(async (action: Action) => {
    const result = await executeAction(action);
    if (result.message) {
      setMessageLog(prev => [...prev.slice(-19), result.message!]);
    }
  }, [executeAction]);

  if (!gameState || !player) {
    return <LoadingScreen />;
  }

  return (
    <div id="game-screen" className="screen">
      <div className="game-layout">
        <LeftSidebar player={player} stats={gameState.stats} />
        <MainContent 
          state={gameState}
          currentRoom={currentRoom}
          player={player}
          availableActions={availableActions}
          onAction={handleAction}
          messageLog={messageLog}
        />
        <RightSidebar state={gameState} messageLog={messageLog} />
        <SeedDisplay seed={gameState.seed} />
      </div>

      {/* Modals */}
      {showInventory && (
        <InventoryModal
          player={player}
          onAction={handleModalAction}
          onClose={() => setShowInventory(false)}
        />
      )}
      
      {showCharacter && (
        <CharacterModal
          player={player}
          stats={gameState.stats}
          onClose={() => setShowCharacter(false)}
        />
      )}
    </div>
  );
}

/**
 * Main game container component.
 * Routes to different screens based on game state and phase.
 */
export function GameContainer() {
  const { gameState, isLoading, error, startGame, resetGame } = useGame();

  // No game state yet - show start screen
  if (!gameState) {
    return (
      <StartScreen 
        onStart={startGame} 
        isLoading={isLoading} 
        error={error} 
      />
    );
  }

  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Route based on game phase
  switch (gameState.phase) {
    case GamePhase.GAME_OVER:
      return (
        <GameOverScreen 
          stats={gameState.stats} 
          onRestart={resetGame} 
        />
      );

    case GamePhase.VICTORY:
      return (
        <VictoryScreen 
          stats={gameState.stats} 
          onRestart={resetGame} 
        />
      );

    // All other phases show the game screen
    default:
      return <GameScreen />;
  }
}
