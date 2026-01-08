import { Player } from '../../entities/player';
import { GameStats } from '../../game/gameState';
import { getPlayerImage } from '../../ui/imageAssets';

interface CharacterModalProps {
  player: Player;
  stats: GameStats;
  onClose: () => void;
}

/**
 * Stat row component for displaying a single stat.
 */
function StatRow({ label, value, modifier }: { label: string; value: number; modifier?: number }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {modifier !== undefined && modifier !== 0 && (
          <span className={`stat-modifier ${modifier > 0 ? 'positive' : 'negative'}`}>
            ({modifier > 0 ? '+' : ''}{modifier})
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Ability card component.
 */
function AbilityCard({ ability }: { ability: { id: string; name: string; description: string; manaCost: number; cooldown: number; currentCooldown: number } }) {
  const isOnCooldown = ability.currentCooldown > 0;
  
  return (
    <div className={`ability-card ${isOnCooldown ? 'on-cooldown' : ''}`}>
      <div className="ability-header">
        <span className="ability-name">{ability.name}</span>
        <span className="ability-cost">{ability.manaCost} MP</span>
      </div>
      <p className="ability-description">{ability.description}</p>
      <div className="ability-footer">
        <span className="ability-cooldown">
          CD: {ability.cooldown} turns
          {isOnCooldown && ` (${ability.currentCooldown} left)`}
        </span>
      </div>
    </div>
  );
}

/**
 * Character modal component.
 * Shows detailed character stats, abilities, and run statistics.
 */
export function CharacterModal({ player, stats, onClose }: CharacterModalProps) {
  const playerImg = getPlayerImage(player.playerClass, 96);
  
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calculate XP progress
  const xpForNextLevel = player.level * 100;
  const xpProgress = Math.round((player.experience / xpForNextLevel) * 100);

  return (
    <div className="character-overlay" onClick={handleOverlayClick}>
      <div className="character-modal">
        {/* Header */}
        <div className="character-header">
          <h2>Character Sheet</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="character-content">
          {/* Character Info Section */}
          <div className="character-info">
            <img src={playerImg} alt={player.name} className="character-portrait" />
            <h3>{player.name}</h3>
            <p className="character-class">{player.playerClass} • Level {player.level}</p>
          </div>

          {/* XP Bar */}
          <div className="character-experience">
            <h4>Experience</h4>
            <div className="xp-bar-container">
              <div className="xp-bar">
                <div className="xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
              <span className="xp-text">{player.experience} / {xpForNextLevel} XP</span>
            </div>
          </div>

          {/* Ability Scores Section */}
          <div className="character-stats ability-scores">
            <h4>⚔️ Ability Scores</h4>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">STR</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Strength}
                  <span className="stat-modifier">
                    ({player.getModifier('Strength') >= 0 ? '+' : ''}{player.getModifier('Strength')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">DEX</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Dexterity}
                  <span className="stat-modifier">
                    ({player.getModifier('Dexterity') >= 0 ? '+' : ''}{player.getModifier('Dexterity')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CON</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Constitution}
                  <span className="stat-modifier">
                    ({player.getModifier('Constitution') >= 0 ? '+' : ''}{player.getModifier('Constitution')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">INT</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Intelligence}
                  <span className="stat-modifier">
                    ({player.getModifier('Intelligence') >= 0 ? '+' : ''}{player.getModifier('Intelligence')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">WIS</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Wisdom}
                  <span className="stat-modifier">
                    ({player.getModifier('Wisdom') >= 0 ? '+' : ''}{player.getModifier('Wisdom')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CHA</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Charisma}
                  <span className="stat-modifier">
                    ({player.getModifier('Charisma') >= 0 ? '+' : ''}{player.getModifier('Charisma')})
                  </span>
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">LCK</span>
                <span className="stat-value">
                  {player.stats.abilityScores.Luck}
                  <span className="stat-modifier">
                    ({player.getModifier('Luck') >= 0 ? '+' : ''}{player.getModifier('Luck')})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Derived Stats Section */}
          <div className="character-stats derived-stats">
            <h4>📊 Combat Stats</h4>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">HP</span>
                <span className="stat-value">{player.stats.health}/{player.getMaxHealth()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">MP</span>
                <span className="stat-value">{player.stats.mana}/{player.getMaxMana()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">ATK</span>
                <span className="stat-value">{player.getAttackPower()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">DEF</span>
                <span className="stat-value">{player.getDefense()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">SPD</span>
                <span className="stat-value">{player.getSpeed()}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CRIT</span>
                <span className="stat-value">{player.getCritChance()}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">CRIT×</span>
                <span className="stat-value">{player.getCritMultiplier().toFixed(2)}x</span>
              </div>
            </div>
          </div>

          {/* Abilities Section */}
          <div className="character-abilities">
            <h4>Abilities</h4>
            <div className="ability-list">
              {player.abilities.map(ability => (
                <div key={ability.id} className={`ability-item ${ability.currentCooldown > 0 ? 'on-cooldown' : ''}`}>
                  <div className="ability-info">
                    <span className="ability-name">{ability.name}</span>
                    <span className="ability-description">{ability.description}</span>
                  </div>
                  <div className="ability-meta">
                    <span className="ability-cost">{ability.manaCost} MP</span>
                    {ability.cooldown > 0 && (
                      <span className="ability-cd">
                        {ability.currentCooldown > 0 
                          ? `${ability.currentCooldown}/${ability.cooldown} CD` 
                          : `${ability.cooldown} CD`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Run Statistics Section */}
          <div className="character-run-stats">
            <h4>Run Statistics</h4>
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-label">Rooms</span>
                <span className="stat-value">{stats.roomsCleared}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Enemies</span>
                <span className="stat-value">{stats.enemiesDefeated}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Gold</span>
                <span className="stat-value">{stats.goldCollected}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Items</span>
                <span className="stat-value">{stats.itemsFound}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

