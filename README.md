# Dungeon Roguelike

A turn-based dungeon crawler roguelike game built with TypeScript. Explore procedurally generated dungeons, battle monsters from the D&D 5e universe, collect loot, and see how deep you can go.

## Features

- **Two Playable Classes**: Choose between the tanky Fighter or the spell-slinging Warlock, each with unique abilities and playstyles
- **Procedural Dungeon Generation**: Every run features randomly generated dungeon layouts with various room types
- **D&D 5e Monster Integration**: Fight against monsters pulled from the official D&D 5e API with authentic stats
- **Turn-Based Combat**: Strategic combat system with abilities, cooldowns, and status effects
- **Equipment & Items**: Find and equip weapons, armor, and accessories to power up your character
- **Relics**: Discover powerful relics that grant permanent passive bonuses
- **Shops & Events**: Encounter mysterious events and shops as you explore
- **Save System**: Save your progress and continue your adventure later

## Play Online

The game is hosted on GitHub Pages: [Play Dungeon Roguelike](https://cuethegreat.github.io/dungeon-roguelike/)

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/CuetheGreat/dungeon-roguelike.git
cd dungeon-roguelike
```

2. Install dependencies:
```bash
npm install
```

3. Build the web bundle:
```bash
npm run build:web
```

4. Start the local server:
```bash
npm run serve
```

5. Open your browser to `http://localhost:3000`

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:web` | Bundle for production (outputs to `public/game.js`) |
| `npm run serve` | Serve the `public/` directory locally |
| `npm test` | Run the test suite with Vitest |

### Project Structure

```
dungeon-roguelike/
├── src/
│   ├── entities/       # Player classes, enemies, items, relics
│   ├── dungeon/        # Room and interactable definitions
│   ├── game/           # Core game logic (combat, state, managers)
│   ├── integration/    # Dungeon generator
│   ├── puzzles/        # Puzzle system
│   ├── types/          # TypeScript type definitions
│   └── ui/             # Web UI and game loop
├── tests/              # Test files
├── public/             # Static assets and built game
└── dist/               # Compiled TypeScript output
```

## How to Play

1. **Select a Class**: Choose Fighter for durability or Warlock for magic damage
2. **Explore**: Navigate through dungeon rooms using the movement buttons
3. **Combat**: Use basic attacks and abilities to defeat enemies
4. **Loot**: Collect gold, equipment, and items from defeated enemies and chests
5. **Progress**: Descend deeper into the dungeon for greater challenges and rewards

### Classes

#### Fighter
- High health (120) and defense (10)
- Strong physical attacks
- Abilities: Power Strike, Shield Bash, Battle Cry, Second Wind, Whirlwind
- Passive: Last Stand (+50% defense when below 25% health)

#### Warlock
- High mana pool (100) for spellcasting
- Powerful magic damage with lifesteal options
- Abilities: Eldritch Blast, Drain Life, Hex, Shadow Bolt, Dark Pact, Soul Harvest
- Mechanic: Soul Shards (gained on kills, empower certain abilities)

## Tech Stack

- **TypeScript** - Primary language
- **esbuild** - Fast bundling for web
- **Vitest** - Testing framework
- **D&D 5e API** - Monster data source ([dnd5eapi.co](https://www.dnd5eapi.co/))

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure to update tests as appropriate.

## Acknowledgments

- Monster data provided currently by the [D&D 5e API](https://www.dnd5eapi.co/)
- Inspired by classic roguelikes and dungeon crawlers.