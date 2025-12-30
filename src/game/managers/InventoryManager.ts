/**
 * @fileoverview Inventory Management System
 * 
 * Handles all inventory-related actions including:
 * - Equipping and unequipping items
 * - Using consumable items
 * - Managing inventory state
 * 
 * @module game/managers/InventoryManager
 */

import { Player } from '../../entities/player';
import { Item, ItemSlot } from '../../entities/item';
import { ActionResult } from '../gameState';

/**
 * Manages player inventory operations.
 * Extracted from GameStateManager for better separation of concerns.
 */
export class InventoryManager {
    /**
     * Equips an item from the player's inventory.
     * 
     * @param player - The player to equip the item on
     * @param itemId - ID of the item to equip
     * @returns ActionResult indicating success or failure
     */
    equipItem(player: Player, itemId: string): ActionResult {
        const item = player.inventory.find(i => i.id === itemId);
        if (!item) {
            return { type: 'equip_failed', success: false, message: 'Item not found' };
        }
        
        const equipped = player.equipItem(item);
        if (equipped) {
            return { 
                type: 'item_equipped', 
                success: true, 
                message: `Equipped ${item.name}`,
                result: { item }
            };
        }
        return { type: 'equip_failed', success: false, message: `Cannot equip ${item.name}` };
    }

    /**
     * Unequips an item from a specific slot.
     * 
     * @param player - The player to unequip from
     * @param slotName - Name of the slot to unequip ('weapon', 'armor', 'accessory')
     * @returns ActionResult indicating success or failure
     */
    unequipItem(player: Player, slotName: string | undefined): ActionResult {
        if (!slotName) {
            return { type: 'unequip_failed', success: false, message: 'No slot specified' };
        }
        
        // Convert slot name to ItemSlot enum
        const slotMap: Record<string, ItemSlot> = {
            'weapon': ItemSlot.WEAPON,
            'armor': ItemSlot.ARMOR,
            'accessory': ItemSlot.ACCESSORY
        };
        
        const itemSlot = slotMap[slotName];
        if (!itemSlot) {
            return { type: 'unequip_failed', success: false, message: 'Invalid slot' };
        }
        
        const item = player.equipment[slotName as keyof typeof player.equipment];
        if (!item) {
            return { type: 'unequip_failed', success: false, message: 'No item in that slot' };
        }
        
        const unequipped = player.unequipSlot(itemSlot);
        if (unequipped) {
            return { 
                type: 'item_unequipped', 
                success: true, 
                message: `Unequipped ${item.name}`,
                result: { item: unequipped }
            };
        }
        return { type: 'unequip_failed', success: false, message: `Cannot unequip ${item.name}` };
    }

    /**
     * Uses a consumable item from the player's inventory.
     * 
     * @param player - The player using the item
     * @param itemId - ID of the item to use
     * @returns ActionResult indicating success or failure
     */
    useItem(player: Player, itemId: string): ActionResult {
        const item = player.inventory.find(i => i.id === itemId);
        if (!item) {
            return { type: 'use_failed', success: false, message: 'Item not found' };
        }
        
        const success = player.useConsumable(item);
        return { 
            type: 'item_used', 
            success, 
            message: success ? `Used ${item.name}` : 'Failed to use item',
            result: { item }
        };
    }
}

