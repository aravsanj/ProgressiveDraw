import React from 'react';
import { useWhiteboard } from '../store/useWhiteboard';
import { COT, Tool } from '../types';
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
  Upload,
  Layers,
  Ungroup,
  Undo2,
  Redo2,
  Pen,
  Image as ImageIcon,
  Eraser,
  Maximize,
  Minimize,
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
    setFrame,
    updateObject,
    deleteObject,
    deleteObjects,
    groupObjects,
    ungroupObjects,
    updateObjects,
    undo,
    redo,
    selectObject,
    setZoom,
    setPan,
    removeObjectFromGroup,
  } = useWhiteboard();

  const selectedObjects = ui.selectedObjectIds.map((id) => objects[id]).filter(Boolean);
  const singleSelection = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const [isFullscreen, setIsFullscreen] = React.useState(!!document.fullscreenElement);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && ui.mode === 'present') {
        setMode('edit');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [ui.mode, setMode]);

  const toggleFullscreen = (targetMode: 'edit' | 'present') => {
    if (targetMode === 'present') {
      document.documentElement.requestFullscreen?.();
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
    setMode(targetMode);
  };

  if (ui.mode === 'present') {
    return (
      <div className="absolute bottom-6 right-6 flex items-center space-x-4">
        <div className="bg-zinc-900/90 text-zinc-100 rounded-full px-4 py-2 backdrop-blur flex items-center space-x-4 shadow-xl border border-zinc-800">
          <button onClick={prevFrame} className="hover:text-blue-400 cursor-pointer">
            <ChevronLeft />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold leading-none mb-1">
              Frame
            </span>
            <input
              type="text"
              value={currentFrame}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setFrame(val === '' ? 0 : parseInt(val));
              }}
              className="text-sm font-mono font-bold bg-transparent border-b border-zinc-800 hover:border-zinc-600 focus:border-blue-500/50 text-center w-12 focus:outline-none transition-colors rounded-sm cursor-text py-0.5"
            />
          </div>
          <button onClick={nextFrame} className="hover:text-blue-400 cursor-pointer">
            <ChevronRight />
          </button>
        </div>
        <button
          onClick={() => toggleFullscreen('edit')}
          className="bg-zinc-900/90 p-3 rounded-full shadow hover:bg-zinc-800 text-zinc-100 border border-zinc-700 cursor-pointer"
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
            'p-2 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer',
            ui.mode === 'edit' && 'bg-zinc-800 text-blue-400',
          )}
          onClick={() => toggleFullscreen('edit')}
        >
          Edit
        </button>
        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          onClick={() => toggleFullscreen('present')}
        >
          <Play size={16} className="mr-2 inline" /> Present
        </button>
        <div className="w-px h-6 bg-zinc-800 mx-1" />
        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          title="Save Drawing"
          onClick={() => {
            const state = useWhiteboard.getState();
            const data = {
              version: 1,
              date: Date.now(),
              data: {
                objects: state.objects,
                currentFrame: state.currentFrame,
                ui: { ...state.ui, selectedObjectIds: [], editingObjectId: null },
              },
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `drawing-${new Date().toISOString().slice(0, 10)}.progressivedraw`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Upload size={16} className="rotate-180" />
        </button>
        <label
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          title="Open Drawing"
        >
          <Upload size={16} />
          <input
            type="file"
            className="hidden"
            accept=".progressivedraw"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              // Check file extension
              if (!file.name.endsWith('.progressivedraw')) {
                alert('Please select a .progressivedraw file');
                e.target.value = '';
                return;
              }

              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const text = event.target?.result as string;
                  const json = JSON.parse(text);
                  // Handle both raw state and wrapped versioned state
                  const stateToLoad = json.data && json.version ? json.data : json;
                  useWhiteboard.getState().loadFromObject(stateToLoad);
                } catch (err) {
                  console.error('Failed to parse file', err);
                  alert('Invalid drawing file');
                }
              };
              reader.readAsText(file);
              e.target.value = ''; // Reset input
            }}
          />
        </label>
        <button
          className="p-2 rounded hover:bg-zinc-800 text-zinc-400 cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          onClick={() => {
            if (isFullscreen) {
              document.exitFullscreen?.();
            } else {
              document.documentElement.requestFullscreen?.();
            }
          }}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      {/* Left Toolbar: Object Creation */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-zinc-900 rounded-lg shadow-md flex flex-col p-1.5 space-y-1 pointer-events-auto border border-zinc-800 text-zinc-400">
        <ToolButton
          icon={<MousePointer size={20} />}
          label="Select (1, V)"
          subLabel="1"
          active={ui.activeTool === Tool.Select}
          onClick={() => setTool(Tool.Select)}
        />
        <div className="h-px bg-zinc-800 my-1 mx-2" />
        <ToolButton
          icon={<Square size={20} />}
          label="Rectangle (2, R)"
          subLabel="2"
          active={ui.activeTool === Tool.Rectangle}
          onClick={() => setTool(Tool.Rectangle)}
        />
        <ToolButton
          icon={<Diamond size={20} />}
          label="Diamond (3, D)"
          subLabel="3"
          active={ui.activeTool === Tool.Diamond}
          onClick={() => setTool(Tool.Diamond)}
        />
        <ToolButton
          icon={<Circle size={20} />}
          label="Ellipse (4, O)"
          subLabel="4"
          active={ui.activeTool === Tool.Ellipse}
          onClick={() => setTool(Tool.Ellipse)}
        />
        <ToolButton
          icon={<ArrowRight size={20} />}
          label="Arrow (5, A)"
          subLabel="5"
          active={ui.activeTool === Tool.Arrow}
          onClick={() => setTool(Tool.Arrow)}
        />
        <ToolButton
          icon={<Minus size={20} />}
          label="Line (6, L)"
          subLabel="6"
          active={ui.activeTool === Tool.Line}
          onClick={() => setTool(Tool.Line)}
        />
        <ToolButton
          icon={<Pen size={20} />}
          label="Freedraw (7, P)"
          subLabel="7"
          disabled
          onClick={() => {}}
        />
        <ToolButton
          icon={<Type size={20} />}
          label="Text (8, T)"
          subLabel="8"
          active={ui.activeTool === Tool.Text}
          onClick={() => setTool(Tool.Text)}
        />
        <ToolButton
          icon={<ImageIcon size={20} />}
          label="Image (9)"
          subLabel="9"
          disabled
          onClick={() => {}}
        />
        <ToolButton
          icon={<Eraser size={20} />}
          label="Eraser (0, E)"
          subLabel="0"
          disabled
          onClick={() => {}}
        />
      </div>

      {/* Bottom Left: Zoom, Pan & History */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 pointer-events-auto select-none">
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800 shadow-lg">
          <button
            onClick={() => setZoom(1)}
            className="hover:bg-zinc-800 text-zinc-100 px-3 py-1.5 rounded-md text-xs font-medium transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            title="Reset Zoom to 100%"
          >
            <span className="text-blue-400 font-bold">{Math.round(ui.zoom * 100)}%</span>
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <button
            onClick={() => setPan({ x: 0, y: 0 })}
            className="text-zinc-400 px-2 py-1.5 rounded-md text-[10px] font-mono hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
            title="Reset Pan to (0,0)"
          >
            PAN <span className="text-zinc-500 ml-1">X:</span>
            <span className="text-zinc-200">{ui.pan.x.toFixed(0)}</span>
            <span className="text-zinc-500 ml-2">Y:</span>
            <span className="text-zinc-200">{ui.pan.y.toFixed(0)}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800 shadow-lg">
          <button
            onClick={undo}
            className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-all active:scale-95 cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-all active:scale-95 cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={18} />
          </button>
        </div>
      </div>

      {/* Bottom Center: Frame Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 rounded-full shadow-lg px-6 py-2 flex items-center space-x-6 pointer-events-auto border border-zinc-800 text-zinc-200">
        <button
          onClick={prevFrame}
          className="hover:bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          <ChevronLeft />
        </button>
        <div className="text-center group">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Frame</div>
          <input
            type="text"
            value={currentFrame}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setFrame(val === '' ? 0 : parseInt(val));
            }}
            className="text-xl font-bold font-mono leading-none bg-transparent border-b border-zinc-800 hover:border-zinc-600 focus:border-blue-500/50 text-center w-20 focus:outline-none transition-colors rounded-sm cursor-text py-1"
          />
        </div>
        <button
          onClick={nextFrame}
          className="hover:bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-zinc-100 cursor-pointer"
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
              className="text-red-500 hover:bg-red-950/30 p-1 rounded cursor-pointer"
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
                  onChange={(e) => {
                    useWhiteboard.getState().saveHistory();
                    updateObject(singleSelection.id, {
                      appearFrame: parseInt(e.target.value) || 0,
                    });
                  }}
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
                  onChange={(e) => {
                    useWhiteboard.getState().saveHistory();
                    updateObject(singleSelection.id, {
                      disappearFrame: e.target.value ? parseInt(e.target.value) : undefined,
                    });
                  }}
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
                onChange={(e) => {
                  useWhiteboard.getState().saveHistory();
                  updateObject(singleSelection.id, { text: e.target.value });
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
                rows={3}
              />
            </div>
          )}

          <div className="bg-zinc-800 p-2 rounded text-xs text-zinc-500">
            ID: {singleSelection.id.slice(0, 8)}
          </div>

          {singleSelection.type === COT.Group && (
            <>
              <button
                onClick={() => ungroupObjects(singleSelection.id)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 rounded text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <Ungroup size={14} />
                <span>Ungroup Objects</span>
              </button>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 block">Group Content</label>
                <div className="space-y-1 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {singleSelection.children?.map((childId, index) => {
                    const child = objects[childId];
                    if (!child) return null;

                    let IconComponent = Square;
                    if (child.type === COT.Diamond) IconComponent = Diamond;
                    else if (child.type === COT.Ellipse) IconComponent = Circle;
                    else if (child.type === COT.Arrow) IconComponent = ArrowRight;
                    else if (child.type === COT.Line) IconComponent = Minus;
                    else if (child.type === COT.Text) IconComponent = Type;
                    else if (child.type === COT.Group) IconComponent = Layers;

                    return (
                      <div key={child.id} className="flex items-center gap-1 group/item">
                        <div
                          onClick={() => selectObject(child.id)}
                          className="flex items-center gap-2 bg-zinc-950/50 p-1.5 rounded border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 transition-colors flex-1 overflow-hidden cursor-pointer"
                        >
                          <span className="text-[10px] text-violet-500 font-mono min-w-[12px] font-bold">
                            {index + 1}
                          </span>
                          <div className="text-zinc-500" title={child.type}>
                            <IconComponent size={12} />
                          </div>
                          <span
                            className="flex-1 text-xs text-zinc-300 truncate"
                            title={child.text || child.type}
                          >
                            {child.text || child.type}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeObjectFromGroup(singleSelection.id, child.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1.5 cursor-pointer rounded hover:bg-zinc-800 transition-colors"
                          title="Remove from group"
                        >
                          <Ungroup size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!singleSelection && selectedObjects.length > 1 && (
        <div className="absolute right-4 top-20 bg-zinc-900/95 backdrop-blur-md w-72 rounded-xl shadow-2xl p-4 pointer-events-auto border border-zinc-800 flex flex-col space-y-4 text-zinc-300">
          <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[10px] uppercase text-zinc-500 tracking-widest leading-tight">
                  Selection
                </span>
                <span className="text-sm font-bold text-zinc-100">
                  {selectedObjects.length} Objects Selected
                </span>
              </div>
              <button
                onClick={() => deleteObjects(selectedObjects.map((o) => o.id))}
                className="shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-red-500/20 active:scale-95"
                title="Delete all selected objects"
              >
                <Trash2 size={14} />
                <span className="whitespace-nowrap">Delete All</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Quick Actions
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => groupObjects(selectedObjects.map((o) => o.id))}
                className="w-full bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-200 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-zinc-700/50 active:scale-[0.98]"
              >
                <Layers size={14} className="text-blue-400" />
                <span>Group Selected Items</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-zinc-800/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Batch Timing
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Appear</span>
                <input
                  type="number"
                  placeholder="Frame #"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      useWhiteboard.getState().saveHistory();
                      updateObjects(ui.selectedObjectIds, { appearFrame: val });
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-sm focus:border-blue-500/50 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Disappear</span>
                <input
                  type="number"
                  placeholder="∞ (never)"
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    if (e.target.value === '' || !isNaN(val as number)) {
                      useWhiteboard.getState().saveHistory();
                      updateObjects(ui.selectedObjectIds, { disappearFrame: val });
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 text-sm focus:border-blue-500/50 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-800/50">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Selected Items
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {selectedObjects.map((obj, index) => {
                let Icon = Square;
                if (obj.type === COT.Diamond) Icon = Diamond;
                else if (obj.type === COT.Ellipse) Icon = Circle;
                else if (obj.type === COT.Arrow) Icon = ArrowRight;
                else if (obj.type === COT.Line) Icon = Minus;
                else if (obj.type === COT.Text) Icon = Type;
                else if (obj.type === COT.Group) Icon = Layers;

                return (
                  <div
                    key={obj.id}
                    className="flex items-center gap-2 bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/30 hover:border-zinc-700/50 transition-colors group cursor-default"
                  >
                    <span className="text-[10px] text-zinc-600 font-mono w-4">{index + 1}</span>
                    <Icon size={12} className="text-zinc-500" />
                    <span className="text-xs text-zinc-400 truncate flex-1 leading-none">
                      {obj.text || obj.type}
                    </span>
                    <button
                      onClick={() => selectObject(obj.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 font-bold uppercase tracking-tighter hover:underline cursor-pointer transition-opacity"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ToolButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, label, subLabel, active, disabled, onClick }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={cn(
      'p-2 rounded group relative flex justify-center transition-colors',
      disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
      !disabled && (active ? 'bg-zinc-800 text-blue-400' : 'hover:bg-zinc-800 hover:text-zinc-200'),
    )}
    title={label}
  >
    {icon}
    {subLabel && (
      <span
        className={cn(
          'absolute bottom-0.5 right-1 text-[8px] font-bold leading-none pointer-events-none',
          active ? 'text-blue-500' : 'text-zinc-500',
        )}
      >
        {subLabel}
      </span>
    )}
  </button>
);
