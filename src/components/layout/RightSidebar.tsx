import { useEffect, useRef } from 'react';
import { GameState } from '../../game/gameState';
import { Room, RoomType, RoomState } from '../../dungeon/room';

interface RightSidebarProps {
  state: GameState;
  messageLog: string[];
}

/**
 * Formats room type for display.
 */
function formatRoomType(type: RoomType): string {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Gets icon for room type.
 */
function getRoomIcon(type: RoomType): string {
  switch (type) {
    case RoomType.ENTRANCE: return '🚪';
    case RoomType.COMBAT: return '⚔';
    case RoomType.ELITE: return '💀';
    case RoomType.BOSS: return '👑';
    case RoomType.TREASURE: return '💎';
    case RoomType.SHOP: return '🛒';
    case RoomType.REST: return '🏕';
    case RoomType.EVENT: return '❓';
    case RoomType.PUZZLE: return '🧩';
    default: return '◆';
  }
}

/**
 * Gets the current room from game state.
 */
function getCurrentRoom(state: GameState): Room | null {
  if (!state.dungeon.currentRoomId) return null;
  return state.dungeon.rooms.get(state.dungeon.currentRoomId) ?? null;
}

interface MinimapProps {
  state: GameState;
}

/**
 * Minimap component showing dungeon structure.
 */
function Minimap({ state }: MinimapProps) {
  const currentRoom = getCurrentRoom(state);
  const currentLevel = currentRoom?.level ?? 1;

  // Find rooms that connect TO current room (came from - previous level)
  const cameFromRooms = new Set<string>();
  // Find rooms that current room connects TO (can go to - next level)
  const canGoToRooms = new Set<string>(currentRoom?.connections ?? []);

  // Find which rooms on previous level connect to current room
  if (currentRoom) {
    const prevLayer = state.dungeon.layers.find(l => l.level === currentLevel - 1);
    if (prevLayer) {
      prevLayer.rooms.forEach(room => {
        if (room.connections.includes(currentRoom.id)) {
          cameFromRooms.add(room.id);
        }
      });
    }
  }

  // Show levels: previous, current, next (in order from top to bottom)
  const levelsToShow = [currentLevel - 1, currentLevel, currentLevel + 1].filter(l => l >= 1);

  return (
    <div className="minimap">
      <div className="minimap-header">
        <h3>Dungeon Map</h3>
        <span className="current-level">Level {currentLevel}</span>
      </div>

      <div className="minimap-content">
        {levelsToShow.map(levelNum => {
          const layer = state.dungeon.layers.find(l => l.level === levelNum);
          if (!layer) return null;

          return (
            <div 
              key={levelNum}
              className={`minimap-level ${levelNum === currentLevel ? 'current-level-row' : ''}`}
              data-level={levelNum}
            >
              <div className="minimap-level-label">
                {levelNum < currentLevel && (
                  <><span className="level-arrow up">▲</span> L{levelNum}</>
                )}
                {levelNum > currentLevel && (
                  <>L{levelNum} <span className="level-arrow down">▼</span></>
                )}
                {levelNum === currentLevel && (
                  <><span className="level-marker">▶</span> L{levelNum}</>
                )}
              </div>

              <div className="minimap-rooms">
                {layer.rooms.map((room) => {
                  const isCurrent = room.id === state.dungeon.currentRoomId;
                  const cameFrom = cameFromRooms.has(room.id);
                  const canGoTo = canGoToRooms.has(room.id) && !isCurrent;

                  let stateLabel = room.state === RoomState.CLEARED ? 'Cleared' :
                                   room.state === RoomState.AVAILABLE ? 'Available' :
                                   room.state === RoomState.ACTIVE ? 'Current' : 'Locked';
                  if (cameFrom) stateLabel += ' (Came from)';
                  if (canGoTo && room.state === RoomState.AVAILABLE) stateLabel += ' (Can go)';

                  return (
                    <div
                      key={room.id}
                      className={`minimap-room ${room.state.toLowerCase()} room-${room.type.toLowerCase()} ${isCurrent ? 'current' : ''} ${cameFrom ? 'came-from' : ''} ${canGoTo ? 'can-go-to' : ''}`}
                      data-room-id={room.id}
                      title={`${formatRoomType(room.type)} - ${stateLabel}`}
                    >
                      {getRoomIcon(room.type)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="minimap-legend">
        <div className="legend-item"><span className="legend-dot current"></span> Current</div>
        <div className="legend-item"><span className="legend-dot came-from"></span> Came From</div>
        <div className="legend-item"><span className="legend-dot can-go-to"></span> Can Go To</div>
        <div className="legend-item"><span className="legend-dot locked"></span> Locked</div>
      </div>
    </div>
  );
}

interface MessageLogProps {
  messages: string[];
}

/**
 * Message log component showing recent game events.
 * Auto-scrolls to show the latest messages.
 */
function MessageLog({ messages }: MessageLogProps) {
  const logEntriesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new messages arrive (most recent is at top)
  useEffect(() => {
    if (logEntriesRef.current) {
      logEntriesRef.current.scrollTop = 0;
    }
  }, [messages]);

  // Create a reversed copy (don't mutate the original array)
  const reversedMessages = [...messages].reverse();

  return (
    <div className="message-log">
      <h3>Log</h3>
      <div className="log-entries" ref={logEntriesRef}>
        {reversedMessages.length === 0 ? (
          <div className="log-entry log-empty">No events yet...</div>
        ) : (
          reversedMessages.map((msg, index) => (
            <div 
              key={`${messages.length - 1 - index}-${msg.substring(0, 20)}`} 
              className="log-entry"
              dangerouslySetInnerHTML={{ __html: msg }}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Right sidebar with minimap and message log.
 * Matches the original HTML structure for CSS compatibility.
 */
export function RightSidebar({ state, messageLog }: RightSidebarProps) {
  return (
    <aside className="sidebar sidebar-right">
      <Minimap state={state} />
      <MessageLog messages={messageLog} />
    </aside>
  );
}

