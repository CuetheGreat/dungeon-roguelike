/**
 * @fileoverview HTML Dungeon Map Generator
 * 
 * This script generates a dungeon and outputs it as an interactive HTML file.
 * The HTML file uses the dungeon-map.html template and injects the generated
 * dungeon data as a JavaScript object.
 * 
 * Usage:
 * ```bash
 * npx tsx src/generate-html.ts [seed]
 * ```
 * 
 * If no seed is provided, defaults to 'my_epic_seed'.
 * 
 * Output:
 * - Generates `public/dungeon-output.html` with the dungeon visualization
 * 
 * @module generate-html
 */

import { DungeonGenerator } from './integration/dungeonGenerator';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for file path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get seed from command line or use default
const seed = process.argv[2] || 'my_epic_seed';

console.log(`Generating dungeon with seed: ${seed}`);

// Generate the dungeon
const generator = new DungeonGenerator(seed);
const rooms = await generator.generate(20, 3, 0.3);
const layers = generator.getLayers();

/**
 * Serialized room data for JSON output.
 * Excludes complex objects like enemies for cleaner serialization.
 */
const serializedRooms = rooms.map(room => ({
    id: room.id,
    type: room.type,
    level: room.level,
    state: room.state,
    connections: room.connections,
    description: room.description,
}));

/**
 * Serialized layer data for JSON output.
 */
const serializedLayers = layers.map(layer => ({
    level: layer.level,
    rooms: layer.rooms.map(r => ({
        id: r.id,
        type: r.type,
        level: r.level,
        state: r.state,
        connections: r.connections,
        description: r.description,
    }))
}));

/**
 * Complete dungeon data object for injection into HTML.
 */
const dungeonData = {
    seed,
    rooms: serializedRooms,
    layers: serializedLayers,
};

// Read the HTML template
const templatePath = join(__dirname, '../public/dungeon-map.html');
let html = readFileSync(templatePath, 'utf-8');

// Inject the dungeon data as a script tag
const dataScript = `<script>window.DUNGEON_DATA = ${JSON.stringify(dungeonData, null, 2)};</script>`;
html = html.replace('</head>', `${dataScript}\n</head>`);

// Write the output file
const outputPath = join(__dirname, '../public/dungeon-output.html');
writeFileSync(outputPath, html);

console.log(`Generated ${rooms.length} rooms across ${layers.length} levels`);
console.log(`Output written to: ${outputPath}`);
