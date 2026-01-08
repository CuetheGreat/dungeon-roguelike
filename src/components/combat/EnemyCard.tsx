import { Enemy, EnemyType } from '../../entities/enemy';
import { getMonsterImage } from '../../ui/imageAssets';
import { Tooltip, EnemyTooltipContent } from '../ui';

interface EnemyCardProps {
  enemy: Enemy;
  index: number;
  isTargeted?: boolean;
  isSelectable?: boolean;
  isAttacking?: boolean;
  onSelect?: (enemy: Enemy) => void;
}

/**
 * Get icon for enemy type.
 */
function getEnemyTypeIcon(type: EnemyType): string {
  switch (type) {
    case EnemyType.ABERRATION: return '👁️';
    case EnemyType.BEAST: return '🐾';
    case EnemyType.CELESTIAL: return '👼';
    case EnemyType.CONSTRUCT: return '🤖';
    case EnemyType.DRAGON: return '🐉';
    case EnemyType.ELEMENTAL: return '🌪️';
    case EnemyType.FEY: return '🧚';
    case EnemyType.FIEND: return '😈';
    case EnemyType.GIANT: return '🗿';
    case EnemyType.HUMANOID: return '🧑';
    case EnemyType.MONSTROSITY: return '👹';
    case EnemyType.OOZE: return '🫧';
    case EnemyType.PLANT: return '🌿';
    case EnemyType.UNDEAD: return '💀';
    default: return '❓';
  }
}

/**
 * Displays an enemy card with image, stats, and health bar.
 * Supports selection for targeting abilities.
 */
export function EnemyCard({ 
  enemy, 
  index, 
  isTargeted = false, 
  isSelectable = false,
  isAttacking = false,
  onSelect 
}: EnemyCardProps) {
  const isDefeated = enemy.health <= 0;
  const hpPercent = Math.max(0, (enemy.health / enemy.maxHealth) * 100);
  
  // Use API image if available, otherwise use placeholder SVG
  const placeholderImage = getMonsterImage(enemy.type, enemy.name, 220);
  const enemyImage = enemy.imageUrl || placeholderImage;

  const handleClick = () => {
    if (isSelectable && !isDefeated && onSelect) {
      onSelect(enemy);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isSelectable && !isDefeated && onSelect) {
      e.preventDefault();
      onSelect(enemy);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.src = placeholderImage;
    img.classList.remove('api-image');
    img.classList.add('placeholder-image');
  };

  // Determine health bar color based on percentage
  const getHealthBarColor = () => {
    if (hpPercent > 60) return 'var(--health-color)';
    if (hpPercent > 30) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const typeIcon = getEnemyTypeIcon(enemy.type);

  const tooltipContent = (
    <EnemyTooltipContent
      name={enemy.name}
      type={enemy.type}
      challengeRating={enemy.challengeRating}
      health={enemy.health}
      maxHealth={enemy.maxHealth}
      attackPower={enemy.attackPower}
      defense={enemy.defense}
      speed={enemy.speed}
      experience={enemy.experience}
    />
  );

  return (
    <Tooltip content={tooltipContent} position="right" delay={400}>
      <div
        className={`enemy-card ${isDefeated ? 'defeated' : ''} ${isTargeted ? 'targeted' : ''} ${isSelectable && !isDefeated ? 'selectable' : ''} ${isAttacking ? 'attacking' : ''}`}
        data-enemy-id={enemy.id}
        data-enemy-index={index}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={isSelectable ? 'button' : undefined}
        tabIndex={isSelectable && !isDefeated ? 0 : undefined}
        aria-label={isSelectable ? `Target ${enemy.name}` : undefined}
        aria-disabled={isDefeated}
      >
        <img
          src={enemyImage}
          alt={enemy.name}
          className={`enemy-image ${enemy.imageUrl ? 'api-image' : 'placeholder-image'}`}
          onError={handleImageError}
        />
        
        <div className="enemy-header">
          <span className="enemy-name">{enemy.name}</span>
          <span className="enemy-cr">CR {enemy.challengeRating}</span>
        </div>
        
        <div className="enemy-hp-bar">
          <div 
            className="enemy-hp-fill" 
            style={{ 
              width: `${hpPercent}%`,
              backgroundColor: getHealthBarColor()
            }} 
          />
          <span className="enemy-hp-text">
            {enemy.health}/{enemy.maxHealth}
          </span>
        </div>
        
        <div className="enemy-stats">
          <span>ATK<br />{enemy.attackPower}</span>
          <span>DEF<br />{enemy.defense}</span>
        </div>

        {isTargeted && (
          <div className="target-indicator">
            <span className="target-icon">⚔️</span>
          </div>
        )}

        {isDefeated && (
          <div className="defeated-overlay">
            <span className="defeated-text">DEFEATED</span>
          </div>
        )}

        {/* Enemy type icon */}
        <div className="enemy-type-icon" title={enemy.type}>
          {typeIcon}
        </div>
      </div>
    </Tooltip>
  );
}

