import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Video, Clock, Scissors, Zap, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
// motion used for page animations
import axios from 'axios';
import { formatDuration } from '../lib/formatTime';

export default function Analytics() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/history');
        const data = res.data.history || [];
        setHistory([...data].reverse());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const downloadMatrix = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/matrix', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'analytics_matrix.png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading matrix:', err);
    }
  };

  const totalVideos = history.length;
  const totalClips = history.reduce((acc, item) => acc + (item.segments?.length || 0), 0);
  const totalProcessingTime = history.reduce((acc, item) => acc + (item.processing_time || 0), 0);
  const avgProcessTime = totalVideos > 0 ? (totalProcessingTime / totalVideos).toFixed(1) : '0';

  let avgMotion = 0, avgAudio = 0, avgSemantic = 0, avgFinal = 0;
  if (totalClips > 0) {
    history.forEach(video => {
      (video.scores || []).forEach(score => {
        avgMotion += score.motion || 0;
        avgAudio += score.audio || 0;
        avgSemantic += score.semantic || 0;
        avgFinal += score.final || 0;
      });
    });
    avgMotion = (avgMotion / totalClips * 100).toFixed(1);
    avgAudio = (avgAudio / totalClips * 100).toFixed(1);
    avgSemantic = (avgSemantic / totalClips * 100).toFixed(1);
    avgFinal = (avgFinal / totalClips * 100).toFixed(1);
  }

  const graphData = history.slice(-15).map((item, idx) => {
     let avgScore = 0;
     if (item.segments && item.segments.length > 0) {
       avgScore = item.segments.reduce((acc, s) => acc + s.score, 0) / item.segments.length;
     }

     let displayTitle = item.title;
     if (!displayTitle || displayTitle.length < 2) {
       displayTitle = `Video ${idx + 1}`;
     } else if (displayTitle.length > 10) {
       displayTitle = displayTitle.substring(0, 10) + '...';
     }

     return {
       title: displayTitle,
       score: parseFloat((avgScore * 100).toFixed(1))
     }
  });

  const scoreBreakdown = [
    { name: 'Motion', value: parseFloat(avgMotion), fill: '#8b5cf6' },
    { name: 'Audio', value: parseFloat(avgAudio), fill: '#059669' },
    { name: 'Semantic', value: parseFloat(avgSemantic), fill: '#D97706' },
    { name: 'Final', value: parseFloat(avgFinal), fill: '#3b82f6' },
  ];

  const stats = [
    { label: 'Projects', value: totalVideos.toString(), icon: Video, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Avg Processing Time', value: formatDuration(parseFloat(avgProcessTime)), icon: Clock, color: 'text-gray-400', bg: 'bg-gray-400/10' },
    { label: 'Clips Created', value: totalClips.toString(), icon: Scissors, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Total Processing Time', value: formatDuration(totalProcessingTime), icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-10 h-10 text-[#D97706] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-6xl mx-auto block min-h-full"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">Reports</h1>
        <p className="text-gray-500 text-base">View statistics and performance metrics for your projects.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={i}
            className="bg-[#111827] p-5 rounded-xl border border-[#1F2937] flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{stat.label}</p>
              <h3 className="text-xl font-semibold text-gray-100 mt-0.5">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mb-6 flex justify-start space-x-3">
        <button onClick={downloadMatrix} className="bg-[#D97706] hover:bg-[#B45309] text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm">
          Download Matrix
        </button>
        <button onClick={() => setShowMatrix(!showMatrix)} className="bg-[#1F2937] hover:bg-[#374151] text-gray-300 font-medium py-2 px-5 rounded-lg transition-colors text-sm">
          {showMatrix ? 'Hide' : 'View'} Matrix
        </button>
        <button onClick={() => setShowCharts(!showCharts)} className="bg-[#1F2937] hover:bg-[#374151] text-gray-300 font-medium py-2 px-5 rounded-lg transition-colors text-sm">
          {showCharts ? 'Hide' : 'View'} Charts
        </button>
      </div>

      {showMatrix && (
        <div className="mb-6 flex justify-center">
          <img src="http://127.0.0.1:8000/matrix" alt="Analytics Matrix" className="max-w-full h-auto border border-[#1F2937] rounded-lg" />
        </div>
      )}

      {showCharts && (
        <div className="mb-6 space-y-6">
          <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937]">
            <h3 className="text-base font-medium text-gray-200 mb-4">Score Heatmap</h3>
            <img src="http://127.0.0.1:8000/chart/heatmap" alt="Score Heatmap" className="w-full h-auto rounded-lg" />
          </div>
          <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937]">
            <h3 className="text-base font-medium text-gray-200 mb-4">Score Trends</h3>
            <img src="http://127.0.0.1:8000/chart/trend" alt="Score Trends" className="w-full h-auto rounded-lg" />
          </div>
          <div className="bg-[#111827] p-6 rounded-xl border border-[#1F2937]">
            <h3 className="text-base font-medium text-gray-200 mb-4">Bar Chart</h3>
            <img src="http://127.0.0.1:8000/chart/bar" alt="Grouped Bars" className="w-full h-auto rounded-lg" />
          </div>
        </div>
      )}

      <div className="bg-[#111827] p-8 rounded-xl border border-[#1F2937]">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-100">Average Scores</h2>
            <p className="text-sm text-gray-500 mt-1">Average confidence scores across recent projects.</p>
          </div>
          <select className="bg-[#0B0F19] border border-[#374151] text-gray-300 text-sm rounded-lg p-2 focus:ring-[#D97706] focus:border-[#D97706] outline-none">
            <option>Last 15 Projects</option>
            <option>Last 30 Days</option>
            <option>All Time</option>
          </select>
        </div>

        <div className="h-80 w-full mt-4">
          {graphData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-gray-600 border border-dashed border-[#374151] rounded-xl">
              No data available yet. Create some projects first!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis dataKey="title" stroke="#6B7280" tick={{fill: '#6B7280', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B7280" tick={{fill: '#6B7280', fontSize: 12}} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#D97706' }}
                  formatter={(value) => [`${value}%`, 'Score']}
                />
                <Area type="monotone" dataKey="score" stroke="#D97706" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-[#111827] p-8 rounded-xl border border-[#1F2937] mt-6">
        <h2 className="text-lg font-medium text-gray-100 mb-6">Score Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-gray-500 text-sm mb-4">Average Scores by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBreakdown} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} stroke="#6B7280" tick={{fill: '#6B7280', fontSize: 12}} />
                  <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={80} tick={{fill: '#9CA3AF', fontSize: 12}} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6', borderRadius: '0.5rem' }}
                    formatter={(value) => [`${value}%`, 'Score']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Motion Score</span>
                <span className="text-purple-400 font-semibold">{avgMotion}%</span>
              </div>
              <div className="w-full bg-[#1F2937] rounded-full h-1.5 mt-2">
                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${avgMotion}%` }}></div>
              </div>
            </div>
            <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Audio Score</span>
                <span className="text-emerald-400 font-semibold">{avgAudio}%</span>
              </div>
              <div className="w-full bg-[#1F2937] rounded-full h-1.5 mt-2">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${avgAudio}%` }}></div>
              </div>
            </div>
            <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Semantic Score</span>
                <span className="text-amber-400 font-semibold">{avgSemantic}%</span>
              </div>
              <div className="w-full bg-[#1F2937] rounded-full h-1.5 mt-2">
                <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${avgSemantic}%` }}></div>
              </div>
            </div>
            <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Final Score</span>
                <span className="text-blue-400 font-semibold">{avgFinal}%</span>
              </div>
              <div className="w-full bg-[#1F2937] rounded-full h-1.5 mt-2">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${avgFinal}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] p-8 rounded-xl border border-[#1F2937] mt-6">
        <h2 className="text-lg font-medium text-gray-100 mb-6">Project History</h2>
        {history.length === 0 ? (
          <div className="text-gray-600 text-center py-8 border border-dashed border-[#374151] rounded-xl">
            No projects yet.
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(-10).reverse().map((video, idx) => {
              const avgScore = video.segments?.length
                ? (video.segments.reduce((acc, s) => acc + s.score, 0) / video.segments.length * 100).toFixed(1)
                : 0;
              const duration = video.segments?.length
                ? Math.max(...video.segments.map(s => s.end_sec || 0)).toFixed(1)
                : 0;
              const procTime = video.processing_time?.toFixed(1) || '0';
              return (
                <div key={video.id || idx} className="bg-[#0B0F19] p-4 rounded-lg border border-[#1F2937]">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="text-gray-200 font-medium text-sm">{video.title || `Project ${idx + 1}`}</h3>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {new Date(video.timestamp * 1000).toLocaleDateString()} · {video.segments?.length || 0} clips
                      </p>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="text-[#D97706] font-semibold text-base">{avgScore}%</div>
                        <div className="text-gray-600 text-xs">avg score</div>
                      </div>
                      <div>
                        <div className="text-emerald-400 font-semibold text-base">{duration}s</div>
                        <div className="text-gray-600 text-xs">duration</div>
                      </div>
                      <div>
                        <div className="text-purple-400 font-semibold text-base">{formatDuration(parseFloat(procTime))}</div>
                        <div className="text-gray-600 text-xs">process time</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

