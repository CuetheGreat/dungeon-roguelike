import { Room } from '../../dungeon/room';
import { Puzzle } from '../../puzzles/puzzle';
import { Action } from '../../game/gameState';

interface PuzzleViewProps {
  room: Room;
  onAction: (action: Action) => void;
}

/**
 * Gets the icon for a puzzle type.
 */
function getPuzzleIcon(type: string): string {
  switch (type) {
    case 'riddle': return '🧩';
    case 'sequence': return '🔮';
    case 'math': return '🔢';
    default: return '❓';
  }
}

/**
 * Puzzle view component for puzzle rooms.
 */
export function PuzzleView({ room, onAction }: PuzzleViewProps) {
  const puzzle = room.puzzle;
  
  if (!puzzle) {
    return (
      <div className="puzzle-view">
        <p>No puzzle here</p>
      </div>
    );
  }

  const attemptsLeft = puzzle.maxAttempts - puzzle.attempts;
  const attemptsClass = attemptsLeft <= 1 
    ? 'attempts-critical' 
    : attemptsLeft <= 2 
      ? 'attempts-warning' 
      : '';

  const handleAnswer = (answerIndex: number, answerText: string) => {
    onAction({ type: 'puzzle_answer', answerIndex, answerText });
  };

  const handleSkip = () => {
    onAction({ type: 'skip_puzzle' });
  };

  return (
    <div className="puzzle-view">
      {/* Puzzle Header */}
      <div className="puzzle-header">
        <span className="puzzle-icon">{getPuzzleIcon(puzzle.type)}</span>
        <h2 className="puzzle-title">{puzzle.title}</h2>
      </div>
      
      {/* Attempts Counter */}
      <div className={`puzzle-attempts ${attemptsClass}`}>
        <span>Attempts remaining: {attemptsLeft}</span>
      </div>
      
      {/* Puzzle Question */}
      <div className="puzzle-question">
        <p>{puzzle.question}</p>
      </div>
      
      {/* Answer Options */}
      <div className="puzzle-options">
        {puzzle.options.map((option, index) => (
          <button
            key={index}
            className="puzzle-option"
            onClick={() => handleAnswer(index, option)}
          >
            {option}
          </button>
        ))}
      </div>
      
      {/* Skip Button */}
      <div className="puzzle-actions">
        <button className="skip-puzzle-btn" onClick={handleSkip}>
          Skip Puzzle (forfeit rewards)
        </button>
      </div>
    </div>
  );
}

