/**
 * @fileoverview Main Entry Point for Dungeon Roguelike
 * 
 * This script generates a dungeon and displays its structure in the console.
 * Useful for testing and debugging dungeon generation.
 * 
 * Usage:
 * ```bash
 * npx tsx src/main.ts
 * ```
 * 
 * @module main
 */

import { DungeonGenerator } from './integration/dungeonGenerator';
import { Room, RoomType } from './dungeon/room';

// Generate dungeon with a fixed seed for reproducibility
const generator = new DungeonGenerator('turning_point');
const rooms = await generator.generate(20, 3, 0.3);
const layers = generator.getLayers();

console.log(`Generated ${rooms.length} rooms across ${layers.length} levels\n`);

// Create a map for quick room lookup
const roomMap = new Map<string, Room>(rooms.map(r => [r.id, r]));

/**
 * Room type abbreviations for compact display.
 * @const
 */
const typeAbbrev: Record<RoomType, string> = {
    [RoomType.ENTRANCE]: 'ENT',
    [RoomType.COMBAT]: 'CMB',
    [RoomType.ELITE]: 'ELT',
    [RoomType.BOSS]: 'BOS',
    [RoomType.TREASURE]: 'TRS',
    [RoomType.REST]: 'RST',
    [RoomType.SHOP]: 'SHP',
    [RoomType.EVENT]: 'EVT',
    [RoomType.PUZZLE]: 'PZL',
};

// Print each layer with room types and IDs
for (const layer of layers) {
    const levelLabel = `Level ${layer.level.toString().padStart(2, '0')}`;
    const roomLabels = layer.rooms.map(r => {
        const abbrev = typeAbbrev[r.type] || r.type.slice(0, 3).toUpperCase();
        return `[${abbrev}:${r.id.slice(0, 4)}]`;
    });
    console.log(`${levelLabel}: ${roomLabels.join('  ')}`);
}

console.log('\n--- Connections ---\n');

// Print connections for each room (forward connections only to avoid duplicates)
for (const layer of layers) {
    for (const room of layer.rooms) {
        const abbrev = typeAbbrev[room.type];
        const shortId = room.id.slice(0, 4);
        
        // Only show forward connections (to higher levels) to avoid duplicates
        const forwardConnections = room.connections
            .map(id => roomMap.get(id))
            .filter((r): r is Room => r !== undefined && r.level > room.level)
            .map(r => `${typeAbbrev[r.type]}:${r.id.slice(0, 4)}`)
            .join(', ');
        
        if (forwardConnections) {
            console.log(`${abbrev}:${shortId} (L${room.level}) -> ${forwardConnections}`);
        }
    }
}
