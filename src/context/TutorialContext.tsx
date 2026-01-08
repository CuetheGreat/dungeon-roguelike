import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

/**
 * Tutorial hint identifiers for different game moments.
 */
export type HintId = 
  | 'welcome'
  | 'first_combat'
  | 'targeting'
  | 'abilities'
  | 'items'
  | 'shop'
  | 'rest'
  | 'event'
  | 'puzzle'
  | 'treasure'
  | 'boss'
  | 'level_up'
  | 'inventory'
  | 'navigation';

/**
 * Tutorial hint content definition.
 */
export interface HintContent {
  title: string;
  message: string;
  icon?: string;
}

/**
 * Predefined hint content for each tutorial moment.
 */
export const HINT_CONTENT: Record<HintId, HintContent> = {
  welcome: {
    title: 'Welcome, Adventurer!',
    message: 'Navigate through the dungeon, defeat enemies, and collect loot. Each room presents new challenges!',
    icon: '⚔️'
  },
  first_combat: {
    title: 'Combat Basics',
    message: 'Choose an action like Attack or an ability, then select which enemy to target. Defeat all enemies to proceed!',
    icon: '🗡️'
  },
  targeting: {
    title: 'Target Selection',
    message: 'Multiple enemies! After selecting your action, click on the enemy you want to target. Focus weaker enemies first or take out the biggest threat!',
    icon: '🎯'
  },
  abilities: {
    title: 'Special Abilities',
    message: 'Your class has unique abilities! They cost mana and have cooldowns, but deal more damage or apply special effects.',
    icon: '✨'
  },
  items: {
    title: 'Using Items',
    message: 'Potions and consumables can turn the tide of battle! Use them wisely - they\'re limited.',
    icon: '🧪'
  },
  shop: {
    title: 'The Merchant',
    message: 'Spend your gold on better equipment, potions, and useful items. Hover over items to see their stats!',
    icon: '🏪'
  },
  rest: {
    title: 'Rest Area',
    message: 'A safe place to recover! You can rest to restore health, or upgrade your abilities if available.',
    icon: '🏕️'
  },
  event: {
    title: 'Random Event',
    message: 'Events present choices with different outcomes. Choose wisely - some options are risky but rewarding!',
    icon: '❓'
  },
  puzzle: {
    title: 'Puzzle Room',
    message: 'Solve the puzzle to earn rewards! Wrong answers may have consequences, but the rewards are worth it.',
    icon: '🧩'
  },
  treasure: {
    title: 'Treasure Found!',
    message: 'You\'ve discovered treasure! Collect the loot and check your inventory to equip new items.',
    icon: '💎'
  },
  boss: {
    title: 'Boss Battle!',
    message: 'A powerful enemy blocks your path! Use all your abilities and items. This will be a tough fight!',
    icon: '👹'
  },
  level_up: {
    title: 'Level Up!',
    message: 'You\'ve grown stronger! Your stats have increased and you may have learned new abilities.',
    icon: '⬆️'
  },
  inventory: {
    title: 'Inventory & Equipment',
    message: 'Press "I" to open your inventory. Equip weapons and armor to boost your stats!',
    icon: '🎒'
  },
  navigation: {
    title: 'Dungeon Navigation',
    message: 'Choose your path! Hover over rooms to see what awaits. Some paths are harder but more rewarding.',
    icon: '🗺️'
  }
};

/**
 * Tutorial context value interface.
 */
interface TutorialContextValue {
  /** Check if a hint has been shown */
  hasSeenHint: (hintId: HintId) => boolean;
  /** Show a hint (if not already shown) */
  showHint: (hintId: HintId) => void;
  /** Dismiss the current hint */
  dismissHint: () => void;
  /** Current active hint (null if none) */
  activeHint: HintId | null;
  /** Get hint content */
  getHintContent: (hintId: HintId) => HintContent;
  /** Reset all hints (for testing) */
  resetHints: () => void;
  /** Whether tutorials are enabled */
  tutorialsEnabled: boolean;
  /** Toggle tutorials on/off */
  setTutorialsEnabled: (enabled: boolean) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

const STORAGE_KEY = 'dungeon-roguelike-tutorial-hints';
const TUTORIALS_ENABLED_KEY = 'dungeon-roguelike-tutorials-enabled';

/**
 * Tutorial context provider.
 * Manages tutorial hints and persists shown hints to localStorage.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const [seenHints, setSeenHints] = useState<Set<HintId>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored) as HintId[]);
      }
    } catch (e) {
      console.warn('Failed to load tutorial hints from storage:', e);
    }
    return new Set();
  });

  const [activeHint, setActiveHint] = useState<HintId | null>(null);
  
  const [tutorialsEnabled, setTutorialsEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(TUTORIALS_ENABLED_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  // Persist seen hints to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seenHints)));
    } catch (e) {
      console.warn('Failed to save tutorial hints to storage:', e);
    }
  }, [seenHints]);

  // Persist tutorials enabled state
  useEffect(() => {
    try {
      localStorage.setItem(TUTORIALS_ENABLED_KEY, String(tutorialsEnabled));
    } catch (e) {
      console.warn('Failed to save tutorials enabled state:', e);
    }
  }, [tutorialsEnabled]);

  const hasSeenHint = useCallback((hintId: HintId) => {
    return seenHints.has(hintId);
  }, [seenHints]);

  const showHint = useCallback((hintId: HintId) => {
    if (!tutorialsEnabled) return;
    if (seenHints.has(hintId)) return;
    if (activeHint !== null) return; // Don't interrupt current hint
    
    setActiveHint(hintId);
  }, [seenHints, activeHint, tutorialsEnabled]);

  const dismissHint = useCallback(() => {
    if (activeHint) {
      setSeenHints(prev => new Set([...prev, activeHint]));
      setActiveHint(null);
    }
  }, [activeHint]);

  const getHintContent = useCallback((hintId: HintId) => {
    return HINT_CONTENT[hintId];
  }, []);

  const resetHints = useCallback(() => {
    setSeenHints(new Set());
    setActiveHint(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: TutorialContextValue = {
    hasSeenHint,
    showHint,
    dismissHint,
    activeHint,
    getHintContent,
    resetHints,
    tutorialsEnabled,
    setTutorialsEnabled
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

/**
 * Hook to access tutorial context.
 */
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

