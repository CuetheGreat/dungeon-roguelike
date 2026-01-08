import { Player } from '../../entities/player';
import { GameStats } from '../../game/gameState';
import { getXPForNextLevel, getXPProgress } from '../../game/constants';
import { getPlayerImage } from '../../ui/imageAssets';
import { RelicType } from '../../entities/relic';

interface LeftSidebarProps {
  player: Player;
  stats: GameStats;
}

/**
 * Gets an icon for a relic type.
 */
function getRelicIcon(type: RelicType): string {
  switch (type) {
    case RelicType.ABILITY: return '✨'; // sparkles
    case RelicType.STAT_BOOST: return '▲'; // triangle up
    case RelicType.PASSIVE: return '○'; // circle
    case RelicType.COMBAT_MODIFIER: return '⚔'; // swords
    default: return '◆'; // diamond
  }
}

/**
 * Left sidebar showing player stats, health/mana bars, and relics.
 * Matches the original HTML structure for CSS compatibility.
 */
export function LeftSidebar({ player, stats }: LeftSidebarProps) {
  const playerImage = getPlayerImage(player.playerClass, 80);
  const healthPercent = (player.stats.health / player.getMaxHealth()) * 100;
  const manaPercent = (player.stats.mana / player.getMaxMana()) * 100;
  const xpPercent = getXPProgress(player.level, player.experience);

  return (
    <aside className="sidebar sidebar-left">
      <div className="player-info">
        <img 
          src={playerImage} 
          alt={player.playerClass} 
          className="player-portrait" 
        />
        <h2 className="player-name">{player.name}</h2>
        <div className="player-class">{player.playerClass} Lv.{player.level}</div>
      </div>

      <div className="stat-bars">
        <div className="stat-bar health-bar">
          <div className="stat-bar-label">
            <span>HP</span>
            <span>{player.stats.health}/{player.getMaxHealth()}</span>
          </div>
          <div className="stat-bar-track">
            <div 
              className="stat-bar-fill" 
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>

        <div className="stat-bar mana-bar">
          <div className="stat-bar-label">
            <span>MP</span>
            <span>{player.stats.mana}/{player.getMaxMana()}</span>
          </div>
          <div className="stat-bar-track">
            <div 
              className="stat-bar-fill" 
              style={{ width: `${manaPercent}%` }}
            />
          </div>
        </div>

        <div className="stat-bar xp-bar">
          <div className="stat-bar-label">
            <span>XP</span>
            <span>{player.experience}/{getXPForNextLevel(player.level)}</span>
          </div>
          <div className="stat-bar-track">
            <div 
              className="stat-bar-fill" 
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="player-stats">
        <div className="stat-row">
          <span className="stat-icon">⚔</span>
          <span className="stat-label">Attack</span>
          <span className="stat-value">{player.getAttackPower()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-icon">🛡</span>
          <span className="stat-label">Defense</span>
          <span className="stat-value">{player.getDefense()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-icon">⚡</span>
          <span className="stat-label">Speed</span>
          <span className="stat-value">{player.getSpeed()}</span>
        </div>
        <div className="stat-row">
          <span className="stat-icon">✨</span>
          <span className="stat-label">Crit</span>
          <span className="stat-value">{player.getCritChance()}%</span>
        </div>
      </div>

      <div className="player-gold">
        <span className="gold-icon">★</span>
        <span className="gold-amount">{player.gold}</span>
        <span className="gold-label">Gold</span>
      </div>

      {player.relics.length > 0 && (
        <div className="player-relics">
          <h3>Relics ({player.relics.length})</h3>
          <div className="relic-list">
            {player.relics.slice(0, 5).map((relic) => (
              <div 
                key={relic.id}
                className={`relic-item relic-${relic.rarity}`}
                title={relic.description}
              >
                <span className="relic-icon">{getRelicIcon(relic.type)}</span>
                <span className="relic-name">{relic.name}</span>
              </div>
            ))}
            {player.relics.length > 5 && (
              <div className="relic-more">+{player.relics.length - 5} more</div>
            )}
          </div>
        </div>
      )}

      <div className="game-stats">
        <div className="game-stat">Rooms: {stats.roomsCleared}</div>
        <div className="game-stat">Enemies: {stats.enemiesDefeated}</div>
      </div>
    </aside>
  );
}

