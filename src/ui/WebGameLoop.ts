/**
 * @fileoverview Web-based UI implementation for the Dungeon Roguelike
 * 
 * This module provides a browser-based implementation of the GameLoop,
 * rendering the game state to HTML elements and handling user input
 * through click events and keyboard shortcuts.
 * 
 * @module ui/WebGameLoop
 */

import { GameLoop } from '../game/gameLoop';
import { GameState, GamePhase, Action, ActionResult } from '../game/gameState';
import { AttackResult, CombatStatus, AbilityResult } from '../game/combatEngine';
import { Player } from '../entities/player';
import { Room, RoomType, RoomState } from '../dungeon/room';
import { Enemy } from '../entities/enemy';
import { Item } from '../entities/item';
import { getPlayerImage, getMonsterImage, getItemImage } from './imageAssets';
import { getXPForNextLevel, getXPProgress, MAX_LOG_MESSAGES } from '../game/constants';

/**
 * Browser-based implementation of the game loop.
 * Renders game state to DOM elements and handles user input via events.
 */
export class WebGameLoop extends GameLoop {
    /** Container element for the entire game UI */
    private container: HTMLElement;
    
    /** Current pending action resolver (for async input) */
    private actionResolver: ((action: Action) => void) | null = null;
    
    /** Current pending target resolver (for combat targeting) */
    private targetResolver: ((targetId: string) => void) | null = null;
    
    /** Message log entries (supports HTML for formatting) */
    private messageLog: string[] = [];
    

    /**
     * Formats a name with appropriate color class based on type.
     * @param name - The name to format
     * @param type - The type of name (player, enemy, item, gold, damage, heal, ability)
     * @returns HTML string with colored span
     */
    private formatName(name: string, type: 'player' | 'enemy' | 'item' | 'gold' | 'damage' | 'heal' | 'ability' | 'crit' | 'miss' | 'room'): string {
        return `<span class="log-${type}">${name}</span>`;
    }

    /**
     * Formats an item name with rarity color.
     * @param name - The item name
     * @param rarity - The item rarity (optional)
     * @returns HTML string with colored span
     */
    private formatItemName(name: string, rarity?: string): string {
        const rarityClass = rarity ? `log-item-${rarity.toLowerCase().replace('_', '')}` : 'log-item';
        return `<span class="${rarityClass}">${name}</span>`;
    }

    /**
     * Formats event messages with appropriate styling for items, gold, health, etc.
     */
    private formatEventMessage(message: string): string {
        let formatted = message;
        
        // Format "You found [Item Name]!" pattern
        const foundItemMatch = message.match(/You found (.+?)!/);
        if (foundItemMatch) {
            const itemName = foundItemMatch[1];
            // Check if it's a known item type by keywords
            let itemClass = 'log-item-rare'; // Default to rare for event items
            if (message.toLowerCase().includes('legendary') || message.toLowerCase().includes('ancient')) {
                itemClass = 'log-item-legendary';
            } else if (message.toLowerCase().includes('uncommon') || message.toLowerCase().includes('minor')) {
                itemClass = 'log-item-uncommon';
            } else if (message.toLowerCase().includes('common') || message.toLowerCase().includes('basic')) {
                itemClass = 'log-item-common';
            }
            formatted = formatted.replace(
                `You found ${itemName}!`,
                `You found <span class="${itemClass}">${itemName}</span>!`
            );
        }
        
        // Format "Received [Item Name]" pattern
        const receivedMatch = message.match(/Received (.+?)(?:\.|!|$)/);
        if (receivedMatch) {
            const itemName = receivedMatch[1];
            formatted = formatted.replace(
                `Received ${itemName}`,
                `Received <span class="log-item-rare">${itemName}</span>`
            );
        }
        
        // Format gold amounts
        const goldMatch = message.match(/(\d+)\s*gold/gi);
        if (goldMatch) {
            goldMatch.forEach(match => {
                const amount = match.match(/\d+/)?.[0];
                if (amount) {
                    formatted = formatted.replace(match, `<span class="log-gold">${amount} gold</span>`);
                }
            });
        }
        
        // Format healing
        const healMatch = message.match(/healed?\s+(?:for\s+)?(\d+)/gi);
        if (healMatch) {
            healMatch.forEach(match => {
                const amount = match.match(/\d+/)?.[0];
                if (amount) {
                    formatted = formatted.replace(match, `<span class="log-heal">healed ${amount}</span>`);
                }
            });
        }
        
        // Format damage
        const damageMatch = message.match(/(?:took|deals?|suffer(?:ed)?)\s+(\d+)\s*(?:damage)?/gi);
        if (damageMatch) {
            damageMatch.forEach(match => {
                formatted = formatted.replace(match, `<span class="log-damage">${match}</span>`);
            });
        }
        
        // Format stat bonuses (+X stat)
        const statMatch = message.match(/[+-]\d+\s+(?:attack|defense|speed|health|mana|crit)/gi);
        if (statMatch) {
            statMatch.forEach(match => {
                const isPositive = match.startsWith('+');
                const className = isPositive ? 'log-heal' : 'log-damage';
                formatted = formatted.replace(match, `<span class="${className}">${match}</span>`);
            });
        }
        
        // Format buff/debuff names (typically capitalized phrases)
        const buffMatch = message.match(/(?:gained|received|afflicted with)\s+["']?([A-Z][a-zA-Z\s]+?)["']?(?:\s+for|\.|!|$)/);
        if (buffMatch) {
            const buffName = buffMatch[1].trim();
            formatted = formatted.replace(buffName, `<span class="log-ability">${buffName}</span>`);
        }
        
        return formatted;
    }

    /**
     * Creates a new WebGameLoop attached to the specified container.
     * 
     * @param containerId - ID of the HTML element to render the game into
     */
    constructor(containerId: string = 'game-container') {
        super();
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element '${containerId}' not found`);
        }
        this.container = container;
        this.setupKeyboardControls();
    }

    /**
     * Sets up global keyboard event listeners for game controls.
     */
    private setupKeyboardControls(): void {
        document.addEventListener('keydown', (e) => {
            // Number keys 1-9 for action selection
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                this.selectActionByIndex(index);
            }
            // Escape to cancel/close modals
            if (e.key === 'Escape') {
                this.handleEscape();
            }
        });
    }

    /**
     * Selects an action by its index in the current action list.
     */
    private selectActionByIndex(index: number): void {
        const actionButtons = this.container.querySelectorAll('.action-btn');
        if (index < actionButtons.length) {
            (actionButtons[index] as HTMLButtonElement).click();
        }
    }

    /**
     * Handles escape key press - closes modals or cancels targeting.
     */
    private handleEscape(): void {
        // Close any open modals
        const modal = this.container.querySelector('.modal');
        if (modal) {
            modal.remove();
        }
    }

    // =========================================================================
    // INPUT HANDLING OVERRIDES
    // =========================================================================

    /**
     * Waits for player to select an action from the available options.
     * Returns a Promise that resolves when an action button is clicked.
     */
    protected async getPlayerInput(availableActions: Action[]): Promise<Action> {
        return new Promise((resolve) => {
            this.actionResolver = resolve;
            this.renderActionButtons(availableActions);
        });
    }

    /**
     * Waits for player to select a target from valid options.
     * Shows a target selection UI overlay.
     */
    protected async getTargetSelection(validTargets: string[]): Promise<string> {
        return new Promise((resolve) => {
            this.targetResolver = resolve;
            this.renderTargetSelection(validTargets);
        });
    }

    // =========================================================================
    // RENDERING OVERRIDES
    // =========================================================================

    /**
     * Renders the complete game state to the DOM with error handling.
     * If rendering fails, displays an error message instead of crashing.
     */
    protected render(state: GameState): void {
        try {
            this.container.innerHTML = '';
            this.container.appendChild(this.createGameLayout(state));
            
            // Show inventory overlay if in inventory phase
            if (state.phase === GamePhase.INVENTORY) {
                this.container.appendChild(this.createInventoryOverlay(state));
            }
            
            // Show character overlay if in character phase
            if (state.phase === GamePhase.CHARACTER) {
                this.container.appendChild(this.createCharacterOverlay(state));
            }
        } catch (error) {
            this.renderError(error, state);
        }
    }

    /**
     * Renders an error state when rendering fails.
     * Provides a way to recover or restart the game.
     * 
     * @param error - The error that occurred
     * @param state - The game state at time of error
     */
    private renderError(error: unknown, state: GameState): void {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        
        console.error('Render error:', error);
        
        this.container.innerHTML = `
            <div class="error-screen">
                <h1 class="error-title">Something went wrong</h1>
                <p class="error-message">${this.escapeHtml(errorMessage)}</p>
                <details class="error-details">
                    <summary>Technical Details</summary>
                    <pre>${this.escapeHtml(errorStack || 'No stack trace available')}</pre>
                    <p>Game Phase: ${state.phase}</p>
                    <p>Current Room: ${state.dungeon.currentRoomId || 'None'}</p>
                    <p>Seed: ${state.seed}</p>
                </details>
                <div class="error-actions">
                    <button class="error-btn" onclick="location.reload()">Restart Game</button>
                </div>
            </div>
        `;
    }

    /**
     * Escapes HTML special characters to prevent XSS.
     * 
     * @param text - The text to escape
     * @returns Escaped text safe for HTML insertion
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Creates the main game layout structure.
     */
    private createGameLayout(state: GameState): HTMLElement {
        const layout = document.createElement('div');
        layout.className = 'game-layout';

        // Left sidebar - Player stats
        const sidebar = this.createPlayerSidebar(state);
        layout.appendChild(sidebar);

        // Main content area
        const main = document.createElement('main');
        main.className = 'game-main';

        // Room/Combat/Event/Shop/Puzzle/Treasure view
        const currentRoom = this.getCurrentRoom(state);
        if (state.phase === GamePhase.COMBAT) {
            main.appendChild(this.createCombatView(state, currentRoom));
        } else if (state.phase === GamePhase.EVENT && currentRoom?.event) {
            main.appendChild(this.createEventView(state, currentRoom));
        } else if (state.phase === GamePhase.SHOP && currentRoom?.shopInventory) {
            main.appendChild(this.createShopView(state, currentRoom));
        } else if (state.phase === GamePhase.PUZZLE && currentRoom?.puzzle) {
            main.appendChild(this.createPuzzleView(state, currentRoom));
        } else if (state.phase === GamePhase.TREASURE) {
            main.appendChild(this.createTreasureView(state, currentRoom));
        } else {
            main.appendChild(this.createRoomView(state, currentRoom));
        }

        // Action area
        const actionArea = document.createElement('div');
        actionArea.className = 'action-area';
        actionArea.id = 'action-area';
        main.appendChild(actionArea);

        layout.appendChild(main);

        // Right sidebar - Message log and minimap
        const rightSidebar = this.createRightSidebar(state);
        layout.appendChild(rightSidebar);

        // Seed display in bottom left corner
        const seedDisplay = document.createElement('div');
        seedDisplay.className = 'seed-display';
        seedDisplay.innerHTML = `
            <span class="seed-label">Seed:</span>
            <span class="seed-value" title="Click to copy">${state.seed}</span>
        `;
        seedDisplay.querySelector('.seed-value')?.addEventListener('click', () => {
            navigator.clipboard.writeText(state.seed).then(() => {
                const seedValue = seedDisplay.querySelector('.seed-value');
                if (seedValue) {
                    seedValue.textContent = 'Copied!';
                    setTimeout(() => {
                        seedValue.textContent = state.seed;
                    }, 1500);
                }
            });
        });
        layout.appendChild(seedDisplay);

        return layout;
    }

    /**
     * Creates the player stats sidebar.
     */
    private createPlayerSidebar(state: GameState): HTMLElement {
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar sidebar-left';

        if (!state.player) {
            sidebar.innerHTML = '<p>No player</p>';
            return sidebar;
        }

        const player = state.player;
        const playerImage = getPlayerImage(player.playerClass, 80);

        sidebar.innerHTML = `
            <div class="player-info">
                <img src="${playerImage}" alt="${player.playerClass}" class="player-portrait" />
                <h2 class="player-name">${player.name}</h2>
                <div class="player-class">${player.playerClass} Lv.${player.level}</div>
            </div>
            
            <div class="stat-bars">
                <div class="stat-bar health-bar">
                    <div class="stat-bar-label">
                        <span>HP</span>
                        <span>${player.stats.health}/${player.getMaxHealth()}</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width: ${(player.stats.health / player.getMaxHealth()) * 100}%"></div>
                    </div>
                </div>
                
                <div class="stat-bar mana-bar">
                    <div class="stat-bar-label">
                        <span>MP</span>
                        <span>${player.stats.mana}/${player.getMaxMana()}</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width: ${(player.stats.mana / player.getMaxMana()) * 100}%"></div>
                    </div>
                </div>
                
                <div class="stat-bar xp-bar">
                    <div class="stat-bar-label">
                        <span>XP</span>
                        <span>${player.experience}/${getXPForNextLevel(player.level)}</span>
                    </div>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width: ${getXPProgress(player.level, player.experience)}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="player-stats">
                <div class="stat-row">
                    <span class="stat-icon">&#9876;</span>
                    <span class="stat-label">Attack</span>
                    <span class="stat-value">${player.getAttackPower()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-icon">&#128737;</span>
                    <span class="stat-label">Defense</span>
                    <span class="stat-value">${player.getDefense()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-icon">&#9889;</span>
                    <span class="stat-label">Speed</span>
                    <span class="stat-value">${player.getSpeed()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-icon">&#10026;</span>
                    <span class="stat-label">Crit</span>
                    <span class="stat-value">${player.getCritChance()}%</span>
                </div>
            </div>
            
            <div class="player-gold">
                <span class="gold-icon">&#9733;</span>
                <span class="gold-amount">${player.gold}</span>
                <span class="gold-label">Gold</span>
            </div>
            
            ${player.relics.length > 0 ? `
            <div class="player-relics">
                <h3>Relics (${player.relics.length})</h3>
                <div class="relic-list">
                    ${player.relics.slice(0, 5).map(relic => `
                        <div class="relic-item relic-${relic.rarity}" title="${relic.description}">
                            <span class="relic-icon">${this.getRelicIcon(relic.type)}</span>
                            <span class="relic-name">${relic.name}</span>
                        </div>
                    `).join('')}
                    ${player.relics.length > 5 ? `<div class="relic-more">+${player.relics.length - 5} more</div>` : ''}
                </div>
            </div>
            ` : ''}
            
            <div class="game-stats">
                <div class="game-stat">Rooms: ${state.stats.roomsCleared}</div>
                <div class="game-stat">Enemies: ${state.stats.enemiesDefeated}</div>
            </div>
        `;

        return sidebar;
    }

    /**
     * Gets an icon for a relic type.
     */
    private getRelicIcon(type: string): string {
        switch (type) {
            case 'ability': return '&#10024;'; // sparkles
            case 'stat_boost': return '&#9650;'; // triangle up
            case 'passive': return '&#9711;'; // circle
            case 'combat_modifier': return '&#9876;'; // swords
            default: return '&#10070;'; // diamond
        }
    }

    /**
     * Creates the right sidebar with message log and minimap.
     */
    private createRightSidebar(state: GameState): HTMLElement {
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar sidebar-right';

        // Minimap
        const minimap = this.createMinimap(state);
        sidebar.appendChild(minimap);

        // Message log
        const log = document.createElement('div');
        log.className = 'message-log';
        log.innerHTML = `
            <h3>Log</h3>
            <div class="log-entries">
                ${this.messageLog.slice(-8).map(msg => `<div class="log-entry">${msg}</div>`).join('')}
            </div>
        `;
        sidebar.appendChild(log);

        return sidebar;
    }

    /**
     * Creates a minimap showing dungeon structure with connections.
     * Shows current level, one above, and one below with visual connections.
     */
    private createMinimap(state: GameState): HTMLElement {
        const minimap = document.createElement('div');
        minimap.className = 'minimap';
        
        const currentRoom = this.getCurrentRoom(state);
        const currentLevel = currentRoom?.level ?? 1;
        
        // Find rooms that connect TO current room (came from - previous level)
        const cameFromRooms = new Set<string>();
        // Find rooms that current room connects TO (can go to - next level)
        const canGoToRooms = new Set<string>(currentRoom?.connections ?? []);
        
        // Find which rooms on previous level connect to current room
        if (currentRoom) {
            const prevLayer = state.dungeon.layers.find(l => l.level === currentLevel - 1);
            if (prevLayer) {
                prevLayer.rooms.forEach(room => {
                    if (room.connections.includes(currentRoom.id)) {
                        cameFromRooms.add(room.id);
                    }
                });
            }
        }
        
        // Header with level indicator
        minimap.innerHTML = `
            <div class="minimap-header">
                <h3>Dungeon Map</h3>
                <span class="current-level">Level ${currentLevel}</span>
            </div>
        `;

        const mapContent = document.createElement('div');
        mapContent.className = 'minimap-content';

        // Show levels: previous, current, next (in order from top to bottom)
        const levelsToShow = [currentLevel - 1, currentLevel, currentLevel + 1].filter(l => l >= 1);
        
        // Store room positions for drawing connections
        const roomPositions: Map<string, { level: number; index: number; total: number }> = new Map();
        
        levelsToShow.forEach(levelNum => {
            const layer = state.dungeon.layers.find(l => l.level === levelNum);
            if (!layer) return;
            
            layer.rooms.forEach((room, index) => {
                roomPositions.set(room.id, { level: levelNum, index, total: layer.rooms.length });
            });
        });

        levelsToShow.forEach(levelNum => {
            const layer = state.dungeon.layers.find(l => l.level === levelNum);
            if (!layer) return;
            
            const levelDiv = document.createElement('div');
            levelDiv.className = `minimap-level ${levelNum === currentLevel ? 'current-level-row' : ''}`;
            levelDiv.dataset.level = levelNum.toString();
            
            // Level label with direction indicator
            const levelLabel = document.createElement('div');
            levelLabel.className = 'minimap-level-label';
            if (levelNum < currentLevel) {
                levelLabel.innerHTML = `<span class="level-arrow up">&#9650;</span> L${levelNum}`;
            } else if (levelNum > currentLevel) {
                levelLabel.innerHTML = `L${levelNum} <span class="level-arrow down">&#9660;</span>`;
            } else {
                levelLabel.innerHTML = `<span class="level-marker">&#9654;</span> L${levelNum}`;
            }
            levelDiv.appendChild(levelLabel);
            
            // Rooms container
            const roomsContainer = document.createElement('div');
            roomsContainer.className = 'minimap-rooms';
            
            layer.rooms.forEach((room, index) => {
                const roomNode = document.createElement('div');
                roomNode.className = `minimap-room ${room.state.toLowerCase()} room-${room.type.toLowerCase()}`;
                roomNode.dataset.roomId = room.id;
                
                // Current room
                if (room.id === state.dungeon.currentRoomId) {
                    roomNode.classList.add('current');
                }
                
                // Room you came from (previous level, connected to current)
                if (cameFromRooms.has(room.id)) {
                    roomNode.classList.add('came-from');
                }
                
                // Rooms you can go to (connected from current room)
                if (canGoToRooms.has(room.id) && room.id !== state.dungeon.currentRoomId) {
                    roomNode.classList.add('can-go-to');
                }
                
                // Add icon
                roomNode.innerHTML = this.getRoomIcon(room.type);
                
                // Tooltip with more info
                let stateLabel = room.state === 'cleared' ? 'Cleared' : 
                                 room.state === 'available' ? 'Available' :
                                 room.state === 'active' ? 'Current' : 'Locked';
                if (cameFromRooms.has(room.id)) stateLabel += ' (Came from)';
                if (canGoToRooms.has(room.id) && room.state === 'available') stateLabel += ' (Can go)';
                
                roomNode.title = `${this.formatRoomType(room.type)} - ${stateLabel}`;
                
                roomsContainer.appendChild(roomNode);
            });
            
            levelDiv.appendChild(roomsContainer);
            mapContent.appendChild(levelDiv);
        });

        // Legend
        const legend = document.createElement('div');
        legend.className = 'minimap-legend';
        legend.innerHTML = `
            <div class="legend-item"><span class="legend-dot current"></span> Current</div>
            <div class="legend-item"><span class="legend-dot came-from"></span> Came From</div>
            <div class="legend-item"><span class="legend-dot can-go-to"></span> Can Go To</div>
            <div class="legend-item"><span class="legend-dot locked"></span> Locked</div>
        `;

        minimap.appendChild(mapContent);
        minimap.appendChild(legend);
        return minimap;
    }

    /**
     * Formats room type for display.
     */
    private formatRoomType(type: string): string {
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }

    /**
     * Creates the inventory overlay modal.
     * Shows equipped items and inventory grid with item actions.
     */
    private createInventoryOverlay(state: GameState): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'inventory-overlay';

        const modal = document.createElement('div');
        modal.className = 'inventory-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'inventory-header';
        header.innerHTML = `
            <h2>Inventory</h2>
            <button class="close-btn" data-action="close_inventory">X</button>
        `;
        modal.appendChild(header);

        if (!state.player) {
            modal.innerHTML += '<p>No player data</p>';
            overlay.appendChild(modal);
            return overlay;
        }

        const player = state.player;
        const content = document.createElement('div');
        content.className = 'inventory-content';

        // Equipment section (left side)
        const equipmentSection = document.createElement('div');
        equipmentSection.className = 'equipment-section';
        const weaponImg = player.equipment.weapon 
            ? getItemImage(player.equipment.weapon.type, player.equipment.weapon.rarity, 48) 
            : '';
        const armorImg = player.equipment.armor 
            ? getItemImage(player.equipment.armor.type, player.equipment.armor.rarity, 48) 
            : '';
        const accessoryImg = player.equipment.accessory 
            ? getItemImage(player.equipment.accessory.type, player.equipment.accessory.rarity, 48) 
            : '';

        equipmentSection.innerHTML = `
            <h3>Equipment</h3>
            <div class="equipment-slots">
                <div class="equipment-slot" data-slot="weapon">
                    <div class="slot-label">Weapon</div>
                    <div class="slot-item ${player.equipment.weapon ? 'filled' : 'empty'}">
                        ${player.equipment.weapon 
                            ? `<img src="${weaponImg}" alt="${player.equipment.weapon.name}" class="equipment-image" />
                               <span class="item-name">${player.equipment.weapon.name}</span>
                               <button class="unequip-btn" data-action="unequip_item" data-slot="weapon">Unequip</button>`
                            : '<span class="empty-slot">Empty</span>'}
                    </div>
                </div>
                <div class="equipment-slot" data-slot="armor">
                    <div class="slot-label">Armor</div>
                    <div class="slot-item ${player.equipment.armor ? 'filled' : 'empty'}">
                        ${player.equipment.armor 
                            ? `<img src="${armorImg}" alt="${player.equipment.armor.name}" class="equipment-image" />
                               <span class="item-name">${player.equipment.armor.name}</span>
                               <button class="unequip-btn" data-action="unequip_item" data-slot="armor">Unequip</button>`
                            : '<span class="empty-slot">Empty</span>'}
                    </div>
                </div>
                <div class="equipment-slot" data-slot="accessory">
                    <div class="slot-label">Accessory</div>
                    <div class="slot-item ${player.equipment.accessory ? 'filled' : 'empty'}">
                        ${player.equipment.accessory 
                            ? `<img src="${accessoryImg}" alt="${player.equipment.accessory.name}" class="equipment-image" />
                               <span class="item-name">${player.equipment.accessory.name}</span>
                               <button class="unequip-btn" data-action="unequip_item" data-slot="accessory">Unequip</button>`
                            : '<span class="empty-slot">Empty</span>'}
                    </div>
                </div>
            </div>
            <div class="gold-display">
                <span class="gold-icon">G</span>
                <span class="gold-amount">${player.gold}</span>
            </div>
        `;
        content.appendChild(equipmentSection);

        // Inventory grid (right side)
        const inventorySection = document.createElement('div');
        inventorySection.className = 'inventory-grid-section';
        inventorySection.innerHTML = `<h3>Items (${player.inventory.length})</h3>`;

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        if (player.inventory.length === 0) {
            grid.innerHTML = '<div class="empty-inventory">No items in inventory</div>';
        } else {
            player.inventory.forEach(item => {
                const itemImg = getItemImage(item.type, item.rarity, 40);
                const itemEl = document.createElement('div');
                itemEl.className = `inventory-item item-${item.type.toLowerCase()} rarity-${item.rarity.toLowerCase()}`;
                itemEl.innerHTML = `
                    <img src="${itemImg}" alt="${item.name}" class="item-image" />
                    <div class="item-info">
                        <span class="item-name">${item.name}</span>
                        <span class="item-type">${item.type}</span>
                    </div>
                    <div class="item-actions">
                        ${this.getItemActions(item)}
                    </div>
                `;
                grid.appendChild(itemEl);
            });
        }

        inventorySection.appendChild(grid);
        content.appendChild(inventorySection);

        modal.appendChild(content);
        overlay.appendChild(modal);

        // Add click handler for close button and item actions
        overlay.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            
            if (action === 'close_inventory') {
                if (this.actionResolver) {
                    this.actionResolver({ type: 'close_inventory' });
                }
            } else if (action === 'unequip_item') {
                const slot = target.dataset.slot as 'weapon' | 'armor' | 'accessory';
                if (this.actionResolver && slot) {
                    this.actionResolver({ type: 'unequip_item', slot });
                }
            } else if (action === 'equip_item') {
                const itemId = target.dataset.itemId;
                if (this.actionResolver && itemId) {
                    this.actionResolver({ type: 'equip_item', itemId });
                }
            } else if (action === 'use_item') {
                const itemId = target.dataset.itemId;
                if (this.actionResolver && itemId) {
                    this.actionResolver({ type: 'use_item', itemId });
                }
            }
        });

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && this.actionResolver) {
                this.actionResolver({ type: 'close_inventory' });
            }
        });

        return overlay;
    }

    /**
     * Returns action buttons HTML for an inventory item based on its type.
     */
    private getItemActions(item: { id: string; type: string; name: string }): string {
        switch (item.type.toLowerCase()) {
            case 'weapon':
            case 'armor':
            case 'accessory':
                return `<button class="item-action-btn" data-action="equip_item" data-item-id="${item.id}">Equip</button>`;
            case 'consumable':
                return `<button class="item-action-btn" data-action="use_item" data-item-id="${item.id}">Use</button>`;
            default:
                return '';
        }
    }

    /**
     * Creates the character sheet overlay modal.
     */
    private createCharacterOverlay(state: GameState): HTMLElement {
        const overlay = document.createElement('div');
        overlay.className = 'character-overlay';

        const modal = document.createElement('div');
        modal.className = 'character-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'character-header';
        header.innerHTML = `
            <h2>Character Sheet</h2>
            <button class="close-btn" data-action="close_character">X</button>
        `;
        modal.appendChild(header);

        if (!state.player) {
            modal.innerHTML += '<p>No player data</p>';
            overlay.appendChild(modal);
            return overlay;
        }

        const player = state.player;
        const content = document.createElement('div');
        content.className = 'character-content';

        content.innerHTML = `
            <div class="character-info">
                <h3>${player.name}</h3>
                <p class="character-class">${player.playerClass} - Level ${player.level}</p>
            </div>
            
            <div class="character-stats">
                <h4>Stats</h4>
                <div class="stat-grid">
                    <div class="stat-item">
                        <span class="stat-label">Health</span>
                        <span class="stat-value">${player.stats.health}/${player.getMaxHealth()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Mana</span>
                        <span class="stat-value">${player.stats.mana}/${player.getMaxMana()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Attack</span>
                        <span class="stat-value">${player.getAttackPower()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Defense</span>
                        <span class="stat-value">${player.getDefense()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Speed</span>
                        <span class="stat-value">${player.getSpeed()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Crit Chance</span>
                        <span class="stat-value">${player.getCritChance()}%</span>
                    </div>
                </div>
            </div>
            
            <div class="character-abilities">
                <h4>Abilities</h4>
                <div class="ability-list">
                    ${player.abilities.map(ability => `
                        <div class="ability-item ${ability.currentCooldown > 0 ? 'on-cooldown' : ''}">
                            <span class="ability-name">${ability.name}</span>
                            <span class="ability-cost">${ability.manaCost} MP</span>
                            ${ability.currentCooldown > 0 ? `<span class="ability-cd">(${ability.currentCooldown} turns)</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="character-experience">
                <h4>Experience</h4>
                <p>XP: ${player.experience} / ${getXPForNextLevel(player.level)}</p>
                <p>Gold: ${player.gold}</p>
            </div>
        `;

        modal.appendChild(content);
        overlay.appendChild(modal);

        // Add click handler for close button
        overlay.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.dataset.action === 'close_character' || e.target === overlay) {
                if (this.actionResolver) {
                    this.actionResolver({ type: 'close_character' });
                }
            }
        });

        return overlay;
    }

    /**
     * Creates the room view for exploration phase.
     */
    private createRoomView(state: GameState, room: Room | null): HTMLElement {
        const view = document.createElement('div');
        view.className = 'room-view';

        if (!room) {
            view.innerHTML = '<p>No room</p>';
            return view;
        }

        view.innerHTML = `
            <div class="room-header">
                <span class="room-icon">${this.getRoomIcon(room.type)}</span>
                <h2 class="room-title">${this.getRoomTitle(room.type)}</h2>
                <span class="room-level">Level ${room.level}</span>
            </div>
            <p class="room-description">${room.description}</p>
        `;

        // Show interactables
        const interactables = room.getAvailableInteractables();
        if (interactables.length > 0) {
            const interactablesDiv = document.createElement('div');
            interactablesDiv.className = 'room-interactables';
            interactablesDiv.innerHTML = `
                <h3>Objects</h3>
                <div class="interactable-list">
                    ${interactables.map(i => `
                        <div class="interactable-item">
                            <span class="interactable-icon">${this.getInteractableIcon(i.type)}</span>
                            <span class="interactable-name">${i.name}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            view.appendChild(interactablesDiv);
        }

        // Show connected rooms
        const connectedRooms = this.getConnectedRooms(state, room);
        if (connectedRooms.length > 0) {
            const connectionsDiv = document.createElement('div');
            connectionsDiv.className = 'room-connections';
            connectionsDiv.innerHTML = `
                <h3>Paths</h3>
                <div class="connection-list">
                    ${connectedRooms.map(r => `
                        <div class="connection-item ${r.canEnter() ? 'available' : 'locked'}">
                            <span class="connection-icon">${this.getRoomIcon(r.type)}</span>
                            <span class="connection-name">${this.getRoomTitle(r.type)}</span>
                            <span class="connection-status">${r.state}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            view.appendChild(connectionsDiv);
        }

        return view;
    }

    /**
     * Creates the event view showing the mysterious event.
     */
    private createEventView(state: GameState, room: Room): HTMLElement {
        const view = document.createElement('div');
        view.className = 'event-view';

        const event = room.event;
        if (!event) {
            view.innerHTML = '<p>No event</p>';
            return view;
        }

        const outcome = event.outcome;
        const outcomeClass = outcome.isPositive ? 'positive' : 'negative';

        view.innerHTML = `
            <div class="event-container">
                <div class="event-header">
                    <span class="event-icon">${this.getEventIcon(outcome.type)}</span>
                    <h2 class="event-title">${event.title}</h2>
                </div>
                
                <div class="event-description">
                    <p>${event.description}</p>
                </div>
                
                <div class="event-outcome ${outcomeClass}">
                    <div class="outcome-icon">${outcome.isPositive ? '✨' : '💀'}</div>
                    <div class="outcome-details">
                        <h3 class="outcome-name">${outcome.name}</h3>
                        <p class="outcome-description">${outcome.description}</p>
                        ${this.getOutcomeDetails(outcome)}
                    </div>
                </div>
                
                <div class="event-hint">
                    <p>Click "Accept Your Fate" to continue...</p>
                </div>
            </div>
        `;

        return view;
    }

    /**
     * Gets the icon for an event outcome type.
     */
    private getEventIcon(type: string): string {
        const icons: Record<string, string> = {
            'buff': '⬆️',
            'debuff': '⬇️',
            'weapon': '⚔️',
            'armor': '🛡️',
            'potion': '🧪',
            'gold': '💰',
            'heal': '💚',
            'damage': '💔',
        };
        return icons[type] || '❓';
    }

    /**
     * Gets detailed HTML for an event outcome.
     */
    private getOutcomeDetails(outcome: { type: string; statBonus?: object; duration?: number; item?: { name: string }; gold?: number; healthChange?: number }): string {
        switch (outcome.type) {
            case 'buff':
            case 'debuff':
                if (outcome.statBonus) {
                    const stats = Object.entries(outcome.statBonus)
                        .map(([stat, value]) => `<span class="stat-change ${value > 0 ? 'positive' : 'negative'}">${value > 0 ? '+' : ''}${value} ${stat}</span>`)
                        .join(', ');
                    return `<div class="outcome-stats">${stats} for ${outcome.duration} turns</div>`;
                }
                return '';
            case 'weapon':
            case 'armor':
            case 'potion':
                return outcome.item ? `<div class="outcome-item">Received: ${outcome.item.name}</div>` : '';
            case 'gold':
                return outcome.gold ? `<div class="outcome-gold">+${outcome.gold} gold</div>` : '';
            case 'heal':
                return outcome.healthChange ? `<div class="outcome-heal">Heals ${Math.floor(outcome.healthChange * 100)}% of max HP</div>` : '';
            case 'damage':
                return outcome.healthChange ? `<div class="outcome-damage">Deals ${Math.floor(Math.abs(outcome.healthChange) * 100)}% of max HP</div>` : '';
            default:
                return '';
        }
    }

    /**
     * Creates the puzzle view showing the puzzle challenge.
     */
    private createPuzzleView(state: GameState, room: Room): HTMLElement {
        const view = document.createElement('div');
        view.className = 'puzzle-view';

        const puzzle = room.puzzle;
        if (!puzzle) {
            view.innerHTML = '<p>No puzzle here</p>';
            return view;
        }

        const attemptsLeft = puzzle.maxAttempts - puzzle.attempts;
        const attemptsClass = attemptsLeft <= 1 ? 'attempts-critical' : attemptsLeft <= 2 ? 'attempts-warning' : '';

        view.innerHTML = `
            <div class="puzzle-header">
                <span class="puzzle-icon">${this.getPuzzleIcon(puzzle.type)}</span>
                <h2 class="puzzle-title">${puzzle.title}</h2>
            </div>
            <div class="puzzle-attempts ${attemptsClass}">
                <span>Attempts remaining: ${attemptsLeft}</span>
            </div>
            <div class="puzzle-question">
                <p>${puzzle.question}</p>
            </div>
            <div class="puzzle-options">
                ${puzzle.options.map((option, index) => `
                    <button class="puzzle-option" 
                            data-action="puzzle_answer" 
                            data-answer-index="${index}">
                        ${option}
                    </button>
                `).join('')}
            </div>
            <div class="puzzle-actions">
                <button class="skip-puzzle-btn" data-action="skip_puzzle">
                    Skip Puzzle (forfeit rewards)
                </button>
            </div>
        `;

        // Add click handlers
        view.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            
            if (action === 'puzzle_answer' && this.actionResolver) {
                const answerIndex = parseInt(target.dataset.answerIndex || '0', 10);
                this.actionResolver({ type: 'puzzle_answer', answerIndex });
            } else if (action === 'skip_puzzle' && this.actionResolver) {
                this.actionResolver({ type: 'skip_puzzle' });
            }
        });

        return view;
    }

    /**
     * Gets the icon for a puzzle type.
     */
    private getPuzzleIcon(type: string): string {
        switch (type) {
            case 'riddle': return '🧩';
            case 'sequence': return '🔮';
            case 'math': return '🔢';
            default: return '❓';
        }
    }

    /**
     * Creates the treasure room view showing interactable objects.
     */
    private createTreasureView(state: GameState, room: Room | null): HTMLElement {
        const view = document.createElement('div');
        view.className = 'treasure-view';

        if (!room) {
            view.innerHTML = '<p>No room</p>';
            return view;
        }

        const unusedInteractables = room.interactables.filter(i => !i.used);
        const hasUnopened = unusedInteractables.length > 0;

        view.innerHTML = `
            <div class="treasure-header">
                <span class="treasure-icon">💎</span>
                <h2 class="treasure-title">Treasure Chamber</h2>
            </div>
            <p class="treasure-description">${room.description || 'A room filled with glittering treasures...'}</p>
        `;

        if (hasUnopened) {
            const interactablesContainer = document.createElement('div');
            interactablesContainer.className = 'interactables-grid';

            room.interactables.forEach((interactable, index) => {
                const el = document.createElement('div');
                el.className = `interactable-card ${interactable.used ? 'used' : 'available'}`;
                el.innerHTML = `
                    <span class="interactable-icon">${this.getInteractableIcon(interactable.type)}</span>
                    <span class="interactable-name">${interactable.name}</span>
                    ${!interactable.used ? `
                        <button class="interact-btn" 
                                data-action="interact" 
                                data-index="${index}">
                            ${this.getInteractableAction(interactable.type)}
                        </button>
                    ` : '<span class="used-label">Used</span>'}
                `;
                interactablesContainer.appendChild(el);
            });

            view.appendChild(interactablesContainer);
        } else {
            view.innerHTML += '<p class="no-treasures">All treasures have been claimed.</p>';
        }

        // Leave button
        const leaveBtn = document.createElement('button');
        leaveBtn.className = 'leave-treasure-btn';
        leaveBtn.textContent = 'Leave Room';
        leaveBtn.dataset.action = 'leave';
        view.appendChild(leaveBtn);

        // Add click handlers
        view.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            
            if (action === 'interact' && this.actionResolver) {
                const index = parseInt(target.dataset.index || '0', 10);
                this.actionResolver({ type: 'interact', interactableIndex: index });
            } else if (action === 'leave' && this.actionResolver) {
                this.actionResolver({ type: 'leave' });
            }
        });

        return view;
    }

    /**
     * Gets the action verb for an interactable type.
     */
    private getInteractableAction(type: string): string {
        switch (type) {
            case 'chest': return 'Open';
            case 'trap': return 'Disarm';
            case 'altar': return 'Pray';
            case 'lever': return 'Pull';
            case 'npc': return 'Talk';
            default: return 'Interact';
        }
    }

    /**
     * Creates the shop view showing items for sale and player inventory.
     */
    private createShopView(state: GameState, room: Room): HTMLElement {
        const view = document.createElement('div');
        view.className = 'shop-view';

        const player = state.player;
        if (!player || !room.shopInventory) {
            view.innerHTML = '<p>Shop not available</p>';
            return view;
        }

        view.innerHTML = `
            <div class="shop-header">
                <span class="shop-icon">🏪</span>
                <h2 class="shop-title">Merchant's Wares</h2>
                <div class="player-gold">
                    <span class="gold-icon">G</span>
                    <span class="gold-amount">${player.gold}</span>
                </div>
            </div>
            <p class="shop-description">"Welcome, adventurer! Browse my finest goods..."</p>
        `;

        const shopContent = document.createElement('div');
        shopContent.className = 'shop-content';

        // Items for sale section
        const forSaleSection = document.createElement('div');
        forSaleSection.className = 'shop-section for-sale';
        forSaleSection.innerHTML = `<h3>For Sale</h3>`;

        const forSaleGrid = document.createElement('div');
        forSaleGrid.className = 'shop-grid';

        if (room.shopInventory.length === 0) {
            forSaleGrid.innerHTML = '<p class="empty-shop">Sold out!</p>';
        } else {
            room.shopInventory.forEach(shopItem => {
                const canAfford = player.gold >= shopItem.buyPrice;
                const itemImg = getItemImage(shopItem.item.type, shopItem.item.rarity, 48);
                const itemEl = document.createElement('div');
                itemEl.className = `shop-item ${canAfford ? 'affordable' : 'too-expensive'} item-${shopItem.item.type.toLowerCase()} rarity-${shopItem.item.rarity.toLowerCase()}`;
                itemEl.innerHTML = `
                    <img src="${itemImg}" alt="${shopItem.item.name}" class="shop-item-image" />
                    <div class="item-info">
                        <span class="item-name">${shopItem.item.name}</span>
                        <span class="item-type">${shopItem.item.type}</span>
                        ${shopItem.item.description ? `<span class="item-desc">${shopItem.item.description}</span>` : ''}
                    </div>
                    <div class="item-price">
                        <span class="price-amount">${shopItem.buyPrice}</span>
                        <span class="price-label">gold</span>
                    </div>
                    <button class="buy-btn ${canAfford ? '' : 'disabled'}" 
                            data-action="buy_item" 
                            data-item-id="${shopItem.item.id}"
                            ${canAfford ? '' : 'disabled'}>
                        ${canAfford ? 'Buy' : 'Cannot Afford'}
                    </button>
                `;
                forSaleGrid.appendChild(itemEl);
            });
        }

        forSaleSection.appendChild(forSaleGrid);
        shopContent.appendChild(forSaleSection);

        // Player inventory for selling
        const sellSection = document.createElement('div');
        sellSection.className = 'shop-section for-sell';
        sellSection.innerHTML = `<h3>Your Items</h3>`;

        const sellGrid = document.createElement('div');
        sellGrid.className = 'shop-grid';

        if (player.inventory.length === 0) {
            sellGrid.innerHTML = '<p class="empty-inventory">No items to sell</p>';
        } else {
            player.inventory.forEach(item => {
                const sellPrice = Math.floor(item.value * 0.5);
                const itemImg = getItemImage(item.type, item.rarity, 48);
                const itemEl = document.createElement('div');
                itemEl.className = `shop-item sellable item-${item.type.toLowerCase()} rarity-${item.rarity.toLowerCase()}`;
                itemEl.innerHTML = `
                    <img src="${itemImg}" alt="${item.name}" class="shop-item-image" />
                    <div class="item-info">
                        <span class="item-name">${item.name}</span>
                        <span class="item-type">${item.type}</span>
                    </div>
                    <div class="item-price sell-price">
                        <span class="price-amount">${sellPrice}</span>
                        <span class="price-label">gold</span>
                    </div>
                    <button class="sell-btn" 
                            data-action="sell_item" 
                            data-item-id="${item.id}">
                        Sell
                    </button>
                `;
                sellGrid.appendChild(itemEl);
            });
        }

        sellSection.appendChild(sellGrid);
        shopContent.appendChild(sellSection);

        view.appendChild(shopContent);

        // Add click handlers for buy/sell buttons
        view.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            const itemId = target.dataset.itemId;

            if (action && itemId && this.actionResolver) {
                this.actionResolver({ type: action, itemId });
            }
        });

        return view;
    }

    /**
     * Creates the combat view showing enemies and combat state.
     */
    private createCombatView(state: GameState, room: Room | null): HTMLElement {
        const view = document.createElement('div');
        view.className = 'combat-view';

        if (!room || !room.enemies) {
            view.innerHTML = '<p>No enemies</p>';
            return view;
        }

        view.innerHTML = `
            <div class="combat-header">
                <h2>Combat!</h2>
            </div>
        `;

        // Enemy list
        const enemiesDiv = document.createElement('div');
        enemiesDiv.className = 'enemies-list';

        room.enemies.forEach((enemy, index) => {
            const enemyCard = document.createElement('div');
            enemyCard.className = `enemy-card ${enemy.health <= 0 ? 'defeated' : ''}`;
            enemyCard.dataset.enemyId = enemy.id;

            const hpPercent = (enemy.health / enemy.maxHealth) * 100;
            // Use API image if available, otherwise use placeholder SVG
            const placeholderImage = getMonsterImage(enemy.type, enemy.name, 120);
            const enemyImage = enemy.imageUrl || placeholderImage;
            
            enemyCard.innerHTML = `
                <img src="${enemyImage}" 
                     alt="${enemy.name}" 
                     class="enemy-image ${enemy.imageUrl ? 'api-image' : 'placeholder-image'}"
                     onerror="this.src='${placeholderImage}'; this.classList.remove('api-image'); this.classList.add('placeholder-image');" />
                <div class="enemy-header">
                    <span class="enemy-name">${enemy.name}</span>
                    <span class="enemy-cr">CR ${enemy.challengeRating}</span>
                </div>
                <div class="enemy-hp-bar">
                    <div class="enemy-hp-fill" style="width: ${hpPercent}%"></div>
                    <span class="enemy-hp-text">${enemy.health}/${enemy.maxHealth}</span>
                </div>
                <div class="enemy-stats">
                    <span>ATK<br/>${enemy.attackPower}</span>
                    <span>DEF<br/>${enemy.defense}</span>
                </div>
            `;

            enemiesDiv.appendChild(enemyCard);
        });

        view.appendChild(enemiesDiv);

        return view;
    }

    /**
     * Renders action buttons in the action area.
     */
    private renderActionButtons(actions: Action[]): void {
        const actionArea = this.container.querySelector('#action-area');
        if (!actionArea) return;

        actionArea.innerHTML = '<h3>Actions</h3>';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'action-buttons';

        actions.forEach((action, index) => {
            const button = document.createElement('button');
            button.className = `action-btn action-${action.type}`;
            button.innerHTML = `
                <span class="action-key">${index + 1}</span>
                <span class="action-label">${this.getActionLabel(action)}</span>
            `;
            
            button.addEventListener('click', () => {
                if (this.actionResolver) {
                    this.actionResolver(action);
                    this.actionResolver = null;
                }
            });

            buttonContainer.appendChild(button);
        });

        actionArea.appendChild(buttonContainer);
    }

    /**
     * Renders target selection overlay for combat.
     */
    private renderTargetSelection(validTargets: string[]): void {
        const state = this.getState();
        const room = this.getCurrentRoom(state);
        if (!room || !room.enemies) return;

        const overlay = document.createElement('div');
        overlay.className = 'target-overlay';
        overlay.innerHTML = '<h3>Select Target</h3>';

        const targetList = document.createElement('div');
        targetList.className = 'target-list';

        validTargets.forEach(targetId => {
            const enemy = room.enemies?.find(e => e.id === targetId);
            if (!enemy) return;

            const targetBtn = document.createElement('button');
            targetBtn.className = 'target-btn';
            targetBtn.innerHTML = `
                <span class="target-name">${enemy.name}</span>
                <span class="target-hp">${enemy.health}/${enemy.maxHealth} HP</span>
            `;

            targetBtn.addEventListener('click', () => {
                if (this.targetResolver) {
                    this.targetResolver(targetId);
                    this.targetResolver = null;
                    overlay.remove();
                }
            });

            targetList.appendChild(targetBtn);
        });

        overlay.appendChild(targetList);
        this.container.appendChild(overlay);
    }

    /**
     * Displays available actions (called by base GameLoop).
     */
    protected displayActions(actions: Action[]): void {
        // Actions are rendered in getPlayerInput
    }

    /**
     * Displays the result of an action with formatted names.
     */
    protected displayResult(result: ActionResult): void {
        if (result.message) {
            // Format the message based on action type
            let formattedMessage = result.message;
            
            // Format item names in messages
            if (result.result?.item) {
                const item = result.result.item;
                const itemName = this.formatItemName(item.name, item.rarity);
                formattedMessage = formattedMessage.replace(item.name, itemName);
            }
            
            // Format gold amounts
            if (result.result?.gold !== undefined) {
                const goldAmount = Math.abs(result.result.gold);
                formattedMessage = formattedMessage.replace(
                    new RegExp(`${goldAmount}\\s*gold`, 'gi'),
                    `${this.formatName(goldAmount.toString(), 'gold')} gold`
                );
            }
            
            // Format specific action types
            switch (result.type) {
                case 'item_bought':
                case 'item_sold':
                case 'item_equipped':
                case 'item_unequipped':
                case 'item_used':
                    // Already formatted above
                    break;
                case 'rested':
                    formattedMessage = `${this.formatName('Rested', 'heal')}: ${result.message}`;
                    break;
                case 'flee':
                    if (result.success) {
                        formattedMessage = `${this.formatName('Escaped!', 'heal')} You fled from combat.`;
                    } else {
                        formattedMessage = `${this.formatName('Failed to escape!', 'damage')} The enemies block your path.`;
                    }
                    break;
                case 'moved':
                    formattedMessage = `Entered a new ${this.formatName('room', 'room')}.`;
                    break;
                case 'interacted':
                    // Interaction results are already descriptive
                    break;
                case 'event':
                    // Format event messages with appropriate styling
                    formattedMessage = this.formatEventMessage(result.message);
                    break;
            }
            
            this.addLogMessage(formattedMessage);
        }

        // Re-render to show updated state
        const state = this.getState();
        this.render(state);
    }

    /**
     * Displays current combat state.
     */
    protected displayCombatState(): void {
        const state = this.getState();
        this.render(state);
    }

    /**
     * Displays status effect messages.
     */
    protected displayStatusEffectMessages(messages: string[]): void {
        messages.forEach(msg => this.addLogMessage(msg));
    }

    /**
     * Displays attack result with formatted names.
     */
    protected displayAttackResult(result: AttackResult): void {
        const { attacker, defender, attackRoll, damage, defenderDied } = result;

        // Determine if attacker is player or enemy
        const attackerType = 'id' in attacker && typeof attacker.id === 'string' && attacker.id.includes('-') ? 'enemy' : 'player';
        const defenderType = attackerType === 'player' ? 'enemy' : 'player';

        const attackerName = this.formatName(attacker.name, attackerType as 'player' | 'enemy');
        const defenderName = this.formatName(defender.name, defenderType as 'player' | 'enemy');

        let message = `${attackerName} attacks ${defenderName}`;

        if (attackRoll.isNatural20) {
            message += ` - ${this.formatName('CRITICAL HIT!', 'crit')}`;
        } else if (attackRoll.isNatural1) {
            message += ` - ${this.formatName('Miss!', 'miss')}`;
        } else if (!attackRoll.isHit) {
            message += ` - ${this.formatName('Miss', 'miss')} (${attackRoll.total} vs ${attackRoll.targetDefense})`;
        }

        if (damage) {
            message += ` for ${this.formatName(damage.finalDamage.toString(), 'damage')} damage`;
            if (damage.isCritical) {
                message += ` ${this.formatName('(crit!)', 'crit')}`;
            }
        }

        if (defenderDied) {
            message += ` - ${defenderName} ${this.formatName('defeated!', 'crit')}`;
        }

        this.addLogMessage(message);

        // Re-render to show updated HP
        const state = this.getState();
        this.render(state);
    }

    /**
     * Displays ability result with formatted names.
     */
    protected displayAbilityResult(result: AbilityResult): void {
        const abilityName = this.formatName(result.abilityName, 'ability');
        let message = result.message;

        // Add additional context for different ability types
        if (result.healing) {
            message = `${abilityName}: Healed for ${this.formatName(result.healing.toString(), 'heal')} HP`;
        } else if (result.damage) {
            if (result.isAoe) {
                message = `${abilityName}: Dealt ${this.formatName(result.damage.toString(), 'damage')} total damage to all enemies!`;
            } else {
                message = `${abilityName}: Dealt ${this.formatName(result.damage.toString(), 'damage')} damage`;
            }
        }

        if (result.effectApplied) {
            message += ` [${this.formatName(result.effectApplied, 'ability')}]`;
        }

        if (result.enemiesKilled.length > 0) {
            const count = result.enemiesKilled.length;
            message += ` - ${this.formatName(count.toString(), 'damage')} ${count === 1 ? 'enemy' : 'enemies'} ${this.formatName('defeated!', 'crit')}`;
        }

        this.addLogMessage(message);

        // Re-render to show updated state
        const state = this.getState();
        this.render(state);
    }

    /**
     * Displays room completion rewards.
     */
    protected displayRoomRewards(rewards: { gold: number; experience: number; items: Item[]; healthRestore?: number }): void {
        // Victory message
        this.addLogMessage(`${this.formatName('Victory!', 'crit')} You cleared the room!`);

        // Gold reward
        if (rewards.gold > 0) {
            this.addLogMessage(`Received ${this.formatName(rewards.gold.toString(), 'gold')} gold`);
        }

        // Experience reward
        if (rewards.experience > 0) {
            this.addLogMessage(`Gained ${this.formatName(rewards.experience.toString(), 'ability')} XP`);
        }

        // Item rewards - list each item with rarity color
        if (rewards.items.length > 0) {
            const itemList = rewards.items.map(item => this.formatItemName(item.name, item.rarity)).join(', ');
            this.addLogMessage(`Found: ${itemList}`);
        }

        // Health restore (from rest rooms)
        if (rewards.healthRestore && rewards.healthRestore > 0) {
            this.addLogMessage(`Restored ${this.formatName(rewards.healthRestore.toString(), 'heal')} HP`);
        }

        // Re-render to show updated state
        const state = this.getState();
        this.render(state);
    }

    /**
     * Handles game over state.
     */
    protected handleGameOver(): void {
        super.handleGameOver();
        this.showEndScreen('Game Over', 'You have been defeated...');
    }

    /**
     * Handles victory state.
     */
    protected handleVictory(): void {
        super.handleVictory();
        this.showEndScreen('Victory!', 'You have conquered the dungeon!');
    }

    /**
     * Shows the end game screen.
     */
    private showEndScreen(title: string, message: string): void {
        const state = this.getState();
        
        this.container.innerHTML = `
            <div class="end-screen">
                <h1 class="end-title">${title}</h1>
                <p class="end-message">${message}</p>
                
                <div class="end-stats">
                    <h3>Final Stats</h3>
                    <div class="stat-row">
                        <span>Rooms Cleared:</span>
                        <span>${state.stats.roomsCleared}</span>
                    </div>
                    <div class="stat-row">
                        <span>Enemies Defeated:</span>
                        <span>${state.stats.enemiesDefeated}</span>
                    </div>
                    <div class="stat-row">
                        <span>Gold Collected:</span>
                        <span>${state.stats.goldCollected}</span>
                    </div>
                    <div class="stat-row">
                        <span>Items Found:</span>
                        <span>${state.stats.itemsFound}</span>
                    </div>
                </div>
                
                <button class="restart-btn" onclick="location.reload()">Play Again</button>
            </div>
        `;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Gets the current room from game state.
     */
    private getCurrentRoom(state: GameState): Room | null {
        if (!state.dungeon.currentRoomId) return null;
        return state.dungeon.rooms.get(state.dungeon.currentRoomId) ?? null;
    }

    /**
     * Gets rooms connected to the given room.
     */
    private getConnectedRooms(state: GameState, room: Room): Room[] {
        return room.connections
            .map(id => state.dungeon.rooms.get(id))
            .filter((r): r is Room => r !== undefined);
    }

    /**
     * Adds a message to the log.
     */
    private addLogMessage(message: string): void {
        this.messageLog.push(message);
        if (this.messageLog.length > MAX_LOG_MESSAGES) {
            this.messageLog.shift();
        }
    }

    /**
     * Gets icon for room type.
     */
    private getRoomIcon(type: RoomType): string {
        const icons: Record<RoomType, string> = {
            [RoomType.ENTRANCE]: '&#128682;',
            [RoomType.COMBAT]: '&#9876;',
            [RoomType.ELITE]: '&#128128;',
            [RoomType.BOSS]: '&#128123;',
            [RoomType.TREASURE]: '&#128176;',
            [RoomType.REST]: '&#128293;',
            [RoomType.SHOP]: '&#127978;',
            [RoomType.EVENT]: '&#10067;',
            [RoomType.PUZZLE]: '&#128273;'
        };
        return icons[type] || '?';
    }

    /**
     * Gets display title for room type.
     */
    private getRoomTitle(type: RoomType): string {
        const titles: Record<RoomType, string> = {
            [RoomType.ENTRANCE]: 'Dungeon Entrance',
            [RoomType.COMBAT]: 'Combat Room',
            [RoomType.ELITE]: 'Elite Encounter',
            [RoomType.BOSS]: 'Boss Chamber',
            [RoomType.TREASURE]: 'Treasure Room',
            [RoomType.REST]: 'Rest Area',
            [RoomType.SHOP]: 'Merchant',
            [RoomType.EVENT]: 'Mysterious Event',
            [RoomType.PUZZLE]: 'Puzzle Chamber'
        };
        return titles[type] || type;
    }

    /**
     * Gets icon for interactable type.
     */
    private getInteractableIcon(type: string): string {
        const icons: Record<string, string> = {
            'chest': '&#128230;',
            'trap': '&#9888;',
            'altar': '&#9962;',
            'lever': '&#128295;',
            'npc': '&#128100;'
        };
        return icons[type] || '?';
    }

    /**
     * Gets display label for an action.
     */
    private getActionLabel(action: Action): string {
        switch (action.type) {
            case 'move':
                return `Go to ${this.getRoomTitle(action.roomType!)}`;
            case 'interact':
                return `Interact: ${action.name}`;
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
            case 'leave_shop':
                return 'Leave';
            case 'open_inventory':
                return 'Inventory';
            case 'view_character':
                return 'Character';
            case 'restart':
                return 'Restart';
            case 'quit':
                return 'Quit';
            default:
                return action.type;
        }
    }
}

