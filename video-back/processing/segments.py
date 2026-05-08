import numpy as np

def smooth_scores(scores: list, window: int = 5) -> list:
    """ Applies moving average to smooth the score array. """
    if not scores or len(scores) < window: return scores
    kernel = np.ones(window) / window
    smoothed = np.convolve(np.array(scores), kernel, mode='same')
    return smoothed.tolist()

def find_peaks(scores: list, threshold_percentile: int = 85) -> list:
    """ Identifies peaks in the score array above the threshold. """
    if not scores: return []
    threshold = np.percentile(scores, threshold_percentile)
    peaks = []
    for i, s in enumerate(scores):
        if s > threshold:
            peaks.append((i, s))
    # Sort by descending score
    peaks.sort(key=lambda x: x[1], reverse=True)
    return peaks

def select_segments(peaks: list, fps: int = 30, window_sec: int = 10, max_segments: int = 5) -> list:
    """ Converts frame peaks to duration segments out of total frames, resolves overlaps. """
    segments = []
    frames_per_window = window_sec * fps
    half_window = frames_per_window // 2
    
    for peak_frame, score in peaks:
        start_f = max(0, peak_frame - half_window)
        end_f = peak_frame + half_window
        
        # Check overlap
        overlap = False
        for s in segments:
            if not (end_f <= s['start_f'] or start_f >= s['end_f']):
                overlap = True
                break
                
        if not overlap:
            segments.append({
                "start_f": start_f,
                "end_f": end_f,
                "start_sec": start_f / fps,
                "end_sec": end_f / fps,
                "score": score
            })
            if len(segments) >= max_segments:
                break
    
    # Sort segments chronologically
    segments.sort(key=lambda x: x['start_f'])
    return segments
