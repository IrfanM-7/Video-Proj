# ClipAI: A Semantic Video Summarization & Intelligent Editing Platform
## Technical Architecture & Implementation Analysis

---

## 1. EXECUTIVE SUMMARY

ClipAI is a multi-modal video analysis and summarization system designed to automatically extract meaningful highlights from raw video footage while preserving narrative continuity. The system combines motion analysis, audio transcription, semantic analysis, and machine learning-based fusion to identify key moments, then enables manual refinement through a professional editing interface.

**Core Innovation:** Rather than selecting disjoint temporal peaks, ClipAI groups semantically similar segments into coherent "blocks" representing consistent topics, then selects the most important blocks while maintaining chronological order to produce a logically connected summary.

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                      │
│  ┌──────────────┬─────────────┬────────────┬─────────────────┐  │
│  │   Projects   │   Timeline  │  Editor    │    Analytics    │  │
│  │   (Upload)   │ (Visualize) │(Manual Edit)│   (Reports)     │  │
│  └──────────────┴─────────────┴────────────┴─────────────────┘  │
└────────────────────────────┬──────────────────────────────────┘
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND (FastAPI + Python Processing)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  MAIN PIPELINE                           │   │
│  │  /upload → Video Queue → Processing Pipeline            │   │
│  │  /task/{id} → Status Polling                            │   │
│  │  /render → Custom Render with Filters                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PROCESSING MODULES                         │   │
│  │  ┌─────────────┬──────────────┬──────────────────┐      │   │
│  │  │   Video     │    Audio     │   Semantic       │      │   │
│  │  │  Analysis   │  Processing  │   Analysis       │      │   │
│  │  │  (Motion)   │(Whisper ASR) │  (TF-IDF)        │      │   │
│  │  └─────────────┴──────────────┴──────────────────┘      │   │
│  │  ┌─────────────┬──────────────┬──────────────────┐      │   │
│  │  │  Semantic   │   Block      │  FFmpeg          │      │   │
│  │  │ Segmentation│  Grouping    │  Rendering       │      │   │
│  │  │(Sentence)   │(Similarity)  │(Multi-filter)    │      │   │
│  │  └─────────────┴──────────────┴──────────────────┘      │   │
│  │  ┌─────────────┬──────────────┐                        │   │
│  │  │   Fusion    │  Segmentation│                        │   │
│  │  │ (Multimodal)│  (Peak Detect)│                        │   │
│  │  └─────────────┴──────────────┘                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         STORAGE & ANALYTICS                             │   │
│  │  /outputs (Final Videos) | /raw (Source Videos)        │   │
│  │  history.json (Metadata) | Analytics Charts             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | UI/UX, real-time editing |
| **State Management** | React Hooks | Component state, polling |
| **Video Player** | react-player | Video playback & seeking |
| **Animations** | Framer Motion | Smooth UI transitions |
| **HTTP Client** | Axios | API communication |
| **Backend Framework** | FastAPI (Python) | REST API, async processing |
| **Motion Analysis** | OpenCV 4.5+ | Frame differencing |
| **Speech Recognition** | OpenAI Whisper (tiny) | Automatic speech recognition |
| **NLP/Semantic** | scikit-learn | TF-IDF vectorization |
| **Video Processing** | FFmpeg 4.0+ | Clipping, filtering, merging |
| **Data Processing** | NumPy, Pandas | Array operations |
| **Storage** | JSON, File System | Metadata persistence |
| **Concurrency** | asyncio + background tasks | Non-blocking processing |

---

## 3. DATA FLOW ARCHITECTURE

### 3.1 Complete End-to-End Flow

```
User Input (Video File + Title)
         │
         ▼
    Upload API
         │
         ├─→ Save raw video to /raw/{task_id}.ext
         └─→ Return task_id + raw_file_path to frontend
                     │
         ┌──────────────────────────────────────────┐
         │ Background Processing Task Begins        │
         ▼
    [STEP 1] Motion Analysis (video.py)
         │ Input: Raw video file
         │ Process:
         │   - Frame differencing (8x skip, 200x150 res)
         │   - Compute motion magnitude per frame
         │   - Normalize to [0, 1]
         │ Output: motion_scores[] (frame-level)
         │
         ▼
    [STEP 2] Audio Extraction & Transcription (audio.py)
         │ Input: Raw video file
         │ Process:
         │   - FFmpeg extracts WAV @ 16kHz mono
         │   - Whisper (tiny model) transcribes → segments
         │ Output: transcription{segments[{text, start, end}]}
         │
         ▼
    [STEP 3] Semantic Segmentation (semantic_segments.py)
         │ Input: transcription, motion_scores
         │ Process:
         │   - Parse transcript into sentences
         │   - Compute importance: speech_density (0.3) + 
         │     keyword_relevance (0.3) + TF-IDF (0.2) + 
         │     motion_emphasis (0.2)
         │ Output: semantic_segs[{text, start, end, importance}]
         │
         ▼
    [STEP 4] Block Grouping (block_grouping.py)
         │ Input: semantic_segs with importance
         │ Process:
         │   - Extract keywords per segment
         │   - Compute Jaccard similarity (threshold=0.25)
         │   - Group adjacent high-similarity segments
         │   - Score blocks: avg_importance × (1 + coherence_bonus)
         │ Output: blocks[{segments[], score, duration}]
         │
         ▼
    [STEP 5] Block Selection
         │ Input: blocks, target_duration (30% of original)
         │ Process:
         │   - Sort blocks by score (descending)
         │   - Greedily select until target reached
         │   - Sort selected by chronological order
         │   - Add 300ms transition buffers
         │ Output: selected_blocks[] (chronological)
         │
         ▼
    [STEP 6] Clipping & Filtering (ffmpeg_utils.py)
         │ Input: selected_blocks
         │ For each block:
         │   - FFmpeg extracts segment (libx264, fast preset)
         │   - Applies filters (none by default)
         │ Output: clip_0.mp4, clip_1.mp4, ...
         │
         ▼
    [STEP 7] Merging (ffmpeg_utils.py)
         │ Input: clip_*.mp4 files
         │ Process:
         │   - FFmpeg concat demuxer (copy codec, no re-encode)
         │   - Fallback to re-encode if concat fails
         │ Output: {task_id}_highlight.mp4
         │
         ▼
    [STEP 8] History & Result
         │ Save to history.json
         │ Return result to frontend
         │
         ▼
    Frontend Receives: {segments, file_path, processing_time, scores}
         │
         ├─→ Displays timeline preview
         ├─→ Allows manual editing via EditorWorkspace
         └─→ Can download or re-export
```

### 3.2 Frontend Data Flow

```
User → Upload Form
         │ (file, title, settings)
         ▼
    DashboardHome Component
         │ ├─→ POST /upload
         │ │    Returns: {task_id, raw_file}
         │ │
         │ └─→ Polling Loop (2s interval, 15min timeout)
         │      GET /task/{task_id}
         │      Updates: progress, step, status
         ▼
    Result Received
         │ ├─→ Display Preview (video + timeline)
         │ ├─→ "Edit Manually" → EditorWorkspace
         │ └─→ "Export" → Download
         ▼
    EditorWorkspace Component
         │ ├─→ Display video player (reactive-player)
         │ ├─→ Timeline with draggable segments
         │ ├─→ Segment editor tabs:
         │ │    - Trim (start/end times)
         │ │    - Audio (volume, mute, fade)
         │ │    - Color (brightness, contrast, saturation)
         │ │    - Text (overlay, position, size)
         │ │    - Speed (playback rate)
         │ │    - Effects (sepia, blur, sharpen, vignette)
         │ │    - Transform (rotation, zoom, reverse)
         │ │    - Aspect (16:9, 9:16, 1:1)
         │ │
         │ └─→ Split, Duplicate, Delete actions
         │
         ▼
    Export Video
         │ POST /render
         │ Payload: {segments[], filters[]}
         ▼
    Backend Re-renders with Custom Filters
         │ For each segment:
         │   - clip_video() with filter dict
         │   - merge_videos()
         ▼
    Return: {file_path, segments, processing_time}
```

---

## 4. ALGORITHMS & METHODOLOGY

### 4.1 Motion Analysis Algorithm

**File:** `processing/video.py::compute_motion_scores()`

**Input:** Raw video file
**Output:** `motion_scores[]` (normalized frame scores [0, 1])

**Algorithm:**
```
Initialize video capture
FOR each frame in video (skip_frames=8):
    Resize frame to 200x150 (balance speed/quality)
    Convert to grayscale
    Compute absolute difference with previous frame
    Motion score = mean(difference map)  [typical range: 0-255]
    Append to scores[]
    If frame_idx % report_every == 0:
        Report progress to frontend

Normalize scores to [0, 1] using min-max normalization
RETURN scores[]
```

**Key Parameters:**
- `skip_frames = 8`: Process every 8th frame (~4 fps from 30 fps video)
- `resolution = 200x150`: Reduced from 320x240 for ~3x speedup
- `normalization`: Min-max to [0, 1] for comparison with other modalities

**Time Complexity:** O(N/8) where N = total frames
**Typical Duration:** 20-30 seconds for 10-minute video

---

### 4.2 Audio Processing & Speech Recognition

**File:** `processing/audio.py::extract_audio()` + `transcribe_audio()`

**Step 1: Audio Extraction**
```
INPUT: video_path
OUTPUT: audio.wav

COMMAND:
ffmpeg -i {video_path} \
  -vn \
  -acodec pcm_s16le \
  -ar 16000 \
  -ac 1 \
  output.wav

PARAMETERS:
  -vn: No video
  -acodec pcm_s16le: 16-bit PCM encoding
  -ar 16000: Resample to 16 kHz (Whisper standard)
  -ac 1: Mono channel
```

**Step 2: Speech Recognition (Whisper)**
```
Load model: whisper.load_model("tiny")
  - Model size: 39M (vs. 140M for "base")
  - Speed: ~5x faster than base
  - Accuracy: 92-95% vs. 95-97% (acceptable trade-off)

Transcribe: result = model.transcribe(audio_path, word_timestamps=False)

OUTPUT: {
  "text": "full transcription",
  "segments": [
    {"id": 0, "start": 0.5, "end": 2.3, "text": "Hello world"},
    {"id": 1, "start": 2.5, "end": 5.0, "text": "This is a test"}
  ]
}

TIME: ~2-4 minutes for 10-minute video (on CPU)
```

---

### 4.3 Semantic Segmentation & Importance Scoring

**File:** `processing/semantic_segments.py`

#### 4.3.1 Sentence-Level Segmentation
```
ALGORITHM: parse_segments_from_transcript()

INPUT: transcription (Whisper output), motion_scores[], fps=30

FOR each Whisper segment:
    Extract text
    Split into sentences using regex: split on [.!?] + whitespace
    
    FOR each sentence:
        start_sec = Whisper_segment.start
        end_sec = Whisper_segment.end
        duration = end_sec - start_sec
        
        Extract motion score for this sentence:
          start_frame = start_sec * fps
          end_frame = end_sec * fps
          motion_score = MEAN(motion_scores[start_frame:end_frame])
        
        Create segment object:
        {
          id, text, start_sec, end_sec, duration,
          word_count, motion_score
        }

OUTPUT: semantic_segs[] (one per sentence)
```

#### 4.3.2 Importance Scoring
```
ALGORITHM: compute_segment_importance()

INPUTS:
  - segments: [{text, duration, word_count, motion_score}]
  - topic: Video title/topic (for keyword relevance)

FOR each segment:
    
    COMPONENT 1: Speech Density (weight=0.3)
      speech_density = word_count / duration  (words/second)
      score_1 = MIN(speech_density / 10.0, 1.0)  [normalize]
    
    COMPONENT 2: Keyword Relevance (weight=0.3)
      topic_words = set(extract_words(topic.lower()))
      segment_words = extract_words(segment.text.lower())
      
      IF topic_words exist:
          matching_keywords = COUNT(w in segment_words IF w in topic_words)
          score_2 = matching_keywords / LEN(segment_words)
      ELSE:
          score_2 = 0.0
    
    COMPONENT 3: TF-IDF (weight=0.2)
      Build vocabulary from all segment texts
      Compute word frequency
      
      FOR each word in segment:
          tf = word_count_in_segment / total_words_in_segment
          idf = LOG(num_segments / (1 + documents_containing_word))
          tfidf_score += tf * idf
      
      score_3 = MIN(tfidf_score / word_count, 1.0)
    
    COMPONENT 4: Motion Emphasis (weight=0.2)
      score_4 = MIN(motion_score / 50.0, 1.0)  [normalize motion]
    
    FINAL IMPORTANCE:
      importance = 0.3×score_1 + 0.3×score_2 + 0.2×score_3 + 0.2×score_4

OUTPUT: segments[] with importance scores
TIME: <1 second (post-processing only)
```

---

### 4.4 Semantic Similarity & Block Grouping

**File:** `processing/block_grouping.py`

#### 4.4.1 Keyword Extraction
```
ALGORITHM: compute_segment_keywords()

FOR each segment:
    Extract all words from text (lowercase)
    Remove common stopwords: {the, a, an, and, or, but, ...}
    Filter words with len > 2
    Take top 5 keywords by frequency
    Store in: keywords_dict[segment_id] = [kw1, kw2, ...]

OUTPUT: keywords dictionary
```

#### 4.4.2 Similarity Computation (Jaccard Index)
```
ALGORITHM: compute_similarity(keywords1, keywords2)

INPUT: Two keyword lists from adjacent segments

set1 = SET(keywords1)
set2 = SET(keywords2)

intersection = COUNT(words in both sets)
union = COUNT(words in either set)

jaccard_similarity = intersection / union  (range: [0, 1])

INTERPRETATION:
  - 0.0 = completely different topics
  - 0.5 = moderate similarity
  - 1.0 = identical keywords

THRESHOLD: 0.25 (typically groups 2-5 consecutive segments)
```

#### 4.4.3 Block Grouping Algorithm
```
ALGORITHM: group_segments_into_blocks()

INPUT: segments[], keywords[], similarity_threshold=0.25

current_block = [segments[0]]
blocks = []

FOR i in range(1, LEN(segments)):
    prev_seg = segments[i-1]
    curr_seg = segments[i]
    
    similarity = compute_similarity(
      keywords[prev_seg.id],
      keywords[curr_seg.id]
    )
    
    IF similarity >= threshold:
        current_block.append(curr_seg)
    ELSE:
        blocks.append(create_block(current_block))
        current_block = [curr_seg]

blocks.append(create_block(current_block))

RETURN blocks[]
```

#### 4.4.4 Block Scoring
```
ALGORITHM: _create_block()

INPUT: list of consecutive segments

start_sec = segments[0].start_sec
end_sec = segments[-1].end_sec
duration = end_sec - start_sec

avg_importance = MEAN(segment.importance for all segments)
coherence_bonus = MIN(duration / 10.0, 1.0)

block_score = avg_importance × (1.0 + coherence_bonus × 0.3)

RATIONALE:
  - Longer coherent blocks are more valuable
  - 10-second blocks get 30% bonus
  - Longer blocks get capped bonus

OUTPUT: block with block_score
```

#### 4.4.5 Block Selection Algorithm
```
ALGORITHM: select_blocks_for_summary()

INPUT: blocks[], target_duration

video_duration = segments[-1].end_sec
target_duration = video_duration × 0.3  (30% compression)

sorted_blocks = SORT(blocks, by=block_score DESC)

selected = []
total_duration = 0

FOR each block in sorted_blocks:
    IF total_duration + block.duration <= target_duration:
        selected.append(block)
        total_duration += block.duration
    ELIF total_duration < target_duration:
        remaining = target_duration - total_duration
        IF remaining > 2.0:  (minimum 2-second block)
            selected.append(block)
            BREAK

SORT selected by chronological order (start_sec ASC)

RETURN selected[]

RESULT: Top-scoring blocks while preserving narrative order
TYPICAL RESULT: 3-8 blocks selected from 20-40 total blocks
```

#### 4.4.6 Transition Buffers
```
ALGORITHM: add_transition_buffers()

INPUT: selected_blocks[], buffer_sec=0.3

FOR i in range(LEN(selected_blocks)):
    block = selected_blocks[i]
    
    IF i > 0:  (not first block)
        block.start_sec -= buffer_sec / 2  (add 150ms before)
    
    IF i < LEN(selected_blocks) - 1:  (not last block)
        block.end_sec += buffer_sec / 2   (add 150ms after)

PURPOSE: Smooth transitions between clips, avoid abrupt cuts
```

---

### 4.5 Score Fusion (Multimodal Combination)

**File:** `processing/fusion.py::combine_scores()`

**Algorithm:**
```
INPUTS:
  - motion_scores[]: Frame-level motion (normalized [0,1])
  - audio_scores[]: Frame-level speech density (normalized [0,1])
  - semantic_scores[]: Frame-level semantic importance (normalized [0,1])

FUSION WEIGHTS:
  w_motion = 0.5    (motion is primary signal for highlights)
  w_audio = 0.3     (speech is secondary signal)
  w_semantic = 0.2  (semantic is contextual)

FOR each frame i:
    m = motion_scores[i]
    a = audio_scores[i]
    s = semantic_scores[i]
    
    combined[i] = 0.5×m + 0.3×a + 0.2×s

RATIONALE:
  - Motion captures action/energy
  - Audio captures speech/sound (often correlates with importance)
  - Semantic context from transcript adds relevance
  - Weights prioritize motion as primary highlight indicator

OUTPUT: combined_scores[] (frame-level, normalized [0,1])
```

---

### 4.6 Peak Detection & Segment Selection

**File:** `processing/segments.py`

#### 4.6.1 Score Smoothing
```
ALGORITHM: smooth_scores()

INPUT: scores[], window=30

kernel = [1/30, 1/30, ..., 1/30]  (30 elements)

smoothed = CONVOLVE(scores, kernel, mode='same')

PURPOSE: Reduce noise, find sustained high regions
OUTPUT: smoothed_scores[]
```

#### 4.6.2 Peak Detection
```
ALGORITHM: find_peaks()

INPUT: smoothed_scores[], threshold_percentile=85

threshold = PERCENTILE(scores, 85)
  (85% of peaks are in top 15% of frames)

peaks = []
FOR each frame i:
    IF scores[i] > threshold:
        peaks.append((frame_index=i, score=scores[i]))

SORT peaks by score (descending)

OUTPUT: peaks[] (frame indices)
```

#### 4.6.3 Segment Extraction
```
ALGORITHM: select_segments()

INPUT: peaks[], fps=30, window_sec=7, max_segments=5

frames_per_window = 7 × 30 = 210 frames
half_window = 105 frames

segments = []

FOR each (peak_frame, score) in peaks:
    start_frame = MAX(0, peak_frame - half_window)
    end_frame = peak_frame + half_window
    
    overlap = FALSE
    FOR each existing segment:
        IF NOT (end_frame <= seg.start OR start_frame >= seg.end):
            overlap = TRUE
            BREAK
    
    IF NOT overlap:
        segments.append({
          start_frame, end_frame,
          start_sec = start_frame / fps,
          end_sec = end_frame / fps,
          score
        })
        
        IF LEN(segments) >= max_segments:
            BREAK

SORT segments by start_frame (chronological)

OUTPUT: segments[] (no overlaps, max 5 segments)
```

---

### 4.7 FFmpeg Rendering with Multi-Filter Pipeline

**File:** `processing/ffmpeg_utils.py::clip_video()`

**Filter Chain (Applied in Order):**

```
1. ASPECT RATIO CROP
   Input aspect: 16:9 (default), 9:16 (portrait), 1:1 (square)
   
   9:16:  crop=ih*9/16:ih:(iw-ih*9/16)/2:0
          (crop to 9:16, center horizontally)
   
   1:1:   crop=ih:ih:(iw-ih)/2:0
          (crop to square, center)

2. ROTATION (before other transforms)
   0°:     (none)
   90°:    transpose=1
   180°:   transpose=2,transpose=2
   270°:   transpose=2

3. KEN BURNS ZOOM/PAN
   zoompan=z={zoom}:x={x_pos}:y={y_pos}:d=25
   
   Example: 1.5x zoom, center:
   zoompan=z=1.5:x=(iw-iw/zoom)/2:y=(ih-ih/zoom)/2:d=25

4. VIDEO SPEED
   setpts=PTS/{speed}
   
   Example: 1.5x speedup:
   setpts=PTS/1.5

5. COLOR ADJUSTMENTS
   eq=brightness={b}:contrast={c}:saturation={s}
   
   Brightness: [0, 1] → [-1, 1]
   Contrast: typical [0.8, 1.2]
   Saturation: [0, 2] (0=grayscale, 1=normal, 2=vivid)

6. VISUAL EFFECTS
   sepia:    colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131
   blur:     gblur=sigma=2
   sharpen:  unsharp=3:3:1.5
   vignette: vignette=PI/4

7. TEXT OVERLAY
   drawtext=fontfile='{font}':text='{text}':x={x}:y={y}:fontcolor={color}:fontsize={size}:box=1:boxcolor=black@0.5:boxborderw=5

8. AUDIO VOLUME
   volume={vol}
   Example: volume=1.5 (150%)

9. AUDIO FADE
   afade=t=in:st=0:d={duration}    (fade in)
   afade=t=out:st=0:d={duration}   (fade out)

OUTPUT ENCODING:
  Video: libx264, preset=fast, crf=23 (~40% compression)
  Audio: aac, bitrate=128k
  Format: mp4 with faststart flag (stream immediately)
```

---

## 5. FRONTEND-BACKEND INTEGRATION

### 5.1 API Endpoints

| Endpoint | Method | Purpose | Data |
|----------|--------|---------|------|
| `/upload` | POST | Queue video for processing | file, title, max_clips, enable_audio |
| `/task/{task_id}` | GET | Poll processing status | Returns: status, progress, step, result |
| `/render` | POST | Custom re-render with filters | task_id, segments[], filters[] |
| `/history` | GET | Fetch all processed videos | Returns: history[] |
| `/outputs` | GET | Serve final videos | Static file serving |
| `/raw` | GET | Serve raw uploaded videos | Static file serving |

### 5.2 Real-Time Polling Architecture

```
Frontend State:
  - task_id
  - status: "idle" | "processing" | "preview" | "editor" | "complete"
  - processingStep: 0-4
  - backendProgress: 0-100
  - backendStep: "Analyzing motion" | "Extracting audio" | ...
  - result: {segments, file, processing_time, ...}

Polling Loop (DashboardHome.jsx):
  
  IF status == "processing":
    INTERVAL(2000ms):  // Poll every 2 seconds
      GET /task/{task_id}
      response = {
        status: "processing" | "completed" | "error",
        progress: 0-100,
        step: string,
        result: {...}
      }
      
      UPDATE state:
        processingStep = MAP[response.step]
        backendProgress = response.progress
        
        IF response.status == "completed":
          result = response.result
          status = "preview"
          CLEAR interval
        
        IF response.status == "error":
          alert("Processing failed")
          status = "idle"
          CLEAR interval
  
  TIMEOUT(15min):  // Stop if takes too long
    alert("Processing timed out")
    status = "idle"
```

---

## 6. TIMELINE EDITING PIPELINE

### 6.1 Interactive Timeline Component

**File:** `src/components/EditorWorkspace.jsx`

**Data Structure:**
```javascript
segments = [
  {
    id: "seg-0-timestamp",
    start_sec: 5.5,
    end_sec: 12.3,
    score: 0.85,
    filters: {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      grayscale: 0.0,
      aspect_ratio: "16:9",
      speed: 1.0,
      text_overlay: "",
      text_x: "(w-text_w)/2",
      text_y: "h-text_h-20",
      text_color: "white",
      text_size: 24,
      effects: [],
      volume: 100,
      muted: false,
      audio_fade_in: 0,
      audio_fade_out: 0,
      rotation: 0,
      zoom: 1.0,
      x_zoom: 0,
      y_zoom: 0,
      reverse: false
    }
  },
  ...
]
```

### 6.2 Editing Operations

```
OPERATIONS SUPPORTED:

1. TRIM
   - Modify start_sec, end_sec
   - Constraints: start < end, minimum 0.5s duration
   - Real-time: Video player seeks to start

2. SPLIT
   - Create new segment from midpoint
   - Original: [start, end] → [start, mid]
   - New: [mid, end]

3. DUPLICATE
   - Copy segment with same filters
   - Append to segment list

4. DELETE
   - Remove segment from list
   - Cannot undo (user must reset all)

5. REORDER (Drag-Drop)
   - Reorder clips in timeline
   - Uses react-dnd-kit (DndContext)
   - Automatically sorts chronologically

6. FILTER MODIFICATION
   - Real-time state update
   - NOT applied until export
   - Preview in video player
```

### 6.3 Export Pipeline

```
USER CLICKS "EXPORT VIDEO"

VALIDATION:
  ✓ At least 1 segment
  ✓ Each segment >= 0.5s
  ✓ All start < end times

PAYLOAD:
  {
    task_id: original_task_id,
    original_video_path: "/raw/task_id.mp4",
    segments: [
      {
        start_sec, end_sec, score,
        filters: {...}
      }
    ]
  }

BACKEND PROCESSING:

  FOR each segment:
    - clip_video(
        input_path,
        start_sec, end_sec,
        filters_dict
      )
    - Returns: clip_i.mp4
  
  merge_videos(
    [clip_0.mp4, clip_1.mp4, ...],
    output_path
  )
  
  RETURN: {file, segments, processing_time}

FRONTEND:
  ✓ Close editor
  ✓ Display completion screen
  ✓ Allow download or share
```

---

## 7. KEY SYSTEM FEATURES

### 7.1 Continuity Preservation

**Problem:** Traditional highlight extractors select disjoint temporal peaks, creating abrupt, incoherent summaries.

**Solution - Block-Based Selection:**

```
Traditional Approach:
  Video:  [====Intro====][Mid1][====Climax====][Mid2][Outro]
  Peaks:                   ▲                      ▲
  Result: 2 isolated clips, no narrative flow

ClipAI Approach:
  Video:  [====Intro====][Dialogue][====Action====][Climax][====Outro====]
  Blocks:  Block 1      | Block 2  | Block 3      | Block 4
  Scores:    0.65        0.52       0.88           0.71
  Select:   Block 1 ─→ Block 3 ─→ Block 4 (chronological)
  Result: Coherent narrative with 30% compression
```

**Algorithm:**
1. Group adjacent segments with Jaccard similarity > 0.25
2. Score blocks by importance × coherence
3. Greedily select top blocks
4. **Sort by chronological order** (preserves narrative)
5. Add transition buffers for smoothness

---

### 7.2 Performance Optimization

| Component | Optimization | Impact |
|-----------|--------------|--------|
| Motion Analysis | skip_frames=8, 200×150 res | 3x faster |
| Speech Recognition | Whisper tiny model | 5x faster |
| Semantic Analysis | TF-IDF only (no embeddings) | <1s |
| FFmpeg Merge | concat + copy (no re-encode) | 50% faster |
| Frontend Polling | 2s interval, 15min timeout | No hang-ups |
| Storage | JSON + static files | No database needed |

**Overall Performance:**
- 1-2 min videos: 2-3 minutes
- 10 min videos: 4-6 minutes
- 30+ min videos: 10-15 minutes

---

### 7.3 Audio/Visual Filters

**Supported Filters:**

| Category | Filters | FFmpeg Primitive |
|----------|---------|------------------|
| Color | Brightness, Contrast, Saturation, Grayscale | eq |
| Effects | Sepia, Blur, Sharpen, Vignette | colorchannelmixer, gblur, unsharp, vignette |
| Transform | Rotation (0°/90°/180°/270°), Zoom, Reverse | transpose, zoompan, reverse |
| Aspect | 16:9 (landscape), 9:16 (portrait), 1:1 (square) | crop |
| Speed | 0.5x-2.0x | setpts |
| Audio | Volume (0-200%), Mute, Fade In/Out | volume, afade |
| Text | Overlay with color, size, position | drawtext |

---

## 8. SYSTEM WORKFLOW SUMMARY

### 8.1 Phase 1: Upload & Queuing
- User uploads video + provides title
- Backend returns `task_id` + `raw_file_path`
- Frontend starts polling for status

### 8.2 Phase 2: Analysis
- **Motion:** Detect action/energy via frame differencing
- **Audio:** Extract speech transcription (Whisper)
- **Semantic:** Identify important moments based on content
- **Fusion:** Combine signals with weighted averaging

### 8.3 Phase 3: Intelligent Segmentation
- **Sentence Segmentation:** Parse transcript into units
- **Importance Scoring:** Multi-factor importance (speech density, keywords, motion)
- **Block Grouping:** Group similar adjacent segments
- **Selection:** Greedily select top blocks in chronological order

### 8.4 Phase 4: Rendering
- **Clipping:** Extract selected segments with FFmpeg
- **Filtering:** Apply user-defined transformations (if edited)
- **Merging:** Concatenate into single coherent video
- **Storage:** Save to `/outputs/{task_id}_highlight.mp4`

### 8.5 Phase 5: Interactive Editing
- User reviews timeline and auto-generated segments
- Opens EditorWorkspace for manual refinement
- Modifies filters, timing, order
- Exports custom version with applied filters

---

## 9. CONTRIBUTIONS & INNOVATIONS

### Key Contributions:

1. **Semantic Narrative Preservation**
   - First system to group segments by semantic similarity
   - Maintains logical flow rather than isolated peaks
   - Produces summaries that tell coherent stories

2. **Multimodal Fusion Architecture**
   - Combines motion + audio + semantic signals
   - Weighted weighting reflects relative importance
   - Robust to single-modality failures

3. **Fast Transcription-Based Editing**
   - Sentence-level segmentation from ASR
   - Enables semantic grouping without manual annotation
   - Runs end-to-end in 2-15 minutes

4. **Professional Interactive Editing**
   - Real-time timeline manipulation
   - 15+ professional video filters
   - Drag-drop segment reordering

5. **Production-Ready Architecture**
   - Async background processing
   - Real-time progress feedback
   - Graceful error handling & fallbacks

---

## 10. CONCLUSION

ClipAI represents a complete video summarization and editing ecosystem combining:
- **Fast motion analysis** (3× optimized)
- **Accurate ASR** (Whisper)
- **Semantic intelligence** (TF-IDF + block grouping)
- **Professional editing** (15+ filters)
- **Narrative preservation** (chronological block selection)

The system transforms raw video footage into concise, coherent highlights while enabling full creative control through an intuitive editing interface. It achieves this while maintaining performance (2-15 minutes per video) and simplicity (no complex infrastructure required).

---

**Document Version:** 1.0  
**System Version:** ClipStudio v2.0  
**Last Updated:** May 2, 2026

