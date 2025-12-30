/**
 * @fileoverview Type-safe Action Definitions
 * 
 * This module defines discriminated union types for all game actions,
 * providing compile-time type safety for action handling.
 * 
 * @module types/actions
 */

import { RoomType } from '../dungeon/room';

/**
 * Movement action - move to a connected room.
 */
export interface MoveAction {
    type: 'move';
    roomId: string;
    roomType?: RoomType;
}

/**
 * Basic attack action in combat.
 */
export interface BasicAttackAction {
    type: 'basic_attack';
}

/**
 * Use an ability in combat.
 */
export interface AbilityAction {
    type: 'ability';
    abilityId: string;
    name?: string;
}

/**
 * Use a consumable item.
 */
export interface UseItemAction {
    type: 'use_item';
    itemId: string;
    itemName?: string;
}

/**
 * Equip an item from inventory.
 */
export interface EquipItemAction {
    type: 'equip_item';
    itemId: string;
    itemName?: string;
}

/**
 * Unequip an item from a slot.
 */
export interface UnequipItemAction {
    type: 'unequip_item';
    itemId?: string;
    itemName?: string;
    slot: 'weapon' | 'armor' | 'accessory';
}

/**
 * Buy an item from shop.
 */
export interface BuyItemAction {
    type: 'buy_item';
    itemId: string;
    itemName?: string;
    price: number;
}

/**
 * Sell an item to shop.
 */
export interface SellItemAction {
    type: 'sell_item';
    itemId: string;
    itemName?: string;
    price?: number;
}

/**
 * Interact with an object in the room.
 */
export interface InteractAction {
    type: 'interact';
    interactableIndex: number;
    interactableName?: string;
}

/**
 * Answer a puzzle question.
 */
export interface PuzzleAnswerAction {
    type: 'puzzle_answer';
    answerIndex: number;
    answerText?: string;
}

/**
 * Skip a puzzle.
 */
export interface SkipPuzzleAction {
    type: 'skip_puzzle';
    name?: string;
}

/**
 * Accept event outcome.
 */
export interface AcceptEventAction {
    type: 'accept_event';
    name?: string;
}

/**
 * Flee from combat.
 */
export interface FleeAction {
    type: 'flee';
}

/**
 * Rest at a rest room.
 */
export interface RestAction {
    type: 'rest';
}

/**
 * Leave current room/shop.
 */
export interface LeaveAction {
    type: 'leave' | 'leave_shop';
    name?: string;
}

/**
 * Open inventory overlay.
 */
export interface OpenInventoryAction {
    type: 'open_inventory';
}

/**
 * Close inventory overlay.
 */
export interface CloseInventoryAction {
    type: 'close_inventory';
}

/**
 * View character sheet.
 */
export interface ViewCharacterAction {
    type: 'view_character';
}

/**
 * Close character sheet.
 */
export interface CloseCharacterAction {
    type: 'close_character';
}

/**
 * View game stats.
 */
export interface ViewStatsAction {
    type: 'view_stats';
}

/**
 * Restart the game.
 */
export interface RestartAction {
    type: 'restart';
}

/**
 * Quit the game.
 */
export interface QuitAction {
    type: 'quit';
}

/**
 * Union type of all possible game actions.
 * Using discriminated unions provides type-safe action handling.
 */
export type GameAction =
    | MoveAction
    | BasicAttackAction
    | AbilityAction
    | UseItemAction
    | EquipItemAction
    | UnequipItemAction
    | BuyItemAction
    | SellItemAction
    | InteractAction
    | PuzzleAnswerAction
    | SkipPuzzleAction
    | AcceptEventAction
    | FleeAction
    | RestAction
    | LeaveAction
    | OpenInventoryAction
    | CloseInventoryAction
    | ViewCharacterAction
    | CloseCharacterAction
    | ViewStatsAction
    | RestartAction
    | QuitAction;

/**
 * Type guard to check if an action is a combat action.
 */
export function isCombatAction(action: GameAction): action is BasicAttackAction | AbilityAction | UseItemAction | FleeAction {
    return ['basic_attack', 'ability', 'use_item', 'flee'].includes(action.type);
}

/**
 * Type guard to check if an action is an inventory action.
 */
export function isInventoryAction(action: GameAction): action is EquipItemAction | UnequipItemAction | UseItemAction {
    return ['equip_item', 'unequip_item', 'use_item'].includes(action.type);
}

/**
 * Type guard to check if an action is a shop action.
 */
export function isShopAction(action: GameAction): action is BuyItemAction | SellItemAction {
    return ['buy_item', 'sell_item'].includes(action.type);
}

/**
 * Type guard to check if an action consumes a combat turn.
 */
export function consumesCombatTurn(action: GameAction): boolean {
    const nonTurnActions = new Set([
        'open_inventory',
        'close_inventory',
        'view_character',
        'close_character',
        'equip_item',
        'unequip_item',
    ]);
    return !nonTurnActions.has(action.type);
}

