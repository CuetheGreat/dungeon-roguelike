import { GameProvider } from './context/GameContext';
import { TutorialProvider } from './context/TutorialContext';
import { GameContainer } from './components/GameContainer';
import { TutorialHint } from './components/ui';

/**
 * Root application component.
 * Wraps the game in the GameProvider and TutorialProvider contexts.
 * 
 * Styles are loaded from public/styles.css via index.html
 * to maintain compatibility with the original game styling.
 */
function App() {
  return (
    <TutorialProvider>
      <GameProvider>
        <GameContainer />
        <TutorialHint />
      </GameProvider>
    </TutorialProvider>
  );
}

export default App;

