from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import os
import uuid
import json
import time

from processing.video import compute_motion_scores
from processing.audio import extract_audio, transcribe_audio
from processing.semantic import compute_semantic_scores
from processing.utils import normalize
from processing.fusion import combine_scores
from processing.segments import smooth_scores, find_peaks, select_segments
from processing.ffmpeg_utils import clip_video, merge_videos
from processing.analytics import (
    generate_matrix_image,
    generate_segment_heatmap,
    generate_segment_trend_chart,
    generate_segment_grouped_bar_chart,
    generate_research_charts,
)
# New semantic summarization modules
from processing.semantic_segments import (
    parse_segments_from_transcript,
    compute_segment_importance,
    compute_segment_keywords,
)
from processing.block_grouping import (
    group_segments_into_blocks,
    select_blocks_for_summary,
    add_transition_buffers,
    compute_target_duration,
)

class SegmentDef(BaseModel):
    start_sec: float
    end_sec: float
    score: float = 0.0
    filters: dict = {}

class RenderRequest(BaseModel):
    task_id: str
    original_video_path: str
    segments: List[SegmentDef]


app = FastAPI(title="Video Highlight Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Expose history file outputs
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
app.mount("/raw", StaticFiles(directory=TEMP_DIR), name="raw")

# Track task status in memory
task_status = {}

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Check the status of a processing task"""
    if task_id in task_status:
        return task_status[task_id]
    # Check if already completed (in history)
    with open(HISTORY_FILE, "r") as f:
        history = json.load(f)
        for item in history:
            if item.get("id") == task_id:
                return {"status": "completed", "task_id": task_id, "result": item}
    return {"status": "not_found", "task_id": task_id}

if not os.path.exists(HISTORY_FILE):
    with open(HISTORY_FILE, "w") as f:
        json.dump([], f)

def process_video_pipeline(task_id: str, file_path: str, title: str, max_clips: int = 4, enable_audio: bool = True):
    start_time = time.time()
    task_status[task_id] = {"status": "processing", "task_id": task_id, "progress": 0}
    audio_path = None
    clip_paths = []
    try:
        # Step 1: Video Analysis (Fast frame differencing)
        task_status[task_id]["progress"] = 5
        task_status[task_id]["step"] = "Analyzing motion"
        def motion_progress(pct):
            task_status[task_id]["progress"] = 5 + int(pct * 0.20)  # 5% → 25%
        motion_scores = compute_motion_scores(file_path, skip_frames=3, target_fps=30, progress_callback=motion_progress)
        norm_motion = normalize(motion_scores)

        # Step 2: Audio Analysis (Transcript for semantic segmentation)
        task_status[task_id]["progress"] = 30
        task_status[task_id]["step"] = "Extracting audio"
        audio_path = os.path.join(TEMP_DIR, f"{task_id}.wav")
        transcription = {"text": "", "segments": []}
        audio_ok = False
        if enable_audio:
            audio_ok = extract_audio(file_path, audio_path)
            if audio_ok:
                task_status[task_id]["step"] = "Transcribing audio"
                task_status[task_id]["progress"] = 40
                transcription = transcribe_audio(audio_path)
            else:
                print(f"Audio extraction failed for {task_id}, continuing with motion-only analysis.")
        else:
            print(f"Audio analysis skipped for {task_id} per user settings.")
        
        # Determine Audio Scores per segment
        audio_scores = [0.0] * max(len(norm_motion), 1)
        semantic_scores = [0.0] * max(len(norm_motion), 1)
        
        if "segments" in transcription and transcription["segments"]:
            # Step 3: Semantic Analysis
            sem_scores = compute_semantic_scores(title, transcription["segments"])
            
            # Map segment scores to frames (assuming 30fps)
            fps = 30
            for idx, seg in enumerate(transcription["segments"]):
                start_f = int(seg.get("start", 0) * fps)
                end_f = int(seg.get("end", 0) * fps)
                
                word_count = len(seg.get("text", "").split())
                for i in range(start_f, min(end_f, len(norm_motion))):
                    audio_scores[i] = min(word_count / 10.0, 1.0)
                    semantic_scores[i] = sem_scores[idx]
        
        norm_audio = normalize(audio_scores)
        norm_sem = normalize(semantic_scores)

        # Step 4: Semantic Summarization Pipeline (NEW - preserves narrative continuity)
        task_status[task_id]["progress"] = 50
        task_status[task_id]["step"] = "Semantic analysis"
        
        # Parse transcript into sentence-level segments
        semantic_segs = parse_segments_from_transcript(transcription, norm_motion, fps=30)
        
        if semantic_segs and transcription.get("segments"):
            # Compute importance for each segment
            semantic_segs = compute_segment_importance(semantic_segs, topic=title)
            
            # Extract keywords for similarity computation
            keywords = compute_segment_keywords(semantic_segs)
            
            # Group similar segments into coherent blocks
            blocks = group_segments_into_blocks(semantic_segs, keywords, similarity_threshold=0.25)
            
            # Compute target summary duration (30% of original)
            video_duration = semantic_segs[-1]["end_sec"] if semantic_segs else 0
            target_duration = compute_target_duration(video_duration, compression_ratio=0.3)
            
            # Select top blocks preserving chronological order
            selected_blocks = select_blocks_for_summary(blocks, target_duration)
            
            # Add transition buffers
            selected_blocks = add_transition_buffers(selected_blocks, buffer_sec=0.3)
            
            # Convert blocks to segments format
            segments = [
                {
                    "start_sec": block["start_sec"],
                    "end_sec": block["end_sec"],
                    "score": block["block_score"],
                    "block_type": "semantic"
                }
                for block in selected_blocks
            ]
            
            segment_scores = [
                {
                    "motion": 0.5,
                    "audio": 0.5,
                    "semantic": block["block_score"],
                    "final": block["block_score"]
                }
                for block in selected_blocks
            ]
        else:
            # Fallback to motion-based peak detection if no transcript
            task_status[task_id]["step"] = "Peak detection"
            combined = combine_scores(norm_motion, norm_audio, norm_sem)
            smoothed = smooth_scores(combined, window=30)
            peaks = find_peaks(smoothed, threshold_percentile=85)
            segments = select_segments(peaks, fps=30, window_sec=7, max_segments=max_clips)

            # Compute average scores for each segment
            segment_scores = []
            for s in segments:
                start_f = s["start_f"]
                end_f = s["end_f"]
                if start_f < len(norm_motion) and end_f <= len(norm_motion):
                    avg_motion = sum(norm_motion[start_f:end_f]) / (end_f - start_f) if end_f > start_f else 0
                    avg_audio = sum(norm_audio[start_f:end_f]) / (end_f - start_f) if end_f > start_f else 0
                    avg_sem = sum(norm_sem[start_f:end_f]) / (end_f - start_f) if end_f > start_f else 0
                else:
                    avg_motion = avg_audio = avg_sem = 0
                segment_scores.append({
                    "motion": avg_motion,
                    "audio": avg_audio,
                    "semantic": avg_sem,
                    "final": s["score"]
                })

        # Step 6: Clipping & Merging
        task_status[task_id]["progress"] = 65
        task_status[task_id]["step"] = "Generating clips"
        if not segments:
            raise ValueError("No highlight segments were detected in this video.")

        clip_paths = []
        for i, s in enumerate(segments):
            out_clip = os.path.join(TEMP_DIR, f"{task_id}_clip_{i}.mp4")
            ok = clip_video(file_path, s["start_sec"], s["end_sec"], out_clip)
            if not ok:
                raise RuntimeError(f"Failed to generate clip {i} ({s['start_sec']}s - {s['end_sec']}s)")
            clip_paths.append(out_clip)

        task_status[task_id]["progress"] = 85
        task_status[task_id]["step"] = "Merging video"
        final_out = os.path.join(OUTPUT_DIR, f"{task_id}_highlight.mp4")
        merge_ok = merge_videos(clip_paths, final_out)
        if not merge_ok:
            raise RuntimeError("Failed to merge highlight clips into final video")

        # Step 7: Save History
        history_entry = {
            "id": task_id,
            "title": title,
            "timestamp": time.time(),
            "segments": segments,
            "scores": segment_scores,
            "file": final_out.replace(BASE_DIR, "").replace("\\", "/"),
            "raw_file": file_path.replace(BASE_DIR, "").replace("\\", "/"),
            "processing_time": time.time() - start_time
        }

        # Atomic write to prevent history corruption
        try:
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        except Exception:
            history = []
        history.insert(0, history_entry)
        temp_history = HISTORY_FILE + ".tmp"
        with open(temp_history, "w") as f:
            json.dump(history, f, indent=4)
        os.replace(temp_history, HISTORY_FILE)

        print(f"Task {task_id} completed smoothly in {time.time()-start_time} seconds.")
        task_status[task_id] = {"status": "completed", "task_id": task_id, "result": history_entry}

        # Cleanup temp files
        try:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            for cp in clip_paths:
                if os.path.exists(cp):
                    os.remove(cp)
        except Exception as cleanup_err:
            print(f"Temp cleanup warning for {task_id}: {cleanup_err}")

    except Exception as e:
        print(f"Pipeline failed for {task_id}: {e}")
        task_status[task_id] = {"status": "error", "task_id": task_id, "error": str(e)}
        # Attempt cleanup even on failure
        try:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            for cp in clip_paths:
                if os.path.exists(cp):
                    os.remove(cp)
        except Exception:
            pass

@app.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, title: str = Form(...), file: UploadFile = File(...), max_clips: int = Form(4), enable_audio: bool = Form(True)):
    task_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{task_id}{file_ext}"
    file_path = os.path.join(TEMP_DIR, safe_filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    background_tasks.add_task(process_video_pipeline, task_id, file_path, title, max_clips=max_clips, enable_audio=enable_audio)
    raw_file_path = f"/raw/{safe_filename}"
    return {"message": "Video queued for processing", "task_id": task_id, "title": title, "raw_file": raw_file_path, "id": task_id}

@app.get("/history")
async def get_history():
    with open(HISTORY_FILE, "r") as f:
        return {"history": json.load(f)}

def get_latest_scores():
    with open(HISTORY_FILE, "r") as f:
        history = json.load(f)
    if not history:
        return None, None, "No processed videos"
    
    # Find the entry with the most complete scores (has scores and at least 2 segments)
    best_entry = None
    max_segments = 0
    for entry in history:
        if "scores" in entry and entry["scores"] and len(entry["scores"]) > max_segments:
            max_segments = len(entry["scores"])
            best_entry = entry
    
    if not best_entry or not best_entry["scores"]:
        return None, None, "No scores available"
    return best_entry["scores"], best_entry, None

@app.get("/matrix")
async def get_matrix():
    data, entry, error = get_latest_scores()
    if error:
        return {"error": error}
    output_path = os.path.join(OUTPUT_DIR, "matrix.png")
    generate_matrix_image(data, output_path)
    return FileResponse(output_path, media_type='image/png')

@app.get("/chart/heatmap")
async def get_chart_heatmap():
    data, entry, error = get_latest_scores()
    if error:
        return {"error": error}
    title = entry.get("title", "Video") if entry else "Video"
    output_path = os.path.join(OUTPUT_DIR, "matrix_heatmap.png")
    generate_segment_heatmap(data, output_path, title)
    return FileResponse(output_path, media_type='image/png')

@app.get("/chart/trend")
async def get_chart_trend():
    data, entry, error = get_latest_scores()
    if error:
        return {"error": error}
    title = entry.get("title", "Video") if entry else "Video"
    output_path = os.path.join(OUTPUT_DIR, "segment_score_trends.png")
    generate_segment_trend_chart(data, output_path, title)
    return FileResponse(output_path, media_type='image/png')

@app.get("/chart/bar")
async def get_chart_bar():
    data, entry, error = get_latest_scores()
    if error:
        return {"error": error}
    title = entry.get("title", "Video") if entry else "Video"
    output_path = os.path.join(OUTPUT_DIR, "segment_grouped_scores.png")
    generate_segment_grouped_bar_chart(data, output_path, title)
    return FileResponse(output_path, media_type='image/png')

@app.get("/chart/all")
async def get_chart_all():
    data, entry, error = get_latest_scores()
    if error:
        return {"error": error}
    return {
        "table": "/outputs/matrix.png",
        "heatmap": "/outputs/matrix_heatmap.png",
        "trend": "/outputs/segment_score_trends.png",
        "bar": "/outputs/segment_grouped_scores.png"
    }

@app.delete("/history")
async def clear_history():
    with open(HISTORY_FILE, "w") as f:
        json.dump([], f)
    return {"message": "History cleared"}

@app.get("/")
def read_root(): return {"message": "Active"}

@app.post("/render")
async def render_edited_video(req: RenderRequest):
    try:
        # Convert raw_file route back to absolute path if needed
        # e.g., if req.original_video_path is /temp/123.mp4
        raw_relative = req.original_video_path.lstrip("/")
        abs_path = os.path.join(BASE_DIR, raw_relative)
        
        if not os.path.exists(abs_path):
            return {"error": f"Raw video {abs_path} not found"}

        clip_paths = []
        for i, s in enumerate(req.segments):
            out_clip = os.path.join(TEMP_DIR, f"{req.task_id}_manual_{i}.mp4")
            ok = clip_video(abs_path, s.start_sec, s.end_sec, out_clip, s.filters)
            if not ok:
                return {"error": f"Failed to generate clip {i} ({s.start_sec}s - {s.end_sec}s)"}
            clip_paths.append(out_clip)

        final_out = os.path.join(OUTPUT_DIR, f"{req.task_id}_manual_highlight.mp4")
        merge_ok = merge_videos(clip_paths, final_out)
        if not merge_ok:
            return {"error": "Failed to merge clips into final video"}

        # Save to History
        history_entry = {
            "id": f"{req.task_id}_manual",
            "title": f"Manual Edit",
            "timestamp": time.time(),
            "segments": [s.dict() for s in req.segments],
            "file": final_out.replace(BASE_DIR, "").replace("\\", "/"),
            "raw_file": req.original_video_path,
            "processing_time": 0
        }
        # Atomic write to prevent history corruption
        try:
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        except Exception:
            history = []
        history.insert(0, history_entry)
        temp_history = HISTORY_FILE + ".tmp"
        with open(temp_history, "w") as f:
            json.dump(history, f, indent=4)
        os.replace(temp_history, HISTORY_FILE)

        return {
            "message": "Render complete",
            "file": final_out.replace(BASE_DIR, "").replace("\\", "/")
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
