import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Save, Scissors, Trash2, List, Type, Gauge, Crop, Sliders, Sparkles, Wand2, RotateCcw, CheckCircle, Volume2, VolumeX, RotateCw, ZoomIn, FlipHorizontal, ArrowRightCircle, Copy, Scissors as CutIcon } from 'lucide-react';
import axios from 'axios';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableClip({ id, segment, index, activeSegmentId, onSelect, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isActive = activeSegmentId === id;
  const duration = segment.end_sec - segment.start_sec;

  const isResizing = useRef(false);
  const resizeEdge = useRef(null);
  const startX = useRef(0);
  const initialTime = useRef(0);
  const segmentRef = useRef(segment);

  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);

  const handlePointerDown = (event, edge) => {
    event.stopPropagation();
    isResizing.current = true;
    resizeEdge.current = edge;
    startX.current = event.clientX;
    initialTime.current = edge === 'left' ? segmentRef.current.start_sec : segmentRef.current.end_sec;

    const onMove = (e) => {
      if (!isResizing.current) return;
      const dx = e.clientX - startX.current;
      const timeDelta = dx * 0.05;

      const seg = segmentRef.current;
      let newStart = seg.start_sec;
      let newEnd = seg.end_sec;

      if (resizeEdge.current === 'left') {
        newStart = Math.max(0, initialTime.current + timeDelta);
        if (newStart >= newEnd - 0.5) newStart = newEnd - 0.5;
      } else {
        newEnd = initialTime.current + timeDelta;
        if (newEnd <= newStart + 0.5) newEnd = newStart + 0.5;
      }

      onUpdate(id, { ...seg, start_sec: newStart, end_sec: newEnd });
    };

    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes} {...listeners}
      onClick={() => {
        if (!isResizing.current) onSelect(id);
      }}
      className={`relative h-20 flex-shrink-0 rounded-lg overflow-hidden cursor-grab shadow-sm transition-shadow border ${isActive ? 'border-[#D97706] shadow-md z-10' : 'border-[#374151] hover:border-gray-500'}`}
      style={{ ...style, width: `${Math.max(duration * 20, 60)}px`, minWidth: '60px' }}
    >
      <div className="absolute inset-0 bg-[#D97706]/80 pointer-events-none"></div>

      <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
        <span className="text-white font-semibold text-xs bg-black/20 px-2 rounded">Clip {index + 1}</span>
        <span className="text-white/80 text-[10px] mt-0.5 font-medium">{duration.toFixed(1)}s</span>
      </div>

      <div
        className="absolute left-0 top-0 bottom-0 w-3 bg-white/20 hover:bg-white/40 cursor-col-resize flex justify-center items-center group touch-none"
        onPointerDown={(e) => handlePointerDown(e, 'left')}
      >
        <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover:bg-white transition-colors"></div>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-3 bg-white/20 hover:bg-white/40 cursor-col-resize flex justify-center items-center group touch-none"
        onPointerDown={(e) => handlePointerDown(e, 'right')}
      >
        <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover:bg-white transition-colors"></div>
      </div>
    </div>
  );
}

export default function EditorWorkspace({ taskId, resultData, rawVideoPath, onRenderComplete }) {
  const [segments, setSegments] = useState([]);
  const [originalSegments, setOriginalSegments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderDone, setRenderDone] = useState(false);
  const [activeTab, setActiveTab] = useState('trim');
  const playerRef = useRef(null);

useEffect(() => {
    if (resultData?.segments) {
      const init = resultData.segments.map((s, i) => ({
        ...s,
        id: `seg-${i}-${Date.now()}`,
        filters: s.filters || {
          brightness: 1, contrast: 1, saturation: 1, grayscale: 0,
          aspect_ratio: '16:9', speed: 1.0,
          text_overlay: '', text_x: '(w-text_w)/2', text_y: 'h-text_h-20',
          text_color: 'white', text_size: 24,
          effects: [],
          // New professional filters
          volume: 100, muted: false,
          audio_fade_in: 0, audio_fade_out: 0,
          rotation: 0, zoom: 1.0, x_zoom: 0, y_zoom: 0,
          reverse: false
        }
      }));
      setSegments(init);
      setOriginalSegments(JSON.parse(JSON.stringify(init)));
    }
  }, [resultData]);

  const activeSegment = segments.find(s => s.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = segments.findIndex(s => s.id === active.id);
      const newIndex = segments.findIndex(s => s.id === over.id);
      setSegments(arrayMove(segments, oldIndex, newIndex));
    }
  };

  const handleSelect = (id) => {
    setActiveId(id);
    const seg = segments.find(s => s.id === id);
    if (seg && playerRef.current) {
      playerRef.current.seekTo(seg.start_sec, 'seconds');
      setIsPlaying(true);
    }
  };

  const handleUpdate = useCallback((id, updatedSegment) => {
    setSegments(prev => prev.map(s => s.id === id ? updatedSegment : s));
  }, []);

  const handleDelete = () => {
    if (activeId) {
      setSegments(prev => prev.filter(s => s.id !== activeId));
      setActiveId(null);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all clips to auto-detected segments?')) {
      setSegments(JSON.parse(JSON.stringify(originalSegments)));
      setActiveId(null);
    }
  };

  const updateFilter = (key, value) => {
    if (!activeSegment) return;
    handleUpdate(activeId, {
      ...activeSegment,
      filters: { ...activeSegment.filters, [key]: value }
    });
  };

  const toggleEffect = (effect) => {
    if (!activeSegment) return;
    const fx = activeSegment.filters.effects || [];
    const next = fx.includes(effect) ? fx.filter(e => e !== effect) : [...fx, effect];
    updateFilter('effects', next);
  };

  const submitRender = async () => {
    if (!segments.length) return alert("You must have at least one clip to render.");
    const invalid = segments.find(s => s.start_sec >= s.end_sec - 0.5 || s.start_sec < 0);
    if (invalid) return alert("Invalid segment times detected. Each clip must be at least 0.5s long.");

    setRendering(true);
    setRenderDone(false);
    try {
      const payload = {
        task_id: taskId,
        original_video_path: rawVideoPath,
        segments: segments.map(s => ({ start_sec: s.start_sec, end_sec: s.end_sec, score: s.score || 0, filters: s.filters }))
      };
      const res = await axios.post('http://127.0.0.1:8000/render', payload);
      if (res.data.error) {
        alert("Render Pipeline Error: " + res.data.error);
      } else {
        setRenderDone(true);
        setTimeout(() => {
          onRenderComplete(res.data.file, segments);
        }, 800);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to render video");
    } finally {
      setRendering(false);
    }
  };

const tabs = [
    { key: 'trim', label: 'Trim', icon: Scissors },
    { key: 'audio', label: 'Audio', icon: Volume2 },
    { key: 'color', label: 'Color', icon: Wand2 },
    { key: 'text', label: 'Text', icon: Type },
    { key: 'speed', label: 'Speed', icon: Gauge },
    { key: 'effects', label: 'Effects', icon: Sparkles },
    { key: 'transform', label: 'Transform', icon: RotateCw },
    { key: 'aspect', label: 'Aspect', icon: Crop },
  ];

  // Timeline helper functions
  const handleSplit = () => {
    if (!activeSegment) return;
    const duration = activeSegment.end_sec - activeSegment.start_sec;
    if (duration < 1.0) return alert("Clip too short to split");
    
    const midPoint = activeSegment.start_sec + duration / 2;
    const newSegment = {
      ...activeSegment,
      id: `${activeSegment.id}-split-${Date.now()}`,
      start_sec: midPoint,
      filters: { ...activeSegment.filters }
    };
    handleUpdate(activeId, { ...activeSegment, end_sec: midPoint });
    setSegments(prev => [...prev, newSegment]);
  };

  const handleDuplicate = () => {
    if (!activeSegment) return;
    const newSegment = {
      ...activeSegment,
      id: `${activeSegment.id}-dup-${Date.now()}`,
      filters: { ...activeSegment.filters }
    };
    setSegments(prev => [...prev, newSegment]);
  };

  const rotationOptions = [0, 90, 180, 270];
  const zoomOptions = [1.0, 1.25, 1.5, 2.0];
  const volumeOptions = [0, 25, 50, 75, 100, 125, 150, 200];

  const aspectOptions = [
    { value: '16:9', label: 'Landscape (16:9)' },
    { value: '9:16', label: 'Portrait (9:16)' },
    { value: '1:1', label: 'Square (1:1)' },
  ];

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const effectList = ['sepia', 'blur', 'sharpen', 'vignette'];

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden flex flex-col h-[800px]">
      {/* Editor Header */}
      <div className="bg-[#0B0F19] px-6 py-4 border-b border-[#1F2937] flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
            <Scissors className="text-[#D97706] w-5 h-5" />
            <span>Studio Editor</span>
          </h2>
          <p className="text-gray-600 text-xs mt-0.5">Refine your clips before final export</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 text-gray-500 hover:text-gray-300 transition-colors text-sm px-3 py-2"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            onClick={submitRender}
            disabled={rendering || renderDone}
            className="bg-[#D97706] hover:bg-[#B45309] text-white px-5 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-40 text-sm"
          >
            {rendering ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : renderDone ? (
              <CheckCircle size={16} />
            ) : (
              <Save size={16} />
            )}
            <span>{rendering ? "Rendering..." : renderDone ? "Done" : "Export Video"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col border-r border-[#1F2937] bg-black relative">
          <div className="flex-1 relative">
            {rawVideoPath ? (
              <ReactPlayer
                ref={playerRef}
                url={`http://127.0.0.1:8000${rawVideoPath}`}
                playing={isPlaying}
                controls={true}
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">No video loaded</div>
            )}
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-96 bg-[#0B0F19] flex flex-col border-l border-[#1F2937]">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-[#1F2937]">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center space-x-1 px-3 py-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === t.key ? 'text-[#D97706] border-b-2 border-[#D97706] bg-[#D97706]/5' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <t.icon size={14} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              {activeSegment ? (
                <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">

{/* Trim Tab */}
                  {activeTab === 'trim' && (
                    <div className="space-y-4">
                      <div className="bg-[#111827] p-4 rounded-lg border border-[#1F2937]">
                        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Start Time (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          value={activeSegment.start_sec.toFixed(2)}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const clamped = Math.max(0, Math.min(val, activeSegment.end_sec - 0.5));
                            handleUpdate(activeId, { ...activeSegment, start_sec: clamped });
                          }}
                          className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 focus:outline-none focus:border-[#D97706] text-sm"
                        />
                      </div>
                      <div className="bg-[#111827] p-4 rounded-lg border border-[#1F2937]">
                        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">End Time (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          value={activeSegment.end_sec.toFixed(2)}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const clamped = Math.max(activeSegment.start_sec + 0.5, val);
                            handleUpdate(activeId, { ...activeSegment, end_sec: clamped });
                          }}
                          className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 focus:outline-none focus:border-[#D97706] text-sm"
                        />
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Duration</span>
                        <span className="text-[#D97706] font-semibold">{(activeSegment.end_sec - activeSegment.start_sec).toFixed(2)}s</span>
                      </div>
                      
                      {/* Timeline Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={handleSplit}
                          className="flex items-center justify-center space-x-2 bg-[#111827] hover:bg-[#1F2937] text-gray-400 font-medium py-2.5 rounded-lg border border-[#374151] transition-colors text-sm"
                        >
                          <CutIcon size={14} /> <span>Split</span>
                        </button>
                        <button
                          onClick={handleDuplicate}
                          className="flex items-center justify-center space-x-2 bg-[#111827] hover:bg-[#1F2937] text-gray-400 font-medium py-2.5 rounded-lg border border-[#374151] transition-colors text-sm"
                        >
                          <Copy size={14} /> <span>Duplicate</span>
                        </button>
                      </div>
                      
                      <div className="pt-2">
                        <button
                          onClick={handleDelete}
                          className="w-full bg-red-500/5 hover:bg-red-500/10 text-red-400 font-medium py-2.5 rounded-lg border border-red-500/10 transition-colors flex justify-center items-center space-x-2 text-sm"
                        >
                          <Trash2 size={16} /> <span>Remove Clip</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audio Tab */}
                  {activeTab === 'audio' && (
                    <div className="space-y-5">
                      {/* Volume Control */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400 font-medium">Volume</span>
                          <span className="text-[#D97706]">{activeSegment.filters.volume || 100}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={5}
                          value={activeSegment.filters.volume || 100}
                          onChange={(e) => updateFilter('volume', parseFloat(e.target.value))}
                          className="w-full accent-[#D97706]"
                        />
                      </div>
                      
                      {/* Mute Toggle */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Mute Audio</span>
                        <button
                          onClick={() => updateFilter('muted', !activeSegment.filters.muted)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            activeSegment.filters.muted ? 'bg-red-500' : 'bg-[#374151]'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            activeSegment.filters.muted ? 'left-7' : 'left-1'
                          }`} />
                        </button>
                      </div>
                      
                      {/* Audio Fade In */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400 font-medium">Fade In</span>
                          <span className="text-[#D97706]">{activeSegment.filters.audio_fade_in || 0}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          value={activeSegment.filters.audio_fade_in || 0}
                          onChange={(e) => updateFilter('audio_fade_in', parseFloat(e.target.value))}
                          className="w-full accent-[#D97706]"
                        />
                      </div>
                      
                      {/* Audio Fade Out */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400 font-medium">Fade Out</span>
                          <span className="text-[#D97706]">{activeSegment.filters.audio_fade_out || 0}s</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          value={activeSegment.filters.audio_fade_out || 0}
                          onChange={(e) => updateFilter('audio_fade_out', parseFloat(e.target.value))}
                          className="w-full accent-[#D97706]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Transform Tab */}
                  {activeTab === 'transform' && (
                    <div className="space-y-5">
                      {/* Rotation */}
                      <div>
                        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Rotation</label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {rotationOptions.map(ang => (
                            <button
                              key={ang}
                              onClick={() => updateFilter('rotation', ang)}
                              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                (activeSegment.filters.rotation || 0) === ang
                                  ? 'bg-[#D97706] text-white'
                                  : 'bg-[#111827] text-gray-400 border border-[#374151] hover:border-gray-500'
                              }`}
                            >
                              {ang}°
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Ken Burns Zoom */}
                      <div>
                        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Ken Burns Zoom</label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {zoomOptions.map(z => (
                            <button
                              key={z}
                              onClick={() => updateFilter('zoom', z)}
                              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                                Math.abs((activeSegment.filters.zoom || 1.0) - z) < 0.01
                                  ? 'bg-[#D97706] text-white'
                                  : 'bg-[#111827] text-gray-400 border border-[#374151] hover:border-gray-500'
                              }`}
                            >
                              {z}x
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Reverse Video */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-gray-400 text-sm">Reverse Video</span>
                        <button
                          onClick={() => updateFilter('reverse', !activeSegment.filters.reverse)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${
                            activeSegment.filters.reverse ? 'bg-[#D97706]' : 'bg-[#374151]'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            activeSegment.filters.reverse ? 'left-7' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Color Tab */}
                  {activeTab === 'color' && (
                    <div className="space-y-5">
                      {[
                        { key: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.05 },
                        { key: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.05 },
                        { key: 'saturation', label: 'Saturation', min: 0, max: 3, step: 0.05 },
                        { key: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.05 },
                      ].map(ctrl => (
                        <div key={ctrl.key}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400 font-medium">{ctrl.label}</span>
                            <span className="text-[#D97706]">{activeSegment.filters[ctrl.key]?.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={ctrl.min}
                            max={ctrl.max}
                            step={ctrl.step}
                            value={activeSegment.filters[ctrl.key]}
                            onChange={(e) => updateFilter(ctrl.key, parseFloat(e.target.value))}
                            className="w-full accent-[#D97706]"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text Tab */}
                  {activeTab === 'text' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Overlay Text</label>
                        <input
                          type="text"
                          placeholder="Enter text..."
                          value={activeSegment.filters.text_overlay || ''}
                          onChange={(e) => updateFilter('text_overlay', e.target.value)}
                          className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 focus:outline-none focus:border-[#D97706] text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Color</label>
                          <select
                            value={activeSegment.filters.text_color || 'white'}
                            onChange={(e) => updateFilter('text_color', e.target.value)}
                            className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 text-sm"
                          >
                            <option value="white">White</option>
                            <option value="yellow">Yellow</option>
                            <option value="red">Red</option>
                            <option value="black">Black</option>
                            <option value="cyan">Cyan</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Size</label>
                          <input
                            type="number"
                            min={12}
                            max={72}
                            value={activeSegment.filters.text_size || 24}
                            onChange={(e) => updateFilter('text_size', parseInt(e.target.value))}
                            className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">X Position</label>
                          <select
                            value={activeSegment.filters.text_x || '(w-text_w)/2'}
                            onChange={(e) => updateFilter('text_x', e.target.value)}
                            className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 text-sm"
                          >
                            <option value="(w-text_w)/2">Center</option>
                            <option value="20">Left</option>
                            <option value="w-text_w-20">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Y Position</label>
                          <select
                            value={activeSegment.filters.text_y || 'h-text_h-20'}
                            onChange={(e) => updateFilter('text_y', e.target.value)}
                            className="w-full bg-[#0B0F19] border border-[#374151] rounded text-gray-200 px-3 py-2 mt-1 text-sm"
                          >
                            <option value="20">Top</option>
                            <option value="(h-text_h)/2">Middle</option>
                            <option value="h-text_h-20">Bottom</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Speed Tab */}
                  {activeTab === 'speed' && (
                    <div className="space-y-4">
                      <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Playback Speed</label>
                      <div className="grid grid-cols-3 gap-2">
                        {speedOptions.map(spd => (
                          <button
                            key={spd}
                            onClick={() => updateFilter('speed', spd)}
                            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              Math.abs((activeSegment.filters.speed || 1.0) - spd) < 0.01
                                ? 'bg-[#D97706] text-white'
                                : 'bg-[#111827] text-gray-400 border border-[#374151] hover:border-gray-500'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600">Speed changes the clip duration in the final output.</p>
                    </div>
                  )}

                  {/* Effects Tab */}
                  {activeTab === 'effects' && (
                    <div className="space-y-3">
                      <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Video Effects</label>
                      <div className="grid grid-cols-2 gap-3">
                        {effectList.map(fx => {
                          const active = (activeSegment.filters.effects || []).includes(fx);
                          return (
                            <button
                              key={fx}
                              onClick={() => toggleEffect(fx)}
                              className={`py-3 rounded-lg text-sm font-medium capitalize transition-colors border ${
                                active
                                  ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                                  : 'bg-[#111827] text-gray-400 border-[#374151] hover:border-gray-500'
                              }`}
                            >
                              {fx}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Aspect Tab */}
                  {activeTab === 'aspect' && (
                    <div className="space-y-3">
                      <label className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Output Aspect Ratio</label>
                      <div className="space-y-2">
                        {aspectOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateFilter('aspect_ratio', opt.value)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${
                              (activeSegment.filters.aspect_ratio || '16:9') === opt.value
                                ? 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30'
                                : 'bg-[#111827] text-gray-400 border-[#374151] hover:border-gray-500'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <span className="text-xs opacity-70">{opt.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center text-center p-4">
                  <p className="text-gray-600 text-sm">Select a clip in the timeline below to edit its properties.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Timeline Editor Area */}
      <div className="h-40 bg-[#0B0F19] border-t border-[#1F2937] p-5 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-200 font-medium flex items-center text-sm"><List size={14} className="mr-2 text-[#D97706]"/> Timeline Sequence</h3>
          <span className="text-gray-600 text-xs font-medium">{segments.length} clips · {segments.reduce((acc, s) => acc + (s.end_sec - s.start_sec), 0).toFixed(1)}s total</span>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#111827] rounded-lg border border-[#1F2937] p-3 flex items-center space-x-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segments.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              {segments.map((seg, i) => (
                <SortableClip
                  key={seg.id}
                  id={seg.id}
                  segment={seg}
                  index={i}
                  activeSegmentId={activeId}
                  onSelect={handleSelect}
                  onUpdate={handleUpdate}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

