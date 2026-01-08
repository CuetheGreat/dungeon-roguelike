import { Player } from '../../entities/player';
import { Room } from '../../dungeon/room';
import { Item } from '../../entities/item';
import { ShopItem } from '../../entities/itemDatabase';
import { Action } from '../../game/gameState';
import { getItemImage } from '../../ui/imageAssets';

interface ShopViewProps {
  room: Room;
  player: Player;
  onAction: (action: Action) => void;
}

/**
 * Individual shop item card for buying.
 */
function ShopItemCard({ 
  shopItem, 
  canAfford, 
  onBuy 
}: { 
  shopItem: ShopItem; 
  canAfford: boolean; 
  onBuy: () => void;
}) {
  const itemImg = getItemImage(shopItem.item.type, shopItem.item.rarity, 48);
  
  return (
    <div 
      className={`shop-item ${canAfford ? 'affordable' : 'too-expensive'} item-${shopItem.item.type.toLowerCase()} rarity-${shopItem.item.rarity.toLowerCase()}`}
    >
      <img src={itemImg} alt={shopItem.item.name} className="shop-item-image" />
      <div className="item-info">
        <span className="item-name">{shopItem.item.name}</span>
        <span className="item-type">{shopItem.item.type}</span>
        {shopItem.item.description && (
          <span className="item-desc">{shopItem.item.description}</span>
        )}
      </div>
      <div className="item-price">
        <span className="price-amount">{shopItem.buyPrice}</span>
        <span className="price-label">gold</span>
      </div>
      <button 
        className={`buy-btn ${canAfford ? '' : 'disabled'}`}
        onClick={onBuy}
        disabled={!canAfford}
      >
        {canAfford ? 'Buy' : 'Cannot Afford'}
      </button>
    </div>
  );
}

/**
 * Individual inventory item card for selling.
 */
function SellItemCard({ 
  item, 
  sellPrice, 
  onSell 
}: { 
  item: Item; 
  sellPrice: number; 
  onSell: () => void;
}) {
  const itemImg = getItemImage(item.type, item.rarity, 48);
  
  return (
    <div 
      className={`shop-item sellable item-${item.type.toLowerCase()} rarity-${item.rarity.toLowerCase()}`}
    >
      <img src={itemImg} alt={item.name} className="shop-item-image" />
      <div className="item-info">
        <span className="item-name">{item.name}</span>
        <span className="item-type">{item.type}</span>
      </div>
      <div className="item-price sell-price">
        <span className="price-amount">{sellPrice}</span>
        <span className="price-label">gold</span>
      </div>
      <button className="sell-btn" onClick={onSell}>
        Sell
      </button>
    </div>
  );
}

/**
 * Shop view component for buying and selling items.
 */
export function ShopView({ room, player, onAction }: ShopViewProps) {
  if (!room.shopInventory) {
    return (
      <div className="shop-view">
        <p>Shop not available</p>
      </div>
    );
  }

  const handleBuy = (itemId: string) => {
    onAction({ type: 'buy_item', itemId });
  };

  const handleSell = (itemId: string) => {
    onAction({ type: 'sell_item', itemId });
  };

  const handleLeave = () => {
    onAction({ type: 'leave_shop' });
  };

  return (
    <div className="shop-view">
      {/* Shop Header */}
      <div className="shop-header">
        <span className="shop-icon">🏪</span>
        <h2 className="shop-title">Merchant's Wares</h2>
        <div className="player-gold">
          <span className="gold-icon">G</span>
          <span className="gold-amount">{player.gold}</span>
        </div>
      </div>
      
      <p className="shop-description">"Welcome, adventurer! Browse my finest goods..."</p>

      <div className="shop-content">
        {/* Items for Sale */}
        <div className="shop-section for-sale">
          <h3>For Sale</h3>
          <div className="shop-grid">
            {room.shopInventory.length === 0 ? (
              <p className="empty-shop">Sold out!</p>
            ) : (
              room.shopInventory.map((shopItem) => (
                <ShopItemCard
                  key={shopItem.item.id}
                  shopItem={shopItem}
                  canAfford={player.gold >= shopItem.buyPrice}
                  onBuy={() => handleBuy(shopItem.item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Player Items for Selling */}
        <div className="shop-section for-sell">
          <h3>Your Items</h3>
          <div className="shop-grid">
            {player.inventory.length === 0 ? (
              <p className="empty-inventory">No items to sell</p>
            ) : (
              player.inventory.map((item) => {
                const sellPrice = Math.floor(item.value * 0.5);
                return (
                  <SellItemCard
                    key={item.id}
                    item={item}
                    sellPrice={sellPrice}
                    onSell={() => handleSell(item.id)}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Leave Shop Button */}
      <div className="shop-actions">
        <button className="leave-shop-btn" onClick={handleLeave}>
          Leave Shop
        </button>
      </div>
    </div>
  );
}

