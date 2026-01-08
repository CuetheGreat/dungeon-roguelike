import { GameStats } from '../../game/gameState';

interface GameOverScreenProps {
  stats: GameStats;
  onRestart: () => void;
}

/**
 * Game over screen shown when the player dies.
 * Displays final stats and allows restarting.
 */
export function GameOverScreen({ stats, onRestart }: GameOverScreenProps) {
  return (
    <div className="end-screen game-over">
      <h1 className="end-title">Game Over</h1>
      <p className="end-message">You have been defeated...</p>

      <div className="end-stats">
        <h3>Final Stats</h3>
        <div className="stat-row">
          <span>Rooms Cleared:</span>
          <span>{stats.roomsCleared}</span>
        </div>
        <div className="stat-row">
          <span>Enemies Defeated:</span>
          <span>{stats.enemiesDefeated}</span>
        </div>
        <div className="stat-row">
          <span>Gold Collected:</span>
          <span>{stats.goldCollected}</span>
        </div>
        <div className="stat-row">
          <span>Items Found:</span>
          <span>{stats.itemsFound}</span>
        </div>
      </div>

      <button className="restart-btn" onClick={onRestart}>
        Play Again
      </button>
    </div>
  );
}

