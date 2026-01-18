import { Canvas } from './components/Canvas';
import { UIOverlay } from './components/UIOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="w-screen h-screen overflow-hidden">
        <Canvas />
        <UIOverlay />
      </div>
    </ErrorBoundary>
  );
}

export default App;
