import { GameState, GamePhase, Action } from '../../game/gameState';
import { Room } from '../../dungeon/room';
import { Player } from '../../entities/player';
import { ActionButtons, TutorialTrigger } from '../ui';
import { CombatView } from '../combat';
import { ShopView, EventView, PuzzleView, TreasureView, RestView } from '../rooms';
import { RoomNavigator } from '../navigation';

interface MainContentProps {
  state: GameState;
  currentRoom: Room | null;
  player: Player | null;
  availableActions: Action[];
  onAction: (action: Action) => void;
  messageLog?: string[];
}

/**
 * Exploration view for navigating between rooms.
 */
function ExplorationView({ 
  state,
  currentRoom, 
  availableActions, 
  onAction 
}: { 
  state: GameState;
  currentRoom: Room | null;
  availableActions: Action[];
  onAction: (action: Action) => void;
}) {
  if (!currentRoom) {
    return <div className="room-view"><p>No room</p></div>;
  }

  // Get non-move actions (inventory, character, etc.)
  const nonMoveActions = availableActions.filter(a => a.type !== 'move');

  return (
    <div className="room-view exploration-view">
      {/* Room Description */}
      <div className="room-description">
        <p>{currentRoom.description || 'You stand in a dungeon room. Paths lead in various directions.'}</p>
      </div>
      
      {/* Show interactables if any */}
      {currentRoom.interactables && currentRoom.interactables.filter(i => !i.used).length > 0 && (
        <div className="room-interactables">
          <p>🔍 Objects to interact with: {currentRoom.interactables.filter(i => !i.used).length}</p>
        </div>
      )}

      {/* Visual Room Navigator */}
      <RoomNavigator 
        state={state}
        currentRoom={currentRoom}
        availableActions={availableActions}
        onAction={onAction}
      />

      {/* Non-move action buttons (inventory, character, interact) */}
      {nonMoveActions.length > 0 && (
        <div className="exploration-actions">
          <ActionButtons actions={nonMoveActions} onAction={onAction} />
        </div>
      )}
    </div>
  );
}

/**
 * Main content area that routes to phase-specific views.
 * Contains the primary game view and action buttons.
 */
export function MainContent({ 
  state, 
  currentRoom, 
  player,
  availableActions, 
  onAction,
  messageLog = []
}: MainContentProps) {
  // Check if this is a boss room
  const isBossRoom = currentRoom?.enemies?.some(e => e.isBoss) ?? false;
  
  // Check if there are multiple enemies (for targeting hint)
  const hasMultipleEnemies = (currentRoom?.enemies?.filter(e => e.health > 0).length ?? 0) > 1;

  // Render phase-specific view
  const renderPhaseView = () => {
    switch (state.phase) {
      case GamePhase.COMBAT:
        return (
          <>
            {/* Tutorial triggers for combat */}
            <TutorialTrigger hintId="first_combat" delay={800} />
            {isBossRoom && <TutorialTrigger hintId="boss" delay={500} />}
            {hasMultipleEnemies && <TutorialTrigger hintId="targeting" delay={1500} />}
            
            <CombatView 
              enemies={currentRoom?.enemies ?? []}
              availableActions={availableActions}
              onAction={onAction}
              combatLog={messageLog}
              currentTurn="player"
            />
          </>
        );
      
      case GamePhase.SHOP:
        if (currentRoom && player) {
          return (
            <>
              <TutorialTrigger hintId="shop" delay={500} />
              <ShopView 
                room={currentRoom} 
                player={player} 
                onAction={onAction} 
              />
            </>
          );
        }
        break;
      
      case GamePhase.EVENT:
        if (currentRoom) {
          return (
            <>
              <TutorialTrigger hintId="event" delay={500} />
              <EventView room={currentRoom} onAction={onAction} />
            </>
          );
        }
        break;
      
      case GamePhase.PUZZLE:
        if (currentRoom) {
          return (
            <>
              <TutorialTrigger hintId="puzzle" delay={500} />
              <PuzzleView room={currentRoom} onAction={onAction} />
            </>
          );
        }
        break;
      
      case GamePhase.TREASURE:
        if (currentRoom) {
          return (
            <>
              <TutorialTrigger hintId="treasure" delay={500} />
              <TreasureView room={currentRoom} onAction={onAction} />
            </>
          );
        }
        break;
      
      case GamePhase.REST:
        if (player) {
          return (
            <>
              <TutorialTrigger hintId="rest" delay={500} />
              <RestView player={player} onAction={onAction} />
            </>
          );
        }
        break;
      
      case GamePhase.EXPLORATION:
      default:
        return (
          <>
            {/* Navigation hint on first exploration */}
            <TutorialTrigger hintId="navigation" delay={1000} />
            <ExplorationView 
              state={state}
              currentRoom={currentRoom} 
              availableActions={availableActions}
              onAction={onAction}
            />
          </>
        );
    }
    
    // Fallback
    return (
      <ExplorationView 
        state={state}
        currentRoom={currentRoom} 
        availableActions={availableActions}
        onAction={onAction}
      />
    );
  };

  // Combat and Exploration views handle their own action buttons
  const showActionButtons = ![
    GamePhase.COMBAT, 
    GamePhase.EXPLORATION,
    GamePhase.SHOP,
    GamePhase.EVENT,
    GamePhase.PUZZLE,
    GamePhase.TREASURE,
    GamePhase.REST,
  ].includes(state.phase);

  return (
    <main className="game-main">
      {renderPhaseView()}
      {showActionButtons && (
        <ActionButtons actions={availableActions} onAction={onAction} />
      )}
    </main>
  );
}
