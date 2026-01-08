import { GameStats } from '../../game/gameState';

interface VictoryScreenProps {
  stats: GameStats;
  onRestart: () => void;
}

/**
 * Victory screen shown when the player defeats the boss.
 * Displays final stats and allows restarting.
 */
export function VictoryScreen({ stats, onRestart }: VictoryScreenProps) {
  return (
    <div className="end-screen victory">
      <h1 className="end-title">Victory!</h1>
      <p className="end-message">You have conquered the dungeon!</p>

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

