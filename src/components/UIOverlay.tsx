import React from 'react';
import { useWhiteboard } from '../store/useWhiteboard';
import { cn } from '../lib/utils';
import {
  Square,
  Type,
  ArrowRight,
  Play,
  ChevronLeft,
  ChevronRight,
  MousePointer,
  Trash2,
  Diamond,
  Circle,
  Minus,
} from 'lucide-react';

export const UIOverlay: React.FC = () => {
  const {
    ui,
    objects,
    currentFrame,
    setMode,
    setTool,
    nextFrame,
    prevFrame,
    updateObject,
    deleteObject,
    deleteObjects,
  } = useWhiteboard();

  const selectedObjects = ui.selectedObjectIds.map((id) => objects[id]).filter(Boolean);
  const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;

  if (ui.mode === 'present') {
    return (
      <div className="absolute bottom-6 right-6 flex items-center space-x-4">
        <div className="bg-zinc-900/90 text-zinc-100 rounded-full px-4 py-2 backdrop-blur flex items-center space-x-4 shadow-xl border border-zinc-800">
          <button onClick={prevFrame} className="hover:text-blue-400">
            <ChevronLeft />
          </button>
          <span className="font-mono font-bold">Frame {currentFrame}</span>
          <button onClick={nextFrame} className="hover:text-blue-400">
            <ChevronRight />
          </button>
        </div>
        <button
          onClick={() => setMode('edit')}
          className="bg-zinc-900/90 p-3 rounded-full shadow hover:bg-zinc-800 text-zinc-100 border border-zinc-700"
          title="Exit Presenter Mode"
        >
          <MousePointer size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Toolbar: Mode & Global Toggles */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 rounded-lg shadow-md p-1.5 flex items-center space-x-1 pointer-events-auto border border-zinc-800">
        <button
          className={cn(
            'p-2 rounded hover:bg-zinc-800 text-zinc-400',
            ui.mode === 'edit' && 'bg-zinc-800 text-blue-400',
          )}
          onClick={() => setMode('edit')}
        >
          Edit
        </button>
        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400"
          onClick={() => setMode('present')}
        >
          <Play size={16} className="mr-2 inline" /> Present
        </button>
      </div>

      {/* Left Toolbar: Object Creation */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-zinc-900 rounded-lg shadow-md flex flex-col p-1.5 space-y-1 pointer-events-auto border border-zinc-800 text-zinc-400">
        <ToolButton
          icon={<MousePointer size={20} />}
          label="Select"
          active={ui.activeTool === 'select'}
          onClick={() => setTool('select')}
        />
        <div className="h-px bg-zinc-800 my-1 mx-2" />
        <ToolButton
          icon={<Square size={20} />}
          label="Rectangle"
          active={ui.activeTool === 'rectangle'}
          onClick={() => setTool('rectangle')}
        />
        <ToolButton
          icon={<Diamond size={20} />}
          label="Diamond"
          active={ui.activeTool === 'diamond'}
          onClick={() => setTool('diamond')}
        />
        <ToolButton
          icon={<Circle size={20} />}
          label="Ellipse"
          active={ui.activeTool === 'ellipse'}
          onClick={() => setTool('ellipse')}
        />
        <ToolButton
          icon={<Minus size={20} />}
          label="Line"
          active={ui.activeTool === 'line'}
          onClick={() => setTool('line')}
        />
        <ToolButton
          icon={<ArrowRight size={20} />}
          label="Arrow"
          active={ui.activeTool === 'arrow'}
          onClick={() => setTool('arrow')}
        />
        <ToolButton
          icon={<Type size={20} />}
          label="Text"
          active={ui.activeTool === 'text'}
          onClick={() => setTool('text')}
        />
      </div>

      {/* Bottom Center: Frame Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 rounded-full shadow-lg px-6 py-2 flex items-center space-x-6 pointer-events-auto border border-zinc-800 text-zinc-200">
        <button
          onClick={prevFrame}
          className="hover:bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-zinc-100"
        >
          <ChevronLeft />
        </button>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Frame</div>
          <div className="text-xl font-bold font-mono leading-none">{currentFrame}</div>
        </div>
        <button
          onClick={nextFrame}
          className="hover:bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-zinc-100"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Right Panel: Inspector */}
      {singleSelection && (
        <div className="absolute right-4 top-20 bg-zinc-900 w-64 rounded-lg shadow-md p-4 pointer-events-auto border border-zinc-800 flex flex-col space-y-4 text-zinc-300">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <span className="font-bold text-sm uppercase text-zinc-500">
              {singleSelection.type}
            </span>
            <button
              onClick={() => deleteObject(singleSelection.id)}
              className="text-red-500 hover:bg-red-950/30 p-1 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 block">Appearance Frames</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-zinc-500">Appear</span>
                <input
                  type="number"
                  value={singleSelection.appearFrame}
                  onChange={(e) =>
                    updateObject(singleSelection.id, { appearFrame: parseInt(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                />
              </div>
              <div>
                <span className="text-xs text-zinc-500">Disappear</span>
                <input
                  type="number"
                  placeholder="∞"
                  value={
                    singleSelection.disappearFrame === Infinity ||
                    singleSelection.disappearFrame === undefined
                      ? ''
                      : singleSelection.disappearFrame
                  }
                  onChange={(e) =>
                    updateObject(singleSelection.id, {
                      disappearFrame: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                />
              </div>
            </div>
          </div>

          {singleSelection.text !== undefined && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 block">Content</label>
              <textarea
                value={singleSelection.text}
                onChange={(e) => updateObject(singleSelection.id, { text: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                rows={3}
              />
            </div>
          )}

          <div className="bg-zinc-800 p-2 rounded text-xs text-zinc-500">
            ID: {singleSelection.id.slice(0, 8)}
          </div>
        </div>
      )}

      {!singleSelection && selectedObjects.length > 1 && (
        <div className="absolute right-4 top-20 bg-zinc-900 w-64 rounded-lg shadow-md p-4 pointer-events-auto border border-zinc-800 flex flex-col space-y-4 text-zinc-300">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <span className="font-bold text-sm uppercase text-zinc-500">
              Multiple Selected ({selectedObjects.length})
            </span>
            <button
              onClick={() => deleteObjects(ui.selectedObjectIds)}
              className="text-red-500 hover:bg-red-950/30 p-1 rounded flex items-center space-x-2 text-xs"
            >
              <Trash2 size={16} />
              <span>Delete All</span>
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            You can perform actions on all {selectedObjects.length} selected objects.
          </p>
        </div>
      )}
    </div>
  );
};

const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'p-2 rounded group relative flex justify-center transition-colors',
      active ? 'bg-zinc-800 text-blue-400' : 'hover:bg-zinc-800 hover:text-zinc-200',
    )}
    title={label}
  >
    {icon}
  </button>
);
