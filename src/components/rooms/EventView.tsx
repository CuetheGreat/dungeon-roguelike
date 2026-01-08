import { Room } from '../../dungeon/room';
import { EventOutcome } from '../../events/mysteriousEvent';
import { Action } from '../../game/gameState';

interface EventViewProps {
  room: Room;
  onAction: (action: Action) => void;
}

/**
 * Gets the icon for an event outcome type.
 */
function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    'buff': '⬆️',
    'debuff': '⬇️',
    'weapon': '⚔️',
    'armor': '🛡️',
    'potion': '🧪',
    'gold': '💰',
    'heal': '💚',
    'damage': '💔',
  };
  return icons[type] || '❓';
}

/**
 * Gets detailed content for an event outcome.
 */
function OutcomeDetails({ outcome }: { outcome: EventOutcome }) {
  switch (outcome.type) {
    case 'buff':
    case 'debuff':
      if (outcome.statBonus) {
        return (
          <div className="outcome-stats">
            {Object.entries(outcome.statBonus).map(([stat, value]) => (
              <span 
                key={stat} 
                className={`stat-change ${(value as number) > 0 ? 'positive' : 'negative'}`}
              >
                {(value as number) > 0 ? '+' : ''}{value as number} {stat}
              </span>
            ))}
            {outcome.duration && <span> for {outcome.duration} turns</span>}
          </div>
        );
      }
      return null;
    case 'weapon':
    case 'armor':
    case 'potion':
      return outcome.item ? (
        <div className="outcome-item">Received: {outcome.item.name}</div>
      ) : null;
    case 'gold':
      return outcome.gold ? (
        <div className="outcome-gold">+{outcome.gold} gold</div>
      ) : null;
    case 'heal':
      return outcome.healthChange ? (
        <div className="outcome-heal">
          Heals {Math.floor(outcome.healthChange * 100)}% of max HP
        </div>
      ) : null;
    case 'damage':
      return outcome.healthChange ? (
        <div className="outcome-damage">
          Deals {Math.floor(Math.abs(outcome.healthChange) * 100)}% of max HP
        </div>
      ) : null;
    default:
      return null;
  }
}

/**
 * Event view component for random event rooms.
 */
export function EventView({ room, onAction }: EventViewProps) {
  const event = room.event;
  
  if (!event) {
    return (
      <div className="event-view">
        <p>No event</p>
      </div>
    );
  }

  const outcome = event.outcome;
  const outcomeClass = outcome.isPositive ? 'positive' : 'negative';

  const handleAccept = () => {
    onAction({ type: 'accept_event', name: 'Accept Your Fate' });
  };

  return (
    <div className="event-view">
      <div className="event-container">
        {/* Event Header */}
        <div className="event-header">
          <span className="event-icon">{getEventIcon(outcome.type)}</span>
          <h2 className="event-title">{event.title}</h2>
        </div>
        
        {/* Event Description */}
        <div className="event-description">
          <p>{event.description}</p>
        </div>
        
        {/* Event Outcome */}
        <div className={`event-outcome ${outcomeClass}`}>
          <div className="outcome-icon">
            {outcome.isPositive ? '✨' : '💀'}
          </div>
          <div className="outcome-details">
            <h3 className="outcome-name">{outcome.name}</h3>
            <p className="outcome-description">{outcome.description}</p>
            <OutcomeDetails outcome={outcome} />
          </div>
        </div>
        
        {/* Accept Button */}
        <div className="event-hint">
          <p>Click "Accept Your Fate" to continue...</p>
        </div>
        
        <div className="event-actions">
          <button className="accept-event-btn" onClick={handleAccept}>
            Accept Your Fate
          </button>
        </div>
      </div>
    </div>
  );
}

