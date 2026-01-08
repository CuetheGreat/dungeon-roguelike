import { useCallback } from 'react';
import { Player } from '../../entities/player';
import { Item, ItemType, ItemSlot } from '../../entities/item';
import { Action } from '../../game/gameState';
import { getItemImage } from '../../ui/imageAssets';
import { Tooltip, ItemTooltipContent } from '../ui';

interface InventoryModalProps {
  player: Player;
  onAction: (action: Action) => void;
  onClose: () => void;
}

/**
 * Build tooltip props from an item.
 */
function buildItemTooltipProps(item: Item) {
  return {
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    slot: item.slot ? ItemSlot[item.slot] : undefined,
    value: item.value,
    description: item.description,
    stats: item.stats ? {
      attack: item.stats.attack,
      defense: item.stats.defense,
      health: item.stats.health,
      mana: item.stats.mana,
      speed: item.stats.speed,
      critChance: item.stats.critChance,
    } : undefined,
    damage: item.damage ? {
      dice: item.damage.dice,
      bonus: item.damage.bonus
    } : undefined,
    grantedAbility: item.grantedAbility ? {
      name: item.grantedAbility.name,
      description: item.grantedAbility.description
    } : undefined
  };
}

/**
 * Equipment slot component.
 */
function EquipmentSlot({ 
  slot, 
  label, 
  item, 
  onUnequip 
}: { 
  slot: 'weapon' | 'armor' | 'accessory';
  label: string;
  item: Item | null;
  onUnequip: () => void;
}) {
  const itemImg = item ? getItemImage(item.type, item.rarity, 48) : '';
  
  const slotContent = (
    <div className="equipment-slot" data-slot={slot}>
      <div className="slot-label">{label}</div>
      <div className={`slot-item ${item ? 'filled' : 'empty'}`}>
        {item ? (
          <>
            <img src={itemImg} alt={item.name} className="equipment-image" />
            <span className="item-name">{item.name}</span>
            <button className="unequip-btn" onClick={onUnequip}>
              Unequip
            </button>
          </>
        ) : (
          <span className="empty-slot">Empty</span>
        )}
      </div>
    </div>
  );

  if (item) {
    return (
      <Tooltip content={<ItemTooltipContent {...buildItemTooltipProps(item)} />} position="right" delay={300}>
        {slotContent}
      </Tooltip>
    );
  }

  return slotContent;
}

/**
 * Inventory item card component.
 */
function InventoryItemCard({ 
  item, 
  onEquip, 
  onUse 
}: { 
  item: Item;
  onEquip: () => void;
  onUse: () => void;
}) {
  const itemImg = getItemImage(item.type, item.rarity, 40);
  const isEquipable = ['weapon', 'armor', 'accessory'].includes(item.type.toLowerCase());
  const isConsumable = item.type.toLowerCase() === 'consumable';
  
  return (
    <Tooltip content={<ItemTooltipContent {...buildItemTooltipProps(item)} />} position="top" delay={300}>
      <div className={`inventory-item item-${item.type.toLowerCase()} rarity-${item.rarity.toLowerCase()}`}>
        <img src={itemImg} alt={item.name} className="item-image" />
        <div className="item-info">
          <span className="item-name">{item.name}</span>
          <span className="item-type">{item.type}</span>
        </div>
        <div className="item-actions">
          {isEquipable && (
            <button className="item-action-btn" onClick={onEquip}>
              Equip
            </button>
          )}
          {isConsumable && (
            <button className="item-action-btn" onClick={onUse}>
              Use
            </button>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

/**
 * Inventory modal component.
 * Shows equipped items and inventory grid with item actions.
 */
export function InventoryModal({ player, onAction, onClose }: InventoryModalProps) {
  const handleUnequip = useCallback((slot: 'weapon' | 'armor' | 'accessory') => {
    onAction({ type: 'unequip_item', slot });
  }, [onAction]);

  const handleEquip = useCallback((itemId: string) => {
    onAction({ type: 'equip_item', itemId });
  }, [onAction]);

  const handleUse = useCallback((itemId: string) => {
    onAction({ type: 'use_item', itemId });
  }, [onAction]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="inventory-overlay" onClick={handleOverlayClick}>
      <div className="inventory-modal">
        {/* Header */}
        <div className="inventory-header">
          <h2>Inventory</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="inventory-content">
          {/* Equipment Section (Left) */}
          <div className="equipment-section">
            <h3>Equipment</h3>
            <div className="equipment-slots">
              <EquipmentSlot
                slot="weapon"
                label="Weapon"
                item={player.equipment.weapon}
                onUnequip={() => handleUnequip('weapon')}
              />
              <EquipmentSlot
                slot="armor"
                label="Armor"
                item={player.equipment.armor}
                onUnequip={() => handleUnequip('armor')}
              />
              <EquipmentSlot
                slot="accessory"
                label="Accessory"
                item={player.equipment.accessory}
                onUnequip={() => handleUnequip('accessory')}
              />
            </div>
            <div className="gold-display">
              <span className="gold-icon">G</span>
              <span className="gold-amount">{player.gold}</span>
            </div>
          </div>

          {/* Inventory Grid (Right) */}
          <div className="inventory-grid-section">
            <h3>Items ({player.inventory.length})</h3>
            <div className="inventory-grid">
              {player.inventory.length === 0 ? (
                <div className="empty-inventory">No items in inventory</div>
              ) : (
                player.inventory.map(item => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    onEquip={() => handleEquip(item.id)}
                    onUse={() => handleUse(item.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

