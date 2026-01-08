import { Player } from '../../entities/player';
import { Action } from '../../game/gameState';

interface RestViewProps {
  player: Player;
  onAction: (action: Action) => void;
}

/**
 * Rest view component for rest/campfire rooms.
 */
export function RestView({ player, onAction }: RestViewProps) {
  const currentHp = player.stats.health;
  const maxHp = player.getMaxHealth();
  const currentMana = player.stats.mana;
  const maxMana = player.getMaxMana();
  
  const hpPercent = Math.round((currentHp / maxHp) * 100);
  const manaPercent = Math.round((currentMana / maxMana) * 100);
  
  // Calculate potential healing (rest heals 30% of max HP/MP)
  const potentialHpHeal = Math.min(Math.floor(maxHp * 0.3), maxHp - currentHp);
  const potentialManaHeal = Math.min(Math.floor(maxMana * 0.3), maxMana - currentMana);

  const handleRest = () => {
    onAction({ type: 'rest' });
  };

  const handleLeave = () => {
    onAction({ type: 'leave' });
  };

  return (
    <div className="rest-view">
      {/* Rest Header */}
      <div className="rest-header">
        <span className="rest-icon">🏕️</span>
        <h2 className="rest-title">Rest Area</h2>
      </div>
      
      <p className="rest-description">
        A safe haven in the dungeon. The flickering campfire offers warmth and respite from your journey.
      </p>

      {/* Current Status */}
      <div className="rest-status">
        <div className="status-bar hp-status">
          <span className="status-label">HP</span>
          <div className="status-bar-container">
            <div 
              className="status-bar-fill hp-fill" 
              style={{ width: `${hpPercent}%` }}
            />
            <span className="status-text">{currentHp}/{maxHp}</span>
          </div>
          {potentialHpHeal > 0 && (
            <span className="heal-preview">+{potentialHpHeal}</span>
          )}
        </div>
        
        <div className="status-bar mana-status">
          <span className="status-label">MP</span>
          <div className="status-bar-container">
            <div 
              className="status-bar-fill mana-fill" 
              style={{ width: `${manaPercent}%` }}
            />
            <span className="status-text">{currentMana}/{maxMana}</span>
          </div>
          {potentialManaHeal > 0 && (
            <span className="heal-preview">+{potentialManaHeal}</span>
          )}
        </div>
      </div>

      {/* Rest Info */}
      <div className="rest-info">
        <p>Resting will restore <strong>30%</strong> of your maximum HP and MP.</p>
        <p className="rest-warning">⚠️ You can only rest once per rest area.</p>
      </div>

      {/* Action Buttons */}
      <div className="rest-actions">
        <button 
          className="rest-btn" 
          onClick={handleRest}
          disabled={currentHp >= maxHp && currentMana >= maxMana}
        >
          🔥 Rest by the Fire
        </button>
        <button className="leave-rest-btn" onClick={handleLeave}>
          Continue Journey
        </button>
      </div>
    </div>
  );
}

