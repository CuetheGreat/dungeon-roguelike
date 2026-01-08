import { useState } from 'react';
import { Action } from '../../game/gameState';
import { RoomType } from '../../dungeon/room';
import { Tooltip, AbilityTooltipContent } from './Tooltip';
import { useGame } from '../../context/GameContext';
import { Player } from '../../entities/player';

interface ActionButtonsProps {
  actions: Action[];
  onAction: (action: Action) => void;
  disabled?: boolean;
}

/**
 * Room type display names.
 */
const ROOM_TYPE_NAMES: Record<RoomType, string> = {
  [RoomType.ENTRANCE]: 'Entrance',
  [RoomType.COMBAT]: 'Combat Room',
  [RoomType.ELITE]: 'Elite Room',
  [RoomType.BOSS]: 'Boss Chamber',
  [RoomType.TREASURE]: 'Treasure Room',
  [RoomType.SHOP]: 'Shop',
  [RoomType.REST]: 'Rest Area',
  [RoomType.EVENT]: 'Mystery Room',
  [RoomType.PUZZLE]: 'Puzzle Chamber',
};

/**
 * Grouped potion with count.
 */
interface GroupedPotion {
  name: string;
  count: number;
  action: Action; // Representative action to use
}

/**
 * Separates use_item actions (potions) from other actions.
 * Groups potions by name with counts.
 */
function separateActions(actions: Action[]): { 
  regularActions: Action[]; 
  potions: GroupedPotion[];
} {
  const regularActions: Action[] = [];
  const potionGroups = new Map<string, { count: number; action: Action }>();

  for (const action of actions) {
    if (action.type === 'use_item' && action.name) {
      const existing = potionGroups.get(action.name);
      if (existing) {
        existing.count++;
      } else {
        potionGroups.set(action.name, { count: 1, action });
      }
    } else {
      regularActions.push(action);
    }
  }

  const potions: GroupedPotion[] = [];
  for (const [name, data] of potionGroups) {
    potions.push({ name, count: data.count, action: data.action });
  }

  return { regularActions, potions };
}

/**
 * Gets display label for an action.
 */
function getActionLabel(action: Action): string {
  switch (action.type) {
    case 'move':
      return `Go to ${ROOM_TYPE_NAMES[action.roomType as RoomType] || action.roomType}`;
    case 'interact':
      return `Interact: ${action.name || action.interactableName}`;
    case 'basic_attack':
      return 'Attack';
    case 'ability':
      return action.name || action.abilityId || 'Use Ability';
    case 'use_item':
      return `Use ${action.name || action.itemName}`;
    case 'flee':
      return 'Flee';
    case 'rest':
      return 'Rest';
    case 'leave':
      return 'Leave Room';
    case 'leave_shop':
      return 'Leave Shop';
    case 'buy_item':
      return `Buy ${action.itemName} (${action.price}g)`;
    case 'sell_item':
      return `Sell ${action.itemName} (${action.price}g)`;
    case 'open_inventory':
      return 'Inventory';
    case 'view_character':
      return 'Character';
    case 'accept_event':
      return action.name || 'Accept';
    case 'puzzle_answer':
      return action.answerText || `Answer ${(action.answerIndex ?? 0) + 1}`;
    case 'skip_puzzle':
      return 'Skip Puzzle';
    default:
      return action.type;
  }
}

/**
 * Potion selection modal component.
 */
interface PotionModalProps {
  potions: GroupedPotion[];
  onSelect: (action: Action) => void;
  onClose: () => void;
}

function PotionModal({ potions, onSelect, onClose }: PotionModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="potion-modal-backdrop" onClick={handleBackdropClick}>
      <div className="potion-modal">
        <h3>🧪 Use Potion</h3>
        <div className="potion-list">
          {potions.map((potion, index) => (
            <button
              key={`${potion.name}-${index}`}
              className="potion-item"
              onClick={() => {
                onSelect(potion.action);
                onClose();
              }}
            >
              <span className="potion-name">{potion.name}</span>
              <span className="potion-count">×{potion.count}</span>
            </button>
          ))}
        </div>
        <p className="potion-hint">Click outside to cancel</p>
      </div>
    </div>
  );
}

/**
 * Attack tooltip content.
 */
function AttackTooltipContent({ player }: { player: Player | null }) {
  const weapon = player?.equipment.weapon;
  const attackBonus = player?.getAttackBonus() ?? 0;
  const strMod = player?.getModifier('Strength') ?? 0;
  
  return (
    <div className="attack-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-title">Basic Attack</span>
        <span className="tooltip-type-badge" style={{ backgroundColor: 'var(--accent-red)' }}>
          ⚔️ Physical
        </span>
      </div>
      
      <div className="tooltip-divider" />
      
      <p className="tooltip-description">
        Strike an enemy with your equipped weapon. Roll to hit, then roll weapon damage.
      </p>
      
      <div className="tooltip-divider" />
      
      <div className="ability-damage-section">
        <div className="ability-stat">
          <span className="stat-icon">🎯</span>
          <span className="stat-label">To Hit</span>
          <span className="stat-value">d20 + {attackBonus}</span>
        </div>
        <div className="ability-stat">
          <span className="stat-icon">🎲</span>
          <span className="stat-label">Damage</span>
          <span className="stat-value damage-dice">
            {weapon?.damage?.dice || '1d4'} + {strMod}
          </span>
        </div>
        {weapon && (
          <div className="ability-stat">
            <span className="stat-icon">⚔️</span>
            <span className="stat-label">Weapon</span>
            <span className="stat-value">{weapon.name}</span>
          </div>
        )}
      </div>
      
      <div className="tooltip-divider" />
      
      <div className="ability-footer">
        <div className="ability-cost">
          <span className="cost-icon">💧</span>
          <span className="cost-value" style={{ color: 'var(--text-muted)' }}>Free</span>
        </div>
        <div className="ability-cooldown">
          <span className="cooldown-icon">⏱️</span>
          <span className="cooldown-value">No cooldown</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Flee tooltip content.
 */
function FleeTooltipContent() {
  return (
    <div className="flee-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-title">Flee</span>
        <span className="tooltip-type-badge" style={{ backgroundColor: 'var(--text-muted)' }}>
          🏃 Escape
        </span>
      </div>
      
      <div className="tooltip-divider" />
      
      <p className="tooltip-description">
        Attempt to escape from combat. Success depends on your Speed vs enemy Speed.
      </p>
      
      <div className="tooltip-divider" />
      
      <div className="ability-effects-section">
        <div className="ability-effect">
          <span className="effect-icon">✅</span>
          <span className="effect-text" style={{ color: 'var(--accent-green)' }}>
            Success: Return to exploration
          </span>
        </div>
        <div className="ability-effect">
          <span className="effect-icon">❌</span>
          <span className="effect-text" style={{ color: 'var(--accent-red)' }}>
            Failure: Enemies get free attacks
          </span>
        </div>
      </div>
      
      <div className="tooltip-divider" />
      
      <div className="ability-footer">
        <div className="ability-cost">
          <span className="cost-icon">⚠️</span>
          <span className="cost-value" style={{ color: 'var(--accent-gold)' }}>Risky</span>
        </div>
        <div className="ability-cooldown">
          <span className="cooldown-icon">🎲</span>
          <span className="cooldown-value">Speed check</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders an action button, with tooltip for abilities, attack, and flee.
 */
function ActionButton({ 
  action, 
  index, 
  disabled, 
  onAction,
  playerLevel,
  player
}: { 
  action: Action; 
  index: number; 
  disabled: boolean; 
  onAction: (action: Action) => void;
  playerLevel: number;
  player: Player | null;
}) {
  const button = (
    <button
      className={`action-btn action-${action.type}`}
      onClick={() => !disabled && onAction(action)}
      disabled={disabled}
    >
      <span className="action-key">{index + 1}</span>
      <span className="action-label">{getActionLabel(action)}</span>
    </button>
  );

  // Wrap ability buttons with tooltip
  if (action.type === 'ability' && action.abilityData) {
    return (
      <Tooltip
        content={
          <AbilityTooltipContent
            name={action.name || 'Unknown'}
            description={action.abilityData.description}
            manaCost={action.abilityData.manaCost}
            cooldown={action.abilityData.cooldown}
            abilityType={action.abilityData.abilityType}
            spellDamageDice={action.abilityData.spellDamageDice}
            damageDice={action.abilityData.damageDice}
            damage={action.abilityData.damage}
            damageCalc={action.abilityData.damageCalc}
            healing={action.abilityData.healing}
            healingCalc={action.abilityData.healingCalc}
            lifestealPercent={action.abilityData.lifestealPercent}
            statusEffect={action.abilityData.statusEffect}
            selfBuff={action.abilityData.selfBuff}
            targetType={action.abilityData.targetType}
            saveType={action.abilityData.saveType}
            playerLevel={playerLevel}
          />
        }
        position="top"
        delay={200}
      >
        {button}
      </Tooltip>
    );
  }

  // Attack tooltip
  if (action.type === 'basic_attack') {
    return (
      <Tooltip
        content={<AttackTooltipContent player={player} />}
        position="top"
        delay={200}
      >
        {button}
      </Tooltip>
    );
  }

  // Flee tooltip
  if (action.type === 'flee') {
    return (
      <Tooltip
        content={<FleeTooltipContent />}
        position="top"
        delay={200}
      >
        {button}
      </Tooltip>
    );
  }

  return button;
}

/**
 * Action buttons component for player actions.
 * Supports keyboard shortcuts (1-9 keys).
 * Consolidates all potions under a single "Use Potion" button with modal selection.
 * Shows tooltips for ability buttons with damage dice and effects.
 */
export function ActionButtons({ actions, onAction, disabled = false }: ActionButtonsProps) {
  const [showPotionModal, setShowPotionModal] = useState(false);
  const { regularActions, potions } = separateActions(actions);
  const { player } = useGame();

  // Calculate total potion count
  const totalPotions = potions.reduce((sum, p) => sum + p.count, 0);
  const playerLevel = player?.level ?? 1;

  return (
    <div className={`action-area ${disabled ? 'disabled' : ''}`} id="action-area">
      <h3>Actions</h3>
      <div className="action-buttons">
        {regularActions.map((action, index) => (
          <ActionButton
            key={`${action.type}-${action.name || action.abilityId || index}`}
            action={action}
            index={index}
            disabled={disabled}
            onAction={onAction}
            playerLevel={playerLevel}
            player={player}
          />
        ))}
        
        {/* Single "Use Potion" button when potions are available */}
        {potions.length > 0 && (
          <button
            className="action-btn action-use_item action-potion"
            onClick={() => !disabled && setShowPotionModal(true)}
            disabled={disabled}
          >
            <span className="action-key">{regularActions.length + 1}</span>
            <span className="action-label">Use Potion ({totalPotions})</span>
          </button>
        )}
      </div>

      {/* Potion selection modal */}
      {showPotionModal && (
        <PotionModal
          potions={potions}
          onSelect={onAction}
          onClose={() => setShowPotionModal(false)}
        />
      )}
    </div>
  );
}

