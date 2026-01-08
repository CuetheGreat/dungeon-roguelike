import { Room } from '../../dungeon/room';
import { Interactable } from '../../dungeon/Interactable';
import { Action } from '../../game/gameState';

interface TreasureViewProps {
  room: Room;
  onAction: (action: Action) => void;
}

/**
 * Gets the icon for an interactable type.
 */
function getInteractableIcon(type: string): string {
  switch (type) {
    case 'chest': return '📦';
    case 'trap': return '⚠️';
    case 'altar': return '⛩️';
    case 'lever': return '🔧';
    case 'npc': return '👤';
    case 'fountain': return '⛲';
    case 'statue': return '🗿';
    default: return '❓';
  }
}

/**
 * Gets the action verb for an interactable type.
 */
function getInteractableAction(type: string): string {
  switch (type) {
    case 'chest': return 'Open';
    case 'trap': return 'Disarm';
    case 'altar': return 'Pray';
    case 'lever': return 'Pull';
    case 'npc': return 'Talk';
    case 'fountain': return 'Drink';
    case 'statue': return 'Examine';
    default: return 'Interact';
  }
}

/**
 * Individual interactable card.
 */
function InteractableCard({ 
  interactable, 
  index, 
  onInteract 
}: { 
  interactable: Interactable; 
  index: number; 
  onInteract: () => void;
}) {
  return (
    <div className={`interactable-card ${interactable.used ? 'used' : 'available'}`}>
      <span className="interactable-icon">
        {getInteractableIcon(interactable.type)}
      </span>
      <span className="interactable-name">{interactable.name}</span>
      {!interactable.used ? (
        <button className="interact-btn" onClick={onInteract}>
          {getInteractableAction(interactable.type)}
        </button>
      ) : (
        <span className="used-label">Used</span>
      )}
    </div>
  );
}

/**
 * Treasure view component for treasure rooms.
 */
export function TreasureView({ room, onAction }: TreasureViewProps) {
  const interactables = room.interactables || [];
  const unusedInteractables = interactables.filter(i => !i.used);
  const hasUnopened = unusedInteractables.length > 0;

  const handleInteract = (index: number, name: string) => {
    onAction({ type: 'interact', interactableIndex: index, interactableName: name });
  };

  const handleLeave = () => {
    onAction({ type: 'leave' });
  };

  return (
    <div className="treasure-view">
      {/* Treasure Header */}
      <div className="treasure-header">
        <span className="treasure-icon">💎</span>
        <h2 className="treasure-title">Treasure Chamber</h2>
        <p className="treasure-subtitle">Fortune favors the bold...</p>
      </div>
      
      <p className="treasure-description">
        {room.description || 'Glittering treasures await those brave enough to claim them.'}
      </p>

      {/* Interactables Grid */}
      {hasUnopened ? (
        <div className="interactables-grid">
          {interactables.map((interactable, index) => (
            <InteractableCard
              key={`${interactable.type}-${index}`}
              interactable={interactable}
              index={index}
              onInteract={() => handleInteract(index, interactable.name)}
            />
          ))}
        </div>
      ) : (
        <p className="no-treasures">All treasures have been claimed.</p>
      )}

      {/* Leave Button */}
      <button className="leave-treasure-btn" onClick={handleLeave}>
        Leave Room
      </button>
    </div>
  );
}

