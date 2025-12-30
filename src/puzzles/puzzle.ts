/**
 * @fileoverview Puzzle System for Dungeon Roguelike
 * 
 * This module handles puzzle rooms with various puzzle types:
 * - Riddles: Answer a riddle correctly
 * - Sequence: Remember and repeat a pattern
 * - Math: Solve a mathematical problem
 * 
 * @module puzzles/puzzle
 */

import { getRNG, isRNGInitialized } from '../game/seed';

/**
 * Types of puzzles that can appear in puzzle rooms
 */
export enum PuzzleType {
    /** Answer a riddle */
    RIDDLE = 'riddle',
    /** Remember and repeat a sequence */
    SEQUENCE = 'sequence',
    /** Solve a math problem */
    MATH = 'math',
}

/**
 * Represents a puzzle challenge
 */
export interface Puzzle {
    /** Unique identifier */
    id: string;
    /** Type of puzzle */
    type: PuzzleType;
    /** Puzzle title */
    title: string;
    /** The puzzle question or challenge */
    question: string;
    /** Possible answers (for multiple choice) */
    options: string[];
    /** Index of the correct answer in options */
    correctIndex: number;
    /** Hint for the puzzle */
    hint: string;
    /** Whether the puzzle has been solved */
    solved: boolean;
    /** Number of attempts made */
    attempts: number;
    /** Maximum attempts allowed */
    maxAttempts: number;
    /** Reward multiplier based on attempts (1.0 = full reward) */
    rewardMultiplier: number;
}

/**
 * Result of attempting to solve a puzzle
 */
export interface PuzzleSolveResult {
    /** Whether the answer was correct */
    correct: boolean;
    /** Message to display */
    message: string;
    /** Whether the puzzle is now complete (solved or failed) */
    complete: boolean;
    /** Remaining attempts if incorrect */
    remainingAttempts?: number;
}

// ============================================================================
// RIDDLE TEMPLATES
// ============================================================================

const RIDDLES = [
    {
        question: "I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?",
        options: ["A painting", "A map", "A dream", "A mirror"],
        correctIndex: 1,
        hint: "Adventurers use me to find their way."
    },
    {
        question: "The more you take, the more you leave behind. What am I?",
        options: ["Memories", "Footsteps", "Breaths", "Time"],
        correctIndex: 1,
        hint: "Look down as you walk."
    },
    {
        question: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?",
        options: ["A ghost", "An echo", "A shadow", "A whisper"],
        correctIndex: 1,
        hint: "Shout in a canyon and you'll find me."
    },
    {
        question: "What has keys but no locks, space but no room, and you can enter but can't go inside?",
        options: ["A keyboard", "A piano", "A treasure chest", "A riddle"],
        correctIndex: 0,
        hint: "Wizards use these to write their spells."
    },
    {
        question: "I am not alive, but I grow. I don't have lungs, but I need air. What am I?",
        options: ["A crystal", "Fire", "A shadow", "Moss"],
        correctIndex: 1,
        hint: "Dragons breathe this."
    },
    {
        question: "What can travel around the world while staying in a corner?",
        options: ["A spider", "A stamp", "A shadow", "The wind"],
        correctIndex: 1,
        hint: "Found on letters and parcels."
    },
    {
        question: "The more of me there is, the less you see. What am I?",
        options: ["Fog", "Darkness", "Smoke", "All of these"],
        correctIndex: 3,
        hint: "Rogues love to hide in me."
    },
    {
        question: "I have hands but cannot clap. What am I?",
        options: ["A statue", "A clock", "A tree", "A puppet"],
        correctIndex: 1,
        hint: "I tell you when it's time for adventure."
    },
];

// ============================================================================
// SEQUENCE TEMPLATES
// ============================================================================

const SEQUENCE_ELEMENTS = ['Fire', 'Water', 'Earth', 'Air', 'Light', 'Shadow'];
const SEQUENCE_SYMBOLS = ['🔥', '💧', '🌍', '💨', '✨', '🌑'];

// ============================================================================
// MATH TEMPLATES
// ============================================================================

function generateMathPuzzle(level: number): { question: string; options: string[]; correctIndex: number; hint: string } {
    const rng = isRNGInitialized() ? getRNG() : null;
    const random = () => rng ? rng.nextFloat() : Math.random();
    const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
    
    // Difficulty scales with level
    const maxNum = 10 + level * 2;
    
    const puzzleType = randInt(0, 2);
    let a: number, b: number, answer: number, question: string, hint: string;
    
    switch (puzzleType) {
        case 0: // Addition
            a = randInt(5, maxNum);
            b = randInt(5, maxNum);
            answer = a + b;
            question = `A warrior has ${a} swords. He finds ${b} more in a chest. How many swords does he have now?`;
            hint = "Add them together.";
            break;
        case 1: // Multiplication
            a = randInt(2, Math.min(12, 5 + Math.floor(level / 3)));
            b = randInt(2, Math.min(12, 5 + Math.floor(level / 3)));
            answer = a * b;
            question = `A dungeon has ${a} floors. Each floor has ${b} rooms. How many rooms are there in total?`;
            hint = "Multiply the numbers.";
            break;
        case 2: // Subtraction
            a = randInt(20, maxNum * 2);
            b = randInt(5, a - 5);
            answer = a - b;
            question = `A mage has ${a} mana points. She casts a spell costing ${b} mana. How much mana remains?`;
            hint = "Subtract to find the remainder.";
            break;
        default:
            a = 10; b = 5; answer = 15;
            question = `What is ${a} + ${b}?`;
            hint = "Basic addition.";
    }
    
    // Generate wrong answers
    const wrongAnswers = [
        answer + randInt(1, 5),
        answer - randInt(1, 5),
        answer + randInt(6, 10),
    ].filter(w => w !== answer && w > 0);
    
    // Shuffle options
    const options = [answer.toString(), ...wrongAnswers.slice(0, 3).map(String)];
    const correctIndex = 0;
    
    // Shuffle the options
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    return {
        question,
        options,
        correctIndex: options.indexOf(answer.toString()),
        hint
    };
}

// ============================================================================
// PUZZLE GENERATION
// ============================================================================

/**
 * Generates a random puzzle based on dungeon level.
 * 
 * @param level - Current dungeon level
 * @returns A generated Puzzle
 */
export function generatePuzzle(level: number): Puzzle {
    const rng = isRNGInitialized() ? getRNG() : null;
    const random = () => rng ? rng.nextFloat() : Math.random();
    
    // Choose puzzle type
    const typeRoll = random();
    let type: PuzzleType;
    if (typeRoll < 0.5) {
        type = PuzzleType.RIDDLE;
    } else if (typeRoll < 0.8) {
        type = PuzzleType.MATH;
    } else {
        type = PuzzleType.SEQUENCE;
    }
    
    let title: string;
    let question: string;
    let options: string[];
    let correctIndex: number;
    let hint: string;
    
    switch (type) {
        case PuzzleType.RIDDLE: {
            const riddle = RIDDLES[Math.floor(random() * RIDDLES.length)];
            title = "Ancient Riddle";
            question = riddle.question;
            options = [...riddle.options];
            correctIndex = riddle.correctIndex;
            hint = riddle.hint;
            break;
        }
        
        case PuzzleType.SEQUENCE: {
            // Generate a sequence of 3-5 elements based on level
            const length = Math.min(3 + Math.floor(level / 5), 5);
            const sequence: number[] = [];
            for (let i = 0; i < length; i++) {
                sequence.push(Math.floor(random() * SEQUENCE_ELEMENTS.length));
            }
            
            title = "Elemental Sequence";
            question = `Repeat the sequence: ${sequence.map(i => SEQUENCE_SYMBOLS[i]).join(' → ')}`;
            
            // Create options including the correct sequence and wrong ones
            const correctAnswer = sequence.map(i => SEQUENCE_ELEMENTS[i]).join(', ');
            const wrongSequences = [
                [...sequence].reverse().map(i => SEQUENCE_ELEMENTS[i]).join(', '),
                sequence.map(i => SEQUENCE_ELEMENTS[(i + 1) % SEQUENCE_ELEMENTS.length]).join(', '),
                sequence.map(i => SEQUENCE_ELEMENTS[(i + 2) % SEQUENCE_ELEMENTS.length]).join(', '),
            ];
            
            options = [correctAnswer, ...wrongSequences];
            correctIndex = 0;
            
            // Shuffle
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }
            correctIndex = options.indexOf(correctAnswer);
            hint = "Follow the symbols in order.";
            break;
        }
        
        case PuzzleType.MATH: {
            const mathPuzzle = generateMathPuzzle(level);
            title = "Numerical Challenge";
            question = mathPuzzle.question;
            options = mathPuzzle.options;
            correctIndex = mathPuzzle.correctIndex;
            hint = mathPuzzle.hint;
            break;
        }
    }
    
    return {
        id: crypto.randomUUID(),
        type,
        title,
        question,
        options,
        correctIndex,
        hint,
        solved: false,
        attempts: 0,
        maxAttempts: 3,
        rewardMultiplier: 1.0
    };
}

/**
 * Attempts to solve a puzzle with the given answer.
 * 
 * @param puzzle - The puzzle to solve
 * @param answerIndex - Index of the selected answer
 * @returns Result of the attempt
 */
export function attemptPuzzle(puzzle: Puzzle, answerIndex: number): PuzzleSolveResult {
    if (puzzle.solved) {
        return {
            correct: true,
            message: "This puzzle has already been solved.",
            complete: true
        };
    }
    
    puzzle.attempts++;
    
    if (answerIndex === puzzle.correctIndex) {
        puzzle.solved = true;
        // Reduce reward based on attempts
        puzzle.rewardMultiplier = Math.max(0.5, 1.0 - (puzzle.attempts - 1) * 0.25);
        
        return {
            correct: true,
            message: puzzle.attempts === 1 
                ? "Brilliant! You solved it on the first try!" 
                : `Correct! Solved in ${puzzle.attempts} attempts.`,
            complete: true
        };
    }
    
    const remainingAttempts = puzzle.maxAttempts - puzzle.attempts;
    
    if (remainingAttempts <= 0) {
        return {
            correct: false,
            message: `Wrong! The puzzle locks itself. The answer was: ${puzzle.options[puzzle.correctIndex]}`,
            complete: true,
            remainingAttempts: 0
        };
    }
    
    return {
        correct: false,
        message: `Incorrect. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining. Hint: ${puzzle.hint}`,
        complete: false,
        remainingAttempts
    };
}

