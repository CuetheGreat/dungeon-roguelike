import React, { useEffect } from 'react';
import { useTutorial, HintId } from '../../context/TutorialContext';

/**
 * TutorialHint component displays contextual tutorial hints.
 * Shows as an overlay that can be dismissed by clicking.
 */
export function TutorialHint() {
  const { activeHint, getHintContent, dismissHint } = useTutorial();

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (activeHint) {
      const timer = setTimeout(() => {
        dismissHint();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeHint, dismissHint]);

  // Handle keyboard dismiss
  useEffect(() => {
    if (!activeHint) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismissHint();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeHint, dismissHint]);

  if (!activeHint) return null;

  const content = getHintContent(activeHint);

  return (
    <div className="tutorial-hint-overlay" onClick={dismissHint}>
      <div className="tutorial-hint" onClick={e => e.stopPropagation()}>
        <div className="tutorial-hint-icon">{content.icon}</div>
        <div className="tutorial-hint-content">
          <h3 className="tutorial-hint-title">{content.title}</h3>
          <p className="tutorial-hint-message">{content.message}</p>
        </div>
        <button className="tutorial-hint-dismiss" onClick={dismissHint}>
          Got it!
        </button>
        <div className="tutorial-hint-footer">
          <span className="tutorial-hint-shortcut">Press ESC or click anywhere to dismiss</span>
        </div>
      </div>
    </div>
  );
}

/**
 * TutorialTrigger component - triggers a hint when rendered.
 * Use this to show hints at specific moments.
 */
interface TutorialTriggerProps {
  hintId: HintId;
  /** Optional delay before showing hint (ms) */
  delay?: number;
}

export function TutorialTrigger({ hintId, delay = 500 }: TutorialTriggerProps) {
  const { showHint, hasSeenHint } = useTutorial();

  useEffect(() => {
    if (hasSeenHint(hintId)) return;

    const timer = setTimeout(() => {
      showHint(hintId);
    }, delay);

    return () => clearTimeout(timer);
  }, [hintId, delay, showHint, hasSeenHint]);

  return null;
}

/**
 * Hook to programmatically trigger hints.
 */
export function useTutorialTrigger() {
  const { showHint, hasSeenHint } = useTutorial();

  const triggerHint = (hintId: HintId, delay = 0) => {
    if (hasSeenHint(hintId)) return;

    if (delay > 0) {
      setTimeout(() => showHint(hintId), delay);
    } else {
      showHint(hintId);
    }
  };

  return { triggerHint, hasSeenHint };
}

