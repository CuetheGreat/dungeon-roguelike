/**
 * @fileoverview Image Assets for Dungeon Roguelike
 * 
 * Provides placeholder SVG images for players, monsters, and items.
 * Uses data URIs so no external files are needed.
 * 
 * @module ui/imageAssets
 */

import { EnemyType } from '../entities/enemy';
import { ItemType, ItemRarity } from '../entities/item';

/**
 * Color schemes for different entity types
 */
const COLORS = {
    // Player class colors
    warrior: { primary: '#c0392b', secondary: '#e74c3c', accent: '#f39c12' },
    mage: { primary: '#8e44ad', secondary: '#9b59b6', accent: '#3498db' },
    rogue: { primary: '#27ae60', secondary: '#2ecc71', accent: '#1abc9c' },
    cleric: { primary: '#f1c40f', secondary: '#f39c12', accent: '#ecf0f1' },
    warlock: { primary: '#2c3e50', secondary: '#34495e', accent: '#9b59b6' },
    
    // Monster type colors
    aberration: { primary: '#6c3483', secondary: '#8e44ad', accent: '#e8daef' },
    beast: { primary: '#784212', secondary: '#a04000', accent: '#f5b041' },
    celestial: { primary: '#f4d03f', secondary: '#f7dc6f', accent: '#fcf3cf' },
    construct: { primary: '#566573', secondary: '#7f8c8d', accent: '#bdc3c7' },
    dragon: { primary: '#b03a2e', secondary: '#cb4335', accent: '#f9e79f' },
    elemental: { primary: '#2e86ab', secondary: '#17a2b8', accent: '#a2d9ce' },
    fey: { primary: '#76d7c4', secondary: '#48c9b0', accent: '#f5b7b1' },
    fiend: { primary: '#922b21', secondary: '#c0392b', accent: '#f1948a' },
    giant: { primary: '#5d6d7e', secondary: '#85929e', accent: '#d5dbdb' },
    humanoid: { primary: '#d4ac0d', secondary: '#f1c40f', accent: '#fdebd0' },
    monstrosity: { primary: '#1e8449', secondary: '#28b463', accent: '#abebc6' },
    ooze: { primary: '#239b56', secondary: '#58d68d', accent: '#abebc6' },
    plant: { primary: '#196f3d', secondary: '#27ae60', accent: '#82e0aa' },
    undead: { primary: '#1c2833', secondary: '#2c3e50', accent: '#85929e' },
    
    // Item rarity colors
    common: { primary: '#95a5a6', secondary: '#bdc3c7', accent: '#ecf0f1' },
    uncommon: { primary: '#27ae60', secondary: '#2ecc71', accent: '#82e0aa' },
    rare: { primary: '#2980b9', secondary: '#3498db', accent: '#85c1e9' },
    veryRare: { primary: '#8e44ad', secondary: '#9b59b6', accent: '#d7bde2' },
    legendary: { primary: '#d35400', secondary: '#e67e22', accent: '#f9e79f' },
};

/**
 * Generates an SVG placeholder for a player character.
 * 
 * @param className - The player's class name
 * @param size - Image size in pixels (default 64)
 * @returns Data URI for the SVG image
 */
export function getPlayerImage(className: string, size: number = 64): string {
    const normalizedClass = className.toLowerCase();
    const colors = COLORS[normalizedClass as keyof typeof COLORS] || COLORS.warrior;
    
    // Different silhouettes based on class
    let silhouette: string;
    switch (normalizedClass) {
        case 'mage':
            // Robed figure with staff
            silhouette = `
                <circle cx="32" cy="16" r="8" fill="${colors.secondary}"/>
                <path d="M24 24 L20 56 L28 56 L30 40 L34 40 L36 56 L44 56 L40 24 Z" fill="${colors.primary}"/>
                <line x1="44" y1="20" x2="52" y2="8" stroke="${colors.accent}" stroke-width="3"/>
                <circle cx="52" cy="6" r="4" fill="${colors.accent}"/>
            `;
            break;
        case 'rogue':
            // Hooded figure with daggers
            silhouette = `
                <path d="M26 8 L32 4 L38 8 L36 18 L28 18 Z" fill="${colors.secondary}"/>
                <circle cx="32" cy="14" r="6" fill="${colors.secondary}"/>
                <path d="M24 20 L20 54 L28 54 L30 36 L34 36 L36 54 L44 54 L40 20 Z" fill="${colors.primary}"/>
                <path d="M16 30 L12 42 L18 40 Z" fill="${colors.accent}"/>
                <path d="M48 30 L52 42 L46 40 Z" fill="${colors.accent}"/>
            `;
            break;
        case 'cleric':
            // Robed figure with holy symbol
            silhouette = `
                <circle cx="32" cy="14" r="8" fill="${colors.secondary}"/>
                <path d="M22 22 L18 56 L28 56 L30 38 L34 38 L36 56 L46 56 L42 22 Z" fill="${colors.primary}"/>
                <rect x="29" y="26" width="6" height="14" fill="${colors.accent}"/>
                <rect x="26" y="30" width="12" height="4" fill="${colors.accent}"/>
            `;
            break;
        case 'warlock':
            // Dark robed figure with eldritch energy
            silhouette = `
                <circle cx="32" cy="14" r="8" fill="${colors.secondary}"/>
                <path d="M22 22 L18 58 L46 58 L42 22 Z" fill="${colors.primary}"/>
                <ellipse cx="32" cy="38" rx="6" ry="8" fill="${colors.accent}" opacity="0.7"/>
                <circle cx="32" cy="38" r="3" fill="${colors.accent}"/>
            `;
            break;
        default: // Warrior
            // Armored figure with sword
            silhouette = `
                <circle cx="32" cy="14" r="8" fill="${colors.secondary}"/>
                <rect x="24" y="22" width="16" height="20" fill="${colors.primary}" rx="2"/>
                <rect x="22" y="42" width="8" height="14" fill="${colors.primary}"/>
                <rect x="34" y="42" width="8" height="14" fill="${colors.primary}"/>
                <rect x="46" y="16" width="4" height="28" fill="${colors.accent}"/>
                <rect x="44" y="14" width="8" height="4" fill="${colors.accent}"/>
            `;
    }
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
            <rect width="64" height="64" fill="#1a1a2e" rx="8"/>
            ${silhouette}
        </svg>
    `.trim();
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generates an SVG placeholder for a monster.
 * 
 * @param monsterType - The monster's type (from EnemyType enum)
 * @param name - The monster's name (for display)
 * @param size - Image size in pixels (default 64)
 * @returns Data URI for the SVG image
 */
export function getMonsterImage(monsterType: EnemyType | string, name: string, size: number = 64): string {
    const normalizedType = monsterType.toLowerCase();
    const colorKey = normalizedType as keyof typeof COLORS;
    const colors = COLORS[colorKey] || COLORS.humanoid;
    
    // Different shapes based on monster type
    let shape: string;
    switch (normalizedType) {
        case 'aberration':
            // Tentacled horror
            shape = `
                <ellipse cx="32" cy="28" rx="16" ry="12" fill="${colors.primary}"/>
                <circle cx="32" cy="26" r="6" fill="${colors.accent}"/>
                <circle cx="32" cy="26" r="3" fill="#1a1a2e"/>
                <path d="M18 36 Q12 48 8 52" stroke="${colors.secondary}" stroke-width="4" fill="none"/>
                <path d="M26 38 Q22 50 18 56" stroke="${colors.secondary}" stroke-width="4" fill="none"/>
                <path d="M38 38 Q42 50 46 56" stroke="${colors.secondary}" stroke-width="4" fill="none"/>
                <path d="M46 36 Q52 48 56 52" stroke="${colors.secondary}" stroke-width="4" fill="none"/>
            `;
            break;
        case 'beast':
            // Four-legged creature
            shape = `
                <ellipse cx="32" cy="28" rx="18" ry="10" fill="${colors.primary}"/>
                <circle cx="46" cy="22" r="8" fill="${colors.primary}"/>
                <circle cx="48" cy="20" r="2" fill="${colors.accent}"/>
                <rect x="14" y="34" width="6" height="16" fill="${colors.secondary}" rx="2"/>
                <rect x="24" y="34" width="6" height="16" fill="${colors.secondary}" rx="2"/>
                <rect x="34" y="34" width="6" height="16" fill="${colors.secondary}" rx="2"/>
                <rect x="44" y="34" width="6" height="16" fill="${colors.secondary}" rx="2"/>
            `;
            break;
        case 'dragon':
            // Dragon head with wings
            shape = `
                <path d="M8 20 L32 8 L56 20 L32 32 Z" fill="${colors.secondary}" opacity="0.7"/>
                <ellipse cx="32" cy="36" rx="14" ry="10" fill="${colors.primary}"/>
                <path d="M18 36 L8 44 L18 42 Z" fill="${colors.primary}"/>
                <circle cx="26" cy="34" r="3" fill="${colors.accent}"/>
                <circle cx="38" cy="34" r="3" fill="${colors.accent}"/>
                <path d="M28 44 L32 52 L36 44" stroke="${colors.accent}" stroke-width="2" fill="none"/>
            `;
            break;
        case 'undead':
            // Skull with glowing eyes
            shape = `
                <ellipse cx="32" cy="28" rx="14" ry="16" fill="${colors.secondary}"/>
                <ellipse cx="26" cy="26" rx="4" ry="5" fill="#1a1a2e"/>
                <ellipse cx="38" cy="26" rx="4" ry="5" fill="#1a1a2e"/>
                <circle cx="26" cy="26" r="2" fill="${colors.accent}"/>
                <circle cx="38" cy="26" r="2" fill="${colors.accent}"/>
                <path d="M26 40 L28 44 L30 40 L32 44 L34 40 L36 44 L38 40" stroke="#1a1a2e" stroke-width="2" fill="none"/>
                <ellipse cx="32" cy="34" rx="2" ry="3" fill="#1a1a2e"/>
            `;
            break;
        case 'fiend':
            // Demonic figure with horns
            shape = `
                <path d="M20 16 L24 28 L20 28 Z" fill="${colors.accent}"/>
                <path d="M44 16 L40 28 L44 28 Z" fill="${colors.accent}"/>
                <ellipse cx="32" cy="32" rx="12" ry="14" fill="${colors.primary}"/>
                <circle cx="27" cy="30" r="3" fill="${colors.accent}"/>
                <circle cx="37" cy="30" r="3" fill="${colors.accent}"/>
                <path d="M26 40 Q32 46 38 40" stroke="${colors.secondary}" stroke-width="2" fill="none"/>
            `;
            break;
        case 'elemental':
            // Swirling elemental form
            shape = `
                <circle cx="32" cy="32" r="18" fill="${colors.primary}" opacity="0.6"/>
                <circle cx="32" cy="32" r="12" fill="${colors.secondary}" opacity="0.7"/>
                <circle cx="32" cy="32" r="6" fill="${colors.accent}"/>
                <path d="M32 14 Q44 20 32 32 Q20 44 32 50" stroke="${colors.accent}" stroke-width="2" fill="none"/>
            `;
            break;
        case 'construct':
            // Mechanical/golem figure
            shape = `
                <rect x="22" y="16" width="20" height="14" fill="${colors.primary}" rx="2"/>
                <rect x="20" y="32" width="24" height="20" fill="${colors.secondary}" rx="2"/>
                <rect x="26" y="20" width="4" height="4" fill="${colors.accent}"/>
                <rect x="34" y="20" width="4" height="4" fill="${colors.accent}"/>
                <rect x="28" y="38" width="8" height="8" fill="${colors.primary}"/>
            `;
            break;
        case 'giant':
            // Large humanoid
            shape = `
                <circle cx="32" cy="16" r="10" fill="${colors.secondary}"/>
                <rect x="20" y="26" width="24" height="24" fill="${colors.primary}" rx="4"/>
                <rect x="12" y="28" width="8" height="18" fill="${colors.secondary}" rx="2"/>
                <rect x="44" y="28" width="8" height="18" fill="${colors.secondary}" rx="2"/>
                <circle cx="28" cy="14" r="2" fill="${colors.accent}"/>
                <circle cx="36" cy="14" r="2" fill="${colors.accent}"/>
            `;
            break;
        case 'ooze':
            // Amorphous blob
            shape = `
                <ellipse cx="32" cy="38" rx="22" ry="14" fill="${colors.primary}" opacity="0.8"/>
                <ellipse cx="28" cy="36" rx="14" ry="10" fill="${colors.secondary}" opacity="0.6"/>
                <circle cx="24" cy="34" r="3" fill="${colors.accent}"/>
                <circle cx="38" cy="38" r="2" fill="${colors.accent}"/>
            `;
            break;
        default: // humanoid and others
            // Generic humanoid
            shape = `
                <circle cx="32" cy="16" r="8" fill="${colors.secondary}"/>
                <rect x="24" y="24" width="16" height="18" fill="${colors.primary}" rx="2"/>
                <rect x="14" y="26" width="8" height="14" fill="${colors.secondary}" rx="2"/>
                <rect x="42" y="26" width="8" height="14" fill="${colors.secondary}" rx="2"/>
                <rect x="24" y="42" width="6" height="12" fill="${colors.secondary}" rx="2"/>
                <rect x="34" y="42" width="6" height="12" fill="${colors.secondary}" rx="2"/>
                <circle cx="28" cy="14" r="2" fill="${colors.accent}"/>
                <circle cx="36" cy="14" r="2" fill="${colors.accent}"/>
            `;
    }
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
            <rect width="64" height="64" fill="#1a1a2e" rx="8"/>
            ${shape}
        </svg>
    `.trim();
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generates an SVG placeholder for an item.
 * 
 * @param itemType - The item's type (from ItemType enum)
 * @param rarity - The item's rarity (from ItemRarity enum)
 * @param size - Image size in pixels (default 48)
 * @returns Data URI for the SVG image
 */
export function getItemImage(itemType: ItemType | string, rarity: ItemRarity | string = ItemRarity.COMMON, size: number = 48): string {
    const normalizedType = itemType.toLowerCase();
    const normalizedRarity = rarity.toLowerCase().replace('_', '');
    
    // Map rarity to color key
    let rarityKey: keyof typeof COLORS;
    switch (normalizedRarity) {
        case 'uncommon': rarityKey = 'uncommon'; break;
        case 'rare': rarityKey = 'rare'; break;
        case 'veryrare': rarityKey = 'veryRare'; break;
        case 'legendary': rarityKey = 'legendary'; break;
        default: rarityKey = 'common';
    }
    const colors = COLORS[rarityKey];
    
    // Different icons based on item type
    let icon: string;
    switch (normalizedType) {
        case 'weapon':
            // Sword
            icon = `
                <rect x="22" y="6" width="4" height="28" fill="${colors.primary}" rx="1"/>
                <rect x="16" y="32" width="16" height="4" fill="${colors.secondary}" rx="1"/>
                <rect x="22" y="36" width="4" height="10" fill="${colors.accent}" rx="1"/>
            `;
            break;
        case 'armor':
            // Chestplate
            icon = `
                <path d="M14 14 L24 8 L34 14 L34 36 L24 42 L14 36 Z" fill="${colors.primary}"/>
                <path d="M18 18 L24 14 L30 18 L30 30 L24 34 L18 30 Z" fill="${colors.secondary}"/>
                <circle cx="24" cy="24" r="3" fill="${colors.accent}"/>
            `;
            break;
        case 'accessory':
            // Ring
            icon = `
                <circle cx="24" cy="24" r="12" fill="none" stroke="${colors.primary}" stroke-width="6"/>
                <circle cx="24" cy="12" r="4" fill="${colors.accent}"/>
            `;
            break;
        case 'consumable':
            // Potion bottle
            icon = `
                <rect x="20" y="6" width="8" height="6" fill="${colors.secondary}" rx="1"/>
                <path d="M18 12 L14 38 Q14 44 24 44 Q34 44 34 38 L30 12 Z" fill="${colors.primary}"/>
                <ellipse cx="24" cy="30" rx="6" ry="8" fill="${colors.accent}" opacity="0.7"/>
            `;
            break;
        case 'treasure':
            // Gold coins
            icon = `
                <ellipse cx="20" cy="28" rx="10" ry="6" fill="${colors.accent}"/>
                <ellipse cx="28" cy="24" rx="10" ry="6" fill="${colors.primary}"/>
                <ellipse cx="24" cy="20" rx="10" ry="6" fill="${colors.secondary}"/>
                <text x="24" y="24" font-size="8" fill="${colors.accent}" text-anchor="middle">G</text>
            `;
            break;
        default:
            // Generic item (box)
            icon = `
                <rect x="10" y="14" width="28" height="24" fill="${colors.primary}" rx="2"/>
                <rect x="14" y="18" width="20" height="16" fill="${colors.secondary}" rx="1"/>
                <text x="24" y="30" font-size="10" fill="${colors.accent}" text-anchor="middle">?</text>
            `;
    }
    
    // Add rarity glow for rare+ items
    let glow = '';
    if (normalizedRarity !== 'common') {
        glow = `<rect width="48" height="48" fill="none" stroke="${colors.accent}" stroke-width="2" rx="6" opacity="0.6"/>`;
    }
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
            <rect width="48" height="48" fill="#16213e" rx="6"/>
            ${glow}
            ${icon}
        </svg>
    `.trim();
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Gets a fallback/default image for any entity type.
 * 
 * @param size - Image size in pixels (default 64)
 * @returns Data URI for a generic placeholder SVG
 */
export function getPlaceholderImage(size: number = 64): string {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
            <rect width="64" height="64" fill="#1a1a2e" rx="8"/>
            <circle cx="32" cy="28" r="12" fill="#34495e"/>
            <rect x="20" y="42" width="24" height="4" fill="#34495e" rx="2"/>
        </svg>
    `.trim();
    
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

