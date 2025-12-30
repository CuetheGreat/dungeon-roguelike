/**
 * @fileoverview Shop Management System
 * 
 * Handles all shop-related actions including:
 * - Buying items from shops
 * - Selling items to shops
 * - Price calculations
 * 
 * @module game/managers/ShopManager
 */

import { Player } from '../../entities/player';
import { Room } from '../../dungeon/room';
import { getSellPrice } from '../../entities/itemDatabase';
import { ActionResult, GameStats } from '../gameState';

/**
 * Manages shop transactions.
 * Extracted from GameStateManager for better separation of concerns.
 */
export class ShopManager {
    /**
     * Attempts to buy an item from a shop.
     * 
     * @param player - The player making the purchase
     * @param room - The room containing the shop
     * @param itemId - ID of the item to buy
     * @param stats - Game stats to update
     * @returns ActionResult indicating success or failure
     */
    buyItem(player: Player, room: Room | null, itemId: string, stats: GameStats): ActionResult {
        if (!room?.shopInventory) {
            return { type: 'buy_failed', success: false, message: 'No shop here' };
        }
        
        const shopItemIndex = room.shopInventory.findIndex(si => si.item.id === itemId);
        if (shopItemIndex === -1) {
            return { type: 'buy_failed', success: false, message: 'Item not in shop' };
        }
        
        const shopItem = room.shopInventory[shopItemIndex];
        if (player.gold < shopItem.buyPrice) {
            return { 
                type: 'buy_failed', 
                success: false, 
                message: `Not enough gold (need ${shopItem.buyPrice}, have ${player.gold})` 
            };
        }
        
        // Complete the purchase
        player.gold -= shopItem.buyPrice;
        player.addToInventory(shopItem.item);
        room.shopInventory.splice(shopItemIndex, 1);
        stats.itemsFound++;
        
        return { 
            type: 'item_bought', 
            success: true, 
            message: `Bought ${shopItem.item.name} for ${shopItem.buyPrice} gold`,
            result: { item: shopItem.item, gold: -shopItem.buyPrice }
        };
    }

    /**
     * Sells an item from the player's inventory.
     * 
     * @param player - The player selling the item
     * @param itemId - ID of the item to sell
     * @param stats - Game stats to update
     * @returns ActionResult indicating success or failure
     */
    sellItem(player: Player, itemId: string, stats: GameStats): ActionResult {
        const item = player.inventory.find(i => i.id === itemId);
        if (!item) {
            return { type: 'sell_failed', success: false, message: 'Item not found' };
        }
        
        const sellPrice = getSellPrice(item);
        
        // Remove from inventory and add gold
        const itemIndex = player.inventory.findIndex(i => i.id === itemId);
        player.inventory.splice(itemIndex, 1);
        player.addGold(sellPrice);
        stats.goldCollected += sellPrice;
        
        return { 
            type: 'item_sold', 
            success: true, 
            message: `Sold ${item.name} for ${sellPrice} gold`,
            result: { item, gold: sellPrice }
        };
    }

    /**
     * Gets the sell price for an item.
     * 
     * @param itemId - ID of the item to price
     * @param player - The player whose inventory to check
     * @returns The sell price, or 0 if item not found
     */
    getSellPrice(itemId: string, player: Player): number {
        const item = player.inventory.find(i => i.id === itemId);
        if (!item) return 0;
        return getSellPrice(item);
    }
}

