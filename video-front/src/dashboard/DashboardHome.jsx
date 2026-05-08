import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, FileVideo, CheckCircle, Loader, Activity, Play, List, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import Timeline from '../components/Timeline';
import EditorWorkspace from '../components/EditorWorkspace';
import { formatDuration } from '../lib/formatTime';
import { loadSettings } from '../lib/settings';

export default function DashboardHome() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [backendProgress, setBackendProgress] = useState(0);
  const [backendStep, setBackendStep] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles && acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {'video/*': ['.mp4', '.mov', '.webm', '.avi']},
    maxFiles: 1
  });

  const steps = [
    { label: "Importing Video", icon: UploadCloud },
    { label: "Analyzing Motion", icon: Activity },
    { label: "Processing Audio", icon: Activity },
    { label: "Creating Clips", icon: Play },
  ];

  const stepMapRef = React.useRef({
    "Analyzing motion": 1,
    "Extracting audio": 2,
    "Transcribing audio": 2,
    "Generating clips": 3,
    "Merging video": 3,
  });

  useEffect(() => {
    let intervalId;
    let timeoutId;
    const POLL_INTERVAL = 2000;
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max

    if (status === 'processing' && result?.task_id) {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await axios.get(`http://127.0.0.1:8000/task/${result.task_id}`);
          const taskData = statusRes.data;

          // Reflect real backend step/progress
          if (taskData.step && stepMapRef.current[taskData.step] !== undefined) {
            setProcessingStep(stepMapRef.current[taskData.step]);
          }
          if (taskData.step) setBackendStep(taskData.step);
          if (typeof taskData.progress === 'number') setBackendProgress(taskData.progress);

          if (taskData.status === 'completed' && taskData.result) {
            setResult(taskData.result);
            setProcessingStep(4);
            setTimeout(() => setStatus('preview'), 800);
            clearInterval(intervalId);
            clearTimeout(timeoutId);
          } else if (taskData.status === 'error') {
            alert("Processing failed: " + (taskData.error || "Unknown error"));
            setStatus('idle');
            clearInterval(intervalId);
            clearTimeout(timeoutId);
          } else if (taskData.status === 'not_found') {
            alert("Task not found on server. The server may have restarted.");
            setStatus('idle');
            clearInterval(intervalId);
            clearTimeout(timeoutId);
          }
        } catch (err) {
          console.error("Polling error", err);
          // Network errors are silently retried; timeout will catch persistent failures
        }
      }, POLL_INTERVAL);

      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        alert("Processing timed out after 15 minutes. Please check the server logs or try a shorter video.");
        setStatus('idle');
      }, TIMEOUT_MS);
    }
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [status, result]);

  const handleUpload = async () => {
    if (!file || !title) return alert("Please provide a project name and select a video file.");

    setStatus('processing');
    setProcessingStep(1);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    const settings = loadSettings();
    formData.append('max_clips', String(settings.maxClips));
    formData.append('enable_audio', String(settings.enableAudio));

    try {
      const res = await axios.post('http://127.0.0.1:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setStatus('idle');
      alert("Failed to queue video.");
    }
  };

  const handleRenderComplete = (fileUrl, editedSegments) => {
    setResult(prev => ({ ...prev, file: fileUrl, segments: editedSegments }));
    setStatus('complete');
  };

  const handleGoToEditor = () => {
    setStatus('editor');
  };

  const handleExportDirect = () => {
    setStatus('complete');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto block min-h-full">
      <div className="mb-8 block">
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">New Project</h1>
        <p className="text-gray-500 text-base">Import your footage and let the system analyze it to find the best moments.</p>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
            className="bg-[#111827] p-8 rounded-xl border border-[#1F2937] flex flex-col md:flex-row gap-8"
          >
            <div className="flex-1 space-y-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[250px] ${
                  file ? 'border-[#D97706] bg-[#D97706]/5' : isDragActive ? 'border-gray-500 bg-[#151B2B]' : 'border-[#374151] hover:border-gray-500 bg-[#0B0F19]'
                }`}
              >
                <input {...getInputProps()} />

                {file ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center space-y-3">
                    <div className="p-4 bg-[#D97706]/10 rounded-full">
                      <FileVideo className="text-[#D97706] w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-gray-200 font-medium text-base">{file.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="p-4 bg-[#1F2937] rounded-full">
                      <UploadCloud className="text-gray-400 w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-gray-300 font-medium text-base">Drag & drop your video file</p>
                      <p className="text-gray-500 mt-1 text-sm">Supports MP4, MOV, WebM, AVI</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div>
                <label className="block text-gray-300 font-medium mb-2 text-sm">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. 'Family Vacation', 'Product Demo'"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#374151] rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:border-[#D97706] transition-colors placeholder:text-gray-600"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleUpload}
                disabled={!file || !title}
                className="w-full flex items-center justify-center space-x-2 bg-[#D97706] hover:bg-[#B45309] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Film size={18} />
                <span>Create Project</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {status === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111827] p-10 rounded-xl border border-[#1F2937] max-w-2xl mx-auto"
          >
            <div className="text-center mb-10">
              <div className="relative inline-flex mb-6">
                <div className="w-16 h-16 bg-[#D97706]/10 rounded-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-[#D97706]" />
                </div>
                <div className="absolute inset-0 border-2 border-t-[#D97706] border-r-[#D97706] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">Processing your video</h2>
              <p className="text-gray-500 text-sm">{backendStep || 'Initializing...'} — {backendProgress}%</p>
              <div className="mt-4 h-2 w-full bg-[#1F2937] rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${backendProgress}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-[#D97706]"
                />
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step, i) => {
                const isCompleted = processingStep > i;
                const isCurrent = processingStep === i;

                return (
                  <div key={i} className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                      ${isCompleted ? 'bg-emerald-500/10' : isCurrent ? 'bg-[#D97706]/10' : 'bg-[#1F2937]'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Loader className="w-4 h-4 text-[#D97706] animate-spin" />
                      ) : (
                        <step.icon className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${isCurrent || isCompleted ? 'text-gray-200' : 'text-gray-600'}`}>{step.label}</h4>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {status === 'preview' && result && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937] flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">Your Highlight is Ready</h2>
                <p className="text-gray-500 text-sm mt-1">Project: <span className="text-gray-300 font-medium">{result.title}</span></p>
              </div>
              <button onClick={() => { setStatus('idle'); setFile(null); setTitle(''); setResult(null); }} className="bg-[#1F2937] hover:bg-[#374151] text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm">New Project</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="aspect-video bg-black rounded-xl overflow-hidden border border-[#1F2937]">
                  {result.file ? (
                    <video controls className="w-full h-full object-contain bg-black" src={`http://127.0.0.1:8000${result.file}`} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-600">Asset Error</div>
                  )}
                </div>
              </div>

              <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937] flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-100 mb-4">What would you like to do?</h3>
                  <div className="space-y-3">
                    <button
                      onClick={handleExportDirect}
                      className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors text-sm"
                    >
                      <Play size={16} /> <span>Export Video</span>
                    </button>
                    <button
                      onClick={handleGoToEditor}
                      className="w-full flex items-center justify-center space-x-2 bg-[#D97706] hover:bg-[#B45309] text-white font-medium py-3 rounded-lg transition-colors text-sm"
                    >
                      <Film size={16} /> <span>Edit Manually</span>
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  <p>Export downloads the auto-generated highlight.</p>
                  <p className="mt-1">Edit opens the studio with trimming, filters, text, speed & aspect ratio tools.</p>
                </div>
              </div>
            </div>

            {result.segments && result.segments.length > 0 && (
              <Timeline segments={result.segments} durationSeconds={result.segments[result.segments.length-1].end_sec + 5} />
            )}
          </motion.div>
        )}

        {status === 'editor' && result && (
          <motion.div
            key="editor"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <EditorWorkspace
              taskId={result.id}
              resultData={result}
              rawVideoPath={result.raw_file}
              onRenderComplete={handleRenderComplete}
            />
          </motion.div>
        )}

        {status === 'complete' && result && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-[#111827] p-6 rounded-xl border border-emerald-500/20 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="bg-emerald-500/10 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-100">Project Complete</h2>
                  <p className="text-gray-500 text-sm">Project: <span className="text-gray-300 font-medium">{result.title}</span></p>
                </div>
              </div>
              <button onClick={() => { setStatus('idle'); setFile(null); setTitle(''); setResult(null); }} className="bg-[#1F2937] hover:bg-[#374151] text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm">New Project</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="aspect-video bg-black rounded-xl overflow-hidden border border-[#1F2937]">
                  {result.file ? (
                    <video controls className="w-full h-full object-contain bg-black" src={`http://127.0.0.1:8000${result.file}`} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-600">Asset Error</div>
                  )}
                </div>
              </div>

              <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937] flex flex-col justify-between">
                <div>
                   <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center"><List size={16} className="mr-2 text-[#D97706]"/> Project Details</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between border-b border-[#1F2937] pb-3">
                         <span className="text-gray-500 text-sm">Processing Time</span>
                         <span className="text-gray-300 text-sm font-medium">{formatDuration(result.processing_time || 0)}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1F2937] pb-3">
                         <span className="text-gray-500 text-sm">Clips Created</span>
                         <span className="text-gray-300 text-sm font-medium">{result.segments?.length || 0} clips</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1F2937] pb-3">
                         <span className="text-gray-500 text-sm">Analysis Type</span>
                         <span className="text-[#D97706] text-sm font-medium">Motion + Audio + NLP</span>
                      </div>
                   </div>
                </div>

                <div className="mt-8">
                  {result.file && (
                    <a href={`http://127.0.0.1:8000${result.file}`} download target="_blank" rel="noreferrer" className="w-full flex items-center justify-center space-x-2 bg-[#D97706] hover:bg-[#B45309] text-white font-medium py-3 rounded-lg transition-colors text-sm">
                      <Play size={14} /> <span>Download Video</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {result.segments && result.segments.length > 0 && (
              <Timeline segments={result.segments} durationSeconds={result.segments[result.segments.length-1].end_sec + 5} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

