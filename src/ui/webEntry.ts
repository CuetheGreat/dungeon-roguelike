/**
 * @fileoverview Web Entry Point for Dungeon Roguelike
 * 
 * This module initializes the web-based game UI, handling:
 * - Character selection screen
 * - Game initialization
 * - Starting the WebGameLoop
 * 
 * @module ui/webEntry
 */

import { WebGameLoop } from './WebGameLoop';
import { Fighter } from '../entities/fighter';
import { Warlock } from '../entities/warlock';
import { Player } from '../entities/player';

/**
 * Main entry point for the web game.
 * Sets up event listeners and initializes the game when ready.
 */
function initializeGame(): void {
    const characterSelect = document.getElementById('character-select');
    const loadingScreen = document.getElementById('loading-screen');
    const gameScreen = document.getElementById('game-screen');
    const startButton = document.getElementById('start-game') as HTMLButtonElement;
    const nameInput = document.getElementById('player-name') as HTMLInputElement;
    const seedInput = document.getElementById('game-seed') as HTMLInputElement;
    const classCards = document.querySelectorAll('.class-card');

    let selectedClass: 'fighter' | 'warlock' | null = null;

    // Class selection handler
    function selectClass(card: Element): void {
        // Remove selection from all cards
        classCards.forEach(c => c.classList.remove('selected'));
        // Add selection to clicked card
        card.classList.add('selected');
        selectedClass = card.getAttribute('data-class') as 'fighter' | 'warlock';
        updateStartButton();
    }

    // Class selection - click and keyboard support
    classCards.forEach(card => {
        card.addEventListener('click', () => selectClass(card));
        card.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
                e.preventDefault();
                selectClass(card);
            }
        });
    });

    // Name input validation
    nameInput.addEventListener('input', updateStartButton);

    function updateStartButton(): void {
        const hasName = nameInput.value.trim().length > 0;
        const hasClass = selectedClass !== null;
        const shouldEnable = hasName && hasClass;
        console.log('updateStartButton:', { hasName, hasClass, shouldEnable, nameValue: nameInput.value, selectedClass });
        startButton.disabled = !shouldEnable;
    }

    // Start game button
    startButton.addEventListener('click', async () => {
        if (!selectedClass) return;

        const playerName = nameInput.value.trim() || 'Hero';
        const seed = seedInput.value.trim() || undefined;

        // Show loading screen
        characterSelect?.classList.add('hidden');
        loadingScreen?.classList.remove('hidden');

        try {
            // Create player based on selected class
            let player: Player;
            if (selectedClass === 'fighter') {
                player = new Fighter(playerName);
            } else {
                player = new Warlock(playerName);
            }

            // Small delay to show loading screen
            await new Promise(resolve => setTimeout(resolve, 500));

            // Hide loading, show game
            loadingScreen?.classList.add('hidden');
            gameScreen?.classList.remove('hidden');

            // Initialize and start the game
            const gameLoop = new WebGameLoop('game-screen');
            await gameLoop.startGame(player, seed);

        } catch (error) {
            console.error('Failed to start game:', error);
            loadingScreen?.classList.add('hidden');
            characterSelect?.classList.remove('hidden');
            alert('Failed to start game. Please try again.');
        }
    });

    // Set default name and trigger update
    nameInput.value = 'Hero';
    // Dispatch input event to ensure the button state is updated
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    updateStartButton();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

