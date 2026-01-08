import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  offset?: number;
}

/**
 * Reusable tooltip component.
 * Follows mouse/touch position with smart viewport clamping.
 */
export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  delay = 300,
  offset = 16
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  // Calculate tooltip position based on mouse position
  const updatePosition = useCallback((clientX: number, clientY: number) => {
    mousePos.current = { x: clientX, y: clientY };
    
    if (!tooltipRef.current) return;
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = clientX;
    let y = clientY;

    // Position based on preference, but adjust if near edges
    switch (position) {
      case 'top':
        x = clientX - tooltipRect.width / 2;
        y = clientY - tooltipRect.height - offset;
        // If would go off top, show below instead
        if (y < 8) {
          y = clientY + offset;
        }
        break;
      case 'bottom':
        x = clientX - tooltipRect.width / 2;
        y = clientY + offset;
        // If would go off bottom, show above instead
        if (y + tooltipRect.height > viewportHeight - 8) {
          y = clientY - tooltipRect.height - offset;
        }
        break;
      case 'left':
        x = clientX - tooltipRect.width - offset;
        y = clientY - tooltipRect.height / 2;
        // If would go off left, show right instead
        if (x < 8) {
          x = clientX + offset;
        }
        break;
      case 'right':
        x = clientX + offset;
        y = clientY - tooltipRect.height / 2;
        // If would go off right, show left instead
        if (x + tooltipRect.width > viewportWidth - 8) {
          x = clientX - tooltipRect.width - offset;
        }
        break;
    }

    // Final viewport clamping
    x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

    setCoords({ x, y });
  }, [position, offset]);

  // Handle mouse move to update tooltip position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isVisible) {
      updatePosition(e.clientX, e.clientY);
    } else {
      // Store position for when tooltip becomes visible
      mousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [isVisible, updatePosition]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      if (isVisible) {
        updatePosition(touch.clientX, touch.clientY);
      } else {
        mousePos.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, [isVisible, updatePosition]);

  const showTooltip = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    // Get initial position from event
    if (e) {
      if ('touches' in e && e.touches.length > 0) {
        mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if ('clientX' in e) {
        mousePos.current = { x: e.clientX, y: e.clientY };
      }
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Update position when tooltip becomes visible
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      // Small delay to ensure tooltip is rendered
      requestAnimationFrame(() => {
        updatePosition(mousePos.current.x, mousePos.current.y);
      });
    }
  }, [isVisible, updatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onMouseMove={handleMouseMove}
        onTouchStart={showTooltip}
        onTouchEnd={hideTooltip}
        onTouchMove={handleTouchMove}
        onFocus={() => showTooltip()}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${position}`}
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}

/**
 * Enemy tooltip content component.
 */
interface EnemyTooltipProps {
  name: string;
  type: string;
  challengeRating: number;
  health: number;
  maxHealth: number;
  attackPower: number;
  defense: number;
  speed: number;
  experience: number;
}

export function EnemyTooltipContent({
  name,
  type,
  challengeRating,
  health,
  maxHealth,
  attackPower,
  defense,
  speed,
  experience
}: EnemyTooltipProps) {
  const hpPercent = Math.round((health / maxHealth) * 100);
  
  return (
    <div className="enemy-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-title">{name}</span>
        <span className="tooltip-subtitle">{type}</span>
      </div>
      
      <div className="tooltip-divider" />
      
      <div className="tooltip-stats">
        <div className="tooltip-stat">
          <span className="stat-icon">⚔️</span>
          <span className="stat-label">Attack</span>
          <span className="stat-value">{attackPower}</span>
        </div>
        <div className="tooltip-stat">
          <span className="stat-icon">🛡️</span>
          <span className="stat-label">Defense</span>
          <span className="stat-value">{defense}</span>
        </div>
        <div className="tooltip-stat">
          <span className="stat-icon">⚡</span>
          <span className="stat-label">Speed</span>
          <span className="stat-value">{speed}</span>
        </div>
        <div className="tooltip-stat">
          <span className="stat-icon">✨</span>
          <span className="stat-label">XP Value</span>
          <span className="stat-value">{experience}</span>
        </div>
      </div>
      
      <div className="tooltip-divider" />
      
      <div className="tooltip-footer">
        <span className="tooltip-cr">Challenge Rating: {challengeRating}</span>
        <span className="tooltip-hp">HP: {health}/{maxHealth} ({hpPercent}%)</span>
      </div>
    </div>
  );
}

/**
 * Item tooltip content component.
 */
interface ItemTooltipProps {
  name: string;
  type: string;
  rarity: string;
  slot?: string;
  value: number;
  description?: string;
  stats?: {
    attack?: number;
    defense?: number;
    health?: number;
    mana?: number;
    speed?: number;
    critChance?: number;
    critMultiplier?: number;
  };
  damage?: {
    dice: string;
    bonus: number;
  };
  grantedAbility?: {
    name: string;
    description: string;
  };
}

export function ItemTooltipContent({
  name,
  type,
  rarity,
  slot,
  value,
  description,
  stats,
  damage,
  grantedAbility
}: ItemTooltipProps) {
  const rarityClass = `rarity-${rarity.toLowerCase().replace('_', '')}`;
  
  return (
    <div className={`item-tooltip ${rarityClass}`}>
      <div className="tooltip-header">
        <span className={`tooltip-title ${rarityClass}`}>{name}</span>
        <span className="tooltip-subtitle">{type}{slot ? ` • ${slot}` : ''}</span>
      </div>
      
      <div className={`tooltip-rarity ${rarityClass}`}>{rarity.replace('_', ' ')}</div>
      
      {description && (
        <>
          <div className="tooltip-divider" />
          <p className="tooltip-description">{description}</p>
        </>
      )}
      
      {damage && (
        <>
          <div className="tooltip-divider" />
          <div className="tooltip-damage">
            <span className="damage-label">Damage:</span>
            <span className="damage-value">{damage.dice}{damage.bonus > 0 ? ` +${damage.bonus}` : ''}</span>
          </div>
        </>
      )}
      
      {stats && Object.keys(stats).length > 0 && (
        <>
          <div className="tooltip-divider" />
          <div className="tooltip-stats">
            {stats.attack !== undefined && stats.attack !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">⚔️</span>
                <span className="stat-label">Attack</span>
                <span className={`stat-value ${stats.attack > 0 ? 'positive' : 'negative'}`}>
                  {stats.attack > 0 ? '+' : ''}{stats.attack}
                </span>
              </div>
            )}
            {stats.defense !== undefined && stats.defense !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">🛡️</span>
                <span className="stat-label">Defense</span>
                <span className={`stat-value ${stats.defense > 0 ? 'positive' : 'negative'}`}>
                  {stats.defense > 0 ? '+' : ''}{stats.defense}
                </span>
              </div>
            )}
            {stats.health !== undefined && stats.health !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">❤️</span>
                <span className="stat-label">Health</span>
                <span className={`stat-value ${stats.health > 0 ? 'positive' : 'negative'}`}>
                  {stats.health > 0 ? '+' : ''}{stats.health}
                </span>
              </div>
            )}
            {stats.mana !== undefined && stats.mana !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">💧</span>
                <span className="stat-label">Mana</span>
                <span className={`stat-value ${stats.mana > 0 ? 'positive' : 'negative'}`}>
                  {stats.mana > 0 ? '+' : ''}{stats.mana}
                </span>
              </div>
            )}
            {stats.speed !== undefined && stats.speed !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">⚡</span>
                <span className="stat-label">Speed</span>
                <span className={`stat-value ${stats.speed > 0 ? 'positive' : 'negative'}`}>
                  {stats.speed > 0 ? '+' : ''}{stats.speed}
                </span>
              </div>
            )}
            {stats.critChance !== undefined && stats.critChance !== 0 && (
              <div className="tooltip-stat">
                <span className="stat-icon">🎯</span>
                <span className="stat-label">Crit Chance</span>
                <span className={`stat-value ${stats.critChance > 0 ? 'positive' : 'negative'}`}>
                  {stats.critChance > 0 ? '+' : ''}{stats.critChance}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
      
      {grantedAbility && (
        <>
          <div className="tooltip-divider" />
          <div className="tooltip-ability">
            <span className="ability-label">Grants Ability:</span>
            <span className="ability-name">{grantedAbility.name}</span>
            <p className="ability-desc">{grantedAbility.description}</p>
          </div>
        </>
      )}
      
      <div className="tooltip-divider" />
      
      <div className="tooltip-footer">
        <span className="tooltip-value">💰 {value} gold</span>
      </div>
    </div>
  );
}

/**
 * Ability tooltip content component.
 */
interface AbilityTooltipProps {
  name: string;
  description: string;
  manaCost: number;
  cooldown: number;
  abilityType?: string;
  spellDamageDice?: string;
  damageDice?: string;
  damage?: number;
  damageCalc?: string;
  healing?: number;
  healingCalc?: string;
  lifestealPercent?: number;
  statusEffect?: { type: string; duration: number; value?: number };
  selfBuff?: { type: string; duration: number; value?: number };
  targetType?: string;
  saveType?: string;
  playerLevel?: number;
}

/**
 * Gets a display-friendly ability type label.
 */
function getAbilityTypeLabel(type?: string): { label: string; icon: string; color: string } {
  switch (type) {
    case 'spell':
      return { label: 'Spell', icon: '✨', color: 'var(--accent-purple)' };
    case 'physical':
      return { label: 'Physical', icon: '⚔️', color: 'var(--accent-red)' };
    case 'status_buff':
      return { label: 'Buff', icon: '🛡️', color: 'var(--accent-green)' };
    case 'status_debuff':
      return { label: 'Debuff', icon: '💀', color: 'var(--accent-gold)' };
    default:
      return { label: 'Ability', icon: '⭐', color: 'var(--text-primary)' };
  }
}

/**
 * Formats status effect for display.
 */
function formatStatusEffect(effect: { type: string; duration: number; value?: number }): string {
  const effectNames: Record<string, string> = {
    'vulnerable': 'Vulnerable',
    'stun': 'Stun',
    'poison': 'Poison',
    'burn': 'Burn',
    'bleed': 'Bleed',
    'slow': 'Slow',
    'weaken': 'Weaken',
    'strengthen': 'Strengthen',
    'fortify': 'Fortify',
    'regen': 'Regeneration',
    'haste': 'Haste'
  };
  
  const name = effectNames[effect.type] || effect.type;
  const valueStr = effect.value ? ` (${effect.value}%)` : '';
  return `${name}${valueStr} for ${effect.duration} turn${effect.duration !== 1 ? 's' : ''}`;
}

/**
 * Calculates scaled spell dice for display.
 */
function getScaledSpellDice(baseDice: string, playerLevel: number = 1): string {
  const extraDice = Math.floor(playerLevel / 4);
  const totalDice = 1 + extraDice;
  const diceType = baseDice.replace(/^\d+/, ''); // Remove leading number
  return `${totalDice}${diceType}`;
}

export function AbilityTooltipContent({
  name,
  description,
  manaCost,
  cooldown,
  abilityType,
  spellDamageDice,
  damageDice,
  damage,
  damageCalc,
  healing,
  healingCalc,
  lifestealPercent,
  statusEffect,
  selfBuff,
  targetType,
  saveType,
  playerLevel = 1
}: AbilityTooltipProps) {
  const typeInfo = getAbilityTypeLabel(abilityType);
  
  // Calculate scaled damage dice for spells
  const scaledSpellDice = spellDamageDice ? getScaledSpellDice(spellDamageDice, playerLevel) : null;
  
  return (
    <div className="ability-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-title">{name}</span>
        <span 
          className="tooltip-type-badge" 
          style={{ backgroundColor: typeInfo.color }}
        >
          {typeInfo.icon} {typeInfo.label}
        </span>
      </div>
      
      <div className="tooltip-divider" />
      
      <p className="tooltip-description">{description}</p>
      
      {/* Damage Section */}
      {(scaledSpellDice || damageDice || damage) && (
        <>
          <div className="tooltip-divider" />
          <div className="ability-damage-section">
            {scaledSpellDice && (
              <div className="ability-stat">
                <span className="stat-icon">🎲</span>
                <span className="stat-label">Damage</span>
                <span className="stat-value damage-dice">{scaledSpellDice} + INT</span>
              </div>
            )}
            {damageDice && !scaledSpellDice && (
              <div className="ability-stat">
                <span className="stat-icon">🎲</span>
                <span className="stat-label">Damage</span>
                <span className="stat-value damage-dice">{damageDice} + STR</span>
              </div>
            )}
            {damage && damageCalc === 'multiplier' && (
              <div className="ability-stat">
                <span className="stat-icon">⚔️</span>
                <span className="stat-label">Damage</span>
                <span className="stat-value">{Math.round(damage * 100)}% weapon</span>
              </div>
            )}
            {damage && damageCalc === 'flat' && !scaledSpellDice && !damageDice && (
              <div className="ability-stat">
                <span className="stat-icon">💥</span>
                <span className="stat-label">Damage</span>
                <span className="stat-value">{damage} base</span>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Healing Section */}
      {(healing || lifestealPercent) && (
        <>
          <div className="tooltip-divider" />
          <div className="ability-healing-section">
            {healing && (
              <div className="ability-stat">
                <span className="stat-icon">💚</span>
                <span className="stat-label">Healing</span>
                <span className="stat-value positive">
                  {healingCalc === 'percent_max_hp' ? `${healing}% max HP` : `${healing}`}
                </span>
              </div>
            )}
            {lifestealPercent && (
              <div className="ability-stat">
                <span className="stat-icon">🩸</span>
                <span className="stat-label">Lifesteal</span>
                <span className="stat-value positive">{lifestealPercent}% of damage</span>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Status Effects Section */}
      {(statusEffect || selfBuff) && (
        <>
          <div className="tooltip-divider" />
          <div className="ability-effects-section">
            {statusEffect && (
              <div className="ability-effect">
                <span className="effect-icon">💀</span>
                <span className="effect-text">{formatStatusEffect(statusEffect)}</span>
              </div>
            )}
            {selfBuff && (
              <div className="ability-effect buff">
                <span className="effect-icon">✨</span>
                <span className="effect-text">{formatStatusEffect(selfBuff)}</span>
              </div>
            )}
            {saveType && (
              <div className="ability-save">
                <span className="save-label">Save:</span>
                <span className="save-type">{saveType.toUpperCase()}</span>
              </div>
            )}
          </div>
        </>
      )}
      
      <div className="tooltip-divider" />
      
      {/* Cost & Cooldown Footer */}
      <div className="ability-footer">
        <div className="ability-cost">
          <span className="cost-icon">💧</span>
          <span className="cost-value">{manaCost} MP</span>
        </div>
        <div className="ability-cooldown">
          <span className="cooldown-icon">⏱️</span>
          <span className="cooldown-value">
            {cooldown === 0 ? 'No cooldown' : `${cooldown} turn${cooldown !== 1 ? 's' : ''}`}
          </span>
        </div>
        {targetType && targetType !== 'enemy' && (
          <div className="ability-target">
            <span className="target-icon">🎯</span>
            <span className="target-value">
              {targetType === 'self' ? 'Self' : targetType === 'all_enemies' ? 'All Enemies' : targetType}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

