import cv2
import numpy as np

def compute_motion_scores(video_path: str, skip_frames: int = 8, target_fps: int = None, progress_callback=None) -> list:
    """ Computes frame-difference motion magnitude per frame. Much faster than optical flow. 
    Optimized: skip_frames=8 for balanced speed/quality (~3x speedup)
    """
    scores = []
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        return scores

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    ret, prev_frame = cap.read()
    if not ret:
        return scores

    prev_frame = cv2.resize(prev_frame, (200, 150))  # Balanced resolution
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)

    frame_idx = 0
    scores.append(0.0)
    max_frames = 200000
    report_every = 500

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx > max_frames:
            print(f"Warning: Reached max frame limit ({max_frames}), stopping motion analysis.")
            break

        if frame_idx % skip_frames != 0:
            scores.append(scores[-1])
        else:
            frame = cv2.resize(frame, (200, 150))
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            diff = cv2.absdiff(prev_gray, gray)
            motion_score = np.mean(diff)
            scores.append(float(motion_score))
            prev_gray = gray

        if progress_callback and frame_idx % report_every == 0:
            pct = min(95, int((frame_idx / total_frames) * 100)) if total_frames > 0 else 0
            progress_callback(pct)

    cap.release()
    return scores
