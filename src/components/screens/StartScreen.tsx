import { useState, useCallback } from 'react';
import { PlayerClass } from '../../entities/player';

/**
 * Class card data for display.
 */
interface ClassData {
  id: PlayerClass;
  name: string;
  icon: string;
  stats: { hp: number; mp: number; atk: number; def: number };
  description: string;
}

const CLASSES: ClassData[] = [
  {
    id: PlayerClass.FIGHTER,
    name: 'Fighter',
    icon: '⚔️',
    stats: { hp: 120, mp: 30, atk: 12, def: 10 },
    description: 'A stalwart warrior with high health and defense. Excels in sustained combat.',
  },
  {
    id: PlayerClass.WARLOCK,
    name: 'Warlock',
    icon: '✨',
    stats: { hp: 80, mp: 100, atk: 6, def: 6 },
    description: 'A master of dark magic with devastating spells. High risk, high reward.',
  },
  {
    id: PlayerClass.BLOOD_ASSASSIN,
    name: 'Blood Assassin',
    icon: '🩸',
    stats: { hp: 90, mp: 60, atk: 10, def: 8 },
    description: 'A hemomancer who sacrifices health for power. High risk, devastating damage.',
  },
  {
    id: PlayerClass.ZEPHYR,
    name: 'Zephyr',
    icon: '🌪️',
    stats: { hp: 70, mp: 85, atk: 8, def: 6 },
    description: 'A wind sorcerer with high mobility and evasion. Master of AoE and crowd control.',
  },
];

interface StartScreenProps {
  onStart: (playerClass: PlayerClass, name: string, seed?: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Character selection and game start screen.
 * Matches the original HTML structure for CSS compatibility.
 */
export function StartScreen({ onStart, isLoading, error }: StartScreenProps) {
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [seed, setSeed] = useState('');

  const handleClassSelect = useCallback((classId: PlayerClass) => {
    setSelectedClass(classId);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, classId: PlayerClass) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedClass(classId);
    }
  }, []);

  const handleStart = useCallback(() => {
    if (selectedClass && playerName.trim()) {
      onStart(selectedClass, playerName.trim(), seed || undefined);
    }
  }, [selectedClass, playerName, seed, onStart]);

  const canStart = selectedClass && playerName.trim() && !isLoading;

  return (
    <div id="character-select" className="screen">
      <div className="title-section">
        <h1 className="game-title">Dungeon Roguelike</h1>
        <p className="game-subtitle">A turn-based adventure awaits</p>
      </div>

      <div className="select-section">
        <h2>Choose Your Class</h2>

        <div className="class-options">
          {CLASSES.map((classData) => (
            <div
              key={classData.id}
              className={`class-card ${selectedClass === classData.id ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${classData.name} class`}
              onClick={() => handleClassSelect(classData.id)}
              onKeyDown={(e) => handleKeyDown(e, classData.id)}
            >
              <div className="class-icon">{classData.icon}</div>
              <h3>{classData.name}</h3>
              <div className="class-stats">
                <div className="stat">
                  <span className="label">HP:</span>
                  <span className="value">{classData.stats.hp}</span>
                </div>
                <div className="stat">
                  <span className="label">MP:</span>
                  <span className="value">{classData.stats.mp}</span>
                </div>
                <div className="stat">
                  <span className="label">ATK:</span>
                  <span className="value">{classData.stats.atk}</span>
                </div>
                <div className="stat">
                  <span className="label">DEF:</span>
                  <span className="value">{classData.stats.def}</span>
                </div>
              </div>
              <p className="class-desc">{classData.description}</p>
            </div>
          ))}
        </div>

        <div className="input-row">
          <div className="name-input">
            <label htmlFor="player-name">Your Name</label>
            <input
              type="text"
              id="player-name"
              placeholder="Hero"
              maxLength={20}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>

          <div className="seed-input">
            <label htmlFor="game-seed">Seed (optional)</label>
            <input
              type="text"
              id="game-seed"
              placeholder="Random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>
        </div>

        <button
          id="start-game"
          className="start-btn"
          disabled={!canStart}
          onClick={handleStart}
        >
          {isLoading ? 'Generating...' : 'Begin Adventure'}
        </button>

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

