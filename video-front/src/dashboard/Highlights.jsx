import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Video, Calendar, Download, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// motion and AnimatePresence used for animations

const VideoCard = ({ item, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="bg-[#111827] rounded-xl overflow-hidden border border-[#1F2937] group hover:border-[#374151] transition-all duration-200 flex flex-col"
  >
    <div className="aspect-video bg-[#0B0F19] relative flex items-center justify-center overflow-hidden">
      {item.file ? (
        <video
          controls
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          src={`http://127.0.0.1:8000${item.file}`}
        />
      ) : (
        <Video className="text-gray-700 w-10 h-10" />
      )}

      <div className="absolute top-3 right-3 bg-[#0B0F19]/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-300 border border-[#1F2937]">
        {item.segments?.length || 0} clips
      </div>
    </div>

    <div className="p-5 flex-1 flex flex-col justify-between">
      <div>
        <h3 className="text-base font-medium text-gray-200 truncate mb-1" title={item.title || "Untitled Project"}>{item.title || "Untitled Project"}</h3>
        <div className="flex items-center space-x-3 mt-2 text-sm text-gray-500">
          <span className="flex items-center space-x-1">
            <Calendar size={14} />
            <span>{new Date(item.timestamp * 1000).toLocaleDateString()}</span>
          </span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-[#1F2937] flex justify-between items-center">
        <span className="text-xs text-gray-600 font-mono">#{item.id?.substring(0,6) || "000000"}</span>
        {item.file && (
          <a
            href={`http://127.0.0.1:8000${item.file}`}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-2 text-[#D97706] hover:text-[#B45309] transition-colors text-sm font-medium bg-[#D97706]/5 px-3 py-1.5 rounded-lg"
          >
            <Download size={14} /> <span>Download</span>
          </a>
        )}
      </div>
    </div>
  </motion.div>
);

export default function Highlights() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/history');
      setHistory(res.data.history || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const clearHistory = async () => {
    if(window.confirm("Are you sure you want to delete all projects?")) {
      try {
        await axios.delete('http://127.0.0.1:8000/history');
        setHistory([]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8 max-w-7xl mx-auto block min-h-full"
    >
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Project Library</h1>
          <p className="text-gray-500 mt-1 text-base">All your saved video projects.</p>
        </div>

        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center space-x-2 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-medium px-4 py-2 rounded-lg transition-colors border border-red-500/10 text-sm"
          >
            <Trash2 size={16} />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[#111827] rounded-xl h-[280px] border border-[#1F2937] animate-pulse"></div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-24 bg-[#111827] rounded-2xl border border-[#1F2937]"
        >
          <div className="bg-[#0B0F19] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#1F2937]">
            <FolderOpen size={36} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-200 mb-2">No projects yet</h3>
          <p className="text-gray-500 max-w-md mx-auto text-base mb-6">Go to Projects to create your first video editing project.</p>
        </motion.div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {history.map((item, idx) => (
              <VideoCard key={item.id || idx} item={item} index={idx} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

