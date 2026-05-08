import React from 'react';
import { motion } from 'framer-motion';
// motion used below

export default function Timeline({ segments = [], durationSeconds = 120 }) {
  return (
    <div className="w-full bg-[#111827] rounded-xl p-5 border border-[#1F2937]">
      <div className="flex justify-between items-center mb-3 text-sm text-gray-500 font-medium">
        <span>Timeline Overview</span>
        <span>{durationSeconds.toFixed(0)}s</span>
      </div>

      <div className="relative h-12 bg-[#0B0F19] rounded-lg overflow-hidden border border-[#1F2937]">
        <div className="absolute inset-0 flex justify-between">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-px h-full bg-[#1F2937]"></div>
          ))}
        </div>

        {segments.map((seg, idx) => {
          const leftPercent = (seg.start_sec / durationSeconds) * 100;
          const widthPercent = ((seg.end_sec - seg.start_sec) / durationSeconds) * 100;

          return (
            <motion.div
              key={idx}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1, type: 'spring' }}
              className="absolute top-0 bottom-0 bg-[#D97706]/80 border-x border-[#D97706] opacity-90 cursor-pointer hover:opacity-100 origin-left rounded-sm"
              style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 0.5)}%` }}
              title={`Clip ${idx + 1}: ${seg.start_sec.toFixed(1)}s - ${seg.end_sec.toFixed(1)}s (Score: ${sigFig(seg.score)})`}
            >
              <div className="w-full h-full flex items-center justify-center">
                 <span className="text-[10px] font-bold text-white px-1 truncate bg-black/20 rounded">{idx + 1}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-5 overflow-x-auto pb-2 custom-scrollbar">
        {segments.map((seg, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (idx * 0.08) }}
            key={idx}
            className="flex-shrink-0 w-44 bg-[#0B0F19] rounded-lg border border-[#1F2937] p-3 hover:border-[#374151] transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="bg-[#D97706]/10 text-[#D97706] text-[10px] font-semibold px-2 py-0.5 rounded">Clip {idx + 1}</span>
              <span className="text-gray-600 text-[10px]">{seg.start_sec.toFixed(1)}s - {seg.end_sec.toFixed(1)}s</span>
            </div>
            <div className="text-gray-400 text-xs font-medium truncate mb-2">Segment Confidence</div>
            <div className="w-full bg-[#1F2937] rounded-full h-1 overflow-hidden">
               <div className="bg-[#D97706] h-full rounded-full" style={{ width: `${Math.min(seg.score * 100, 100)}%` }}></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function sigFig(num) {
  if (num == null) return "0.0";
  return num.toFixed(2);
}

