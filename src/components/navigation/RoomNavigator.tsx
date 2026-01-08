import { useState, useCallback } from 'react';
import { Room, RoomType, RoomState } from '../../dungeon/room';
import { Action, GameState } from '../../game/gameState';

interface RoomNavigatorProps {
  state: GameState;
  currentRoom: Room;
  availableActions: Action[];
  onAction: (action: Action) => void;
}

/**
 * Gets icon for room type.
 */
function getRoomIcon(type: RoomType): string {
  switch (type) {
    case RoomType.ENTRANCE: return '🚪';
    case RoomType.COMBAT: return '⚔️';
    case RoomType.ELITE: return '💀';
    case RoomType.BOSS: return '👹';
    case RoomType.TREASURE: return '💎';
    case RoomType.SHOP: return '🛒';
    case RoomType.REST: return '🏕️';
    case RoomType.EVENT: return '❓';
    case RoomType.PUZZLE: return '🧩';
    default: return '◆';
  }
}

/**
 * Gets color class for room type.
 */
function getRoomColorClass(type: RoomType): string {
  switch (type) {
    case RoomType.COMBAT:
    case RoomType.ELITE:
    case RoomType.BOSS:
      return 'room-hostile';
    case RoomType.TREASURE:
      return 'room-treasure';
    case RoomType.SHOP:
      return 'room-shop';
    case RoomType.REST:
      return 'room-rest';
    case RoomType.EVENT:
    case RoomType.PUZZLE:
      return 'room-special';
    default:
      return 'room-neutral';
  }
}

/**
 * Format room type for display.
 */
function formatRoomType(type: RoomType): string {
  switch (type) {
    case RoomType.ELITE: return 'Elite Combat';
    case RoomType.BOSS: return 'Boss';
    case RoomType.VERY_RARE: return 'Very Rare';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}

interface RoomCardProps {
  room: Room;
  isCurrent?: boolean;
  isPrevious?: boolean;
  isNext?: boolean;
  isHovered?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}

/**
 * Individual room card component.
 */
function RoomCard({ 
  room, 
  isCurrent, 
  isPrevious, 
  isNext, 
  isHovered,
  onHover, 
  onLeave, 
  onClick 
}: RoomCardProps) {
  const colorClass = getRoomColorClass(room.type);
  const stateClass = room.state.toLowerCase();
  
  return (
    <div
      className={`nav-room-card ${colorClass} ${stateClass} ${isCurrent ? 'current' : ''} ${isPrevious ? 'previous' : ''} ${isNext ? 'next selectable' : ''} ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={isNext ? onClick : undefined}
      role={isNext ? 'button' : undefined}
      tabIndex={isNext ? 0 : undefined}
    >
      <div className="nav-room-icon">{getRoomIcon(room.type)}</div>
      <div className="nav-room-info">
        <span className="nav-room-type">{formatRoomType(room.type)}</span>
        <span className="nav-room-level">Level {room.level}</span>
      </div>
      {isCurrent && <div className="nav-room-marker current-marker">YOU ARE HERE</div>}
      {isPrevious && <div className="nav-room-marker previous-marker">CAME FROM</div>}
      {isNext && <div className="nav-room-marker next-marker">CHOOSE PATH</div>}
    </div>
  );
}

/**
 * Connection line between rooms.
 */
function ConnectionLine({ isActive, direction }: { isActive: boolean; direction: 'up' | 'down' }) {
  return (
    <div className={`nav-connection ${direction} ${isActive ? 'active' : ''}`}>
      <div className="connection-line" />
      <div className="connection-arrow">{direction === 'down' ? '▼' : '▲'}</div>
    </div>
  );
}

/**
 * Room Navigator component showing visual path navigation.
 */
export function RoomNavigator({ state, currentRoom, availableActions, onAction }: RoomNavigatorProps) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  
  // Get move actions (rooms we can go to)
  const moveActions = availableActions.filter(a => a.type === 'move');
  const nextRoomIds = new Set(moveActions.map(a => a.roomId));
  
  // Get the rooms we can move to
  const nextRooms: Room[] = [];
  moveActions.forEach(action => {
    if (action.roomId) {
      const room = state.dungeon.rooms.get(action.roomId);
      if (room) nextRooms.push(room);
    }
  });
  
  // Find previous room(s) - rooms on the previous level that connect to current
  const previousRooms: Room[] = [];
  const currentLevel = currentRoom.level;
  const prevLayer = state.dungeon.layers.find(l => l.level === currentLevel - 1);
  if (prevLayer) {
    prevLayer.rooms.forEach(room => {
      if (room.connections.includes(currentRoom.id) && room.state === RoomState.CLEARED) {
        previousRooms.push(room);
      }
    });
  }
  
  // Handle room selection
  const handleRoomClick = useCallback((roomId: string) => {
    const action = moveActions.find(a => a.roomId === roomId);
    if (action) {
      onAction(action);
    }
  }, [moveActions, onAction]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, roomId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRoomClick(roomId);
    }
  }, [handleRoomClick]);

  return (
    <div className="room-navigator">
      {/* Previous Rooms (where we came from) */}
      {previousRooms.length > 0 && (
        <div className="nav-section nav-previous">
          <div className="nav-section-label">Came From</div>
          <div className="nav-rooms-row">
            {previousRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                isPrevious
              />
            ))}
          </div>
          <ConnectionLine direction="down" isActive />
        </div>
      )}
      
      {/* Current Room */}
      <div className="nav-section nav-current">
        <RoomCard
          room={currentRoom}
          isCurrent
        />
      </div>
      
      {/* Next Rooms (choices) */}
      {nextRooms.length > 0 && (
        <div className="nav-section nav-next">
          <ConnectionLine direction="down" isActive={hoveredRoomId !== null} />
          <div className="nav-section-label">Choose Your Path</div>
          <div className="nav-rooms-row">
            {nextRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                isNext
                isHovered={hoveredRoomId === room.id}
                onHover={() => setHoveredRoomId(room.id)}
                onLeave={() => setHoveredRoomId(null)}
                onClick={() => handleRoomClick(room.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* No more rooms message */}
      {nextRooms.length === 0 && currentRoom.type !== RoomType.BOSS && (
        <div className="nav-section nav-end">
          <p className="nav-end-message">No paths available. Complete the current room first.</p>
        </div>
      )}
    </div>
  );
}

