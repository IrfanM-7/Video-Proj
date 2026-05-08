import subprocess
import os
import tempfile

# Windows font fallback for drawtext
WIN_FONT = "C:/Windows/Fonts/arial.ttf"

def _find_font():
    if os.path.exists(WIN_FONT):
        return WIN_FONT
    # Linux/Mac common paths
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]:
        if os.path.exists(p):
            return p
    return None

def _build_text_srt(text, duration, out_srt_path):
    """Generate a simple SRT file for text overlay."""
    end = f"00:00:{int(duration):02d},000"
    with open(out_srt_path, "w", encoding="utf-8") as f:
        f.write("1\n00:00:00,000 --> {}\n{}\n".format(end, text))

def _speed_to_audio_filter(speed: float) -> str:
    """Build atempo chain for any speed. atempo limits: 0.5 to 2.0 per instance."""
    if abs(speed - 1.0) < 0.01:
        return ""
    filters = []
    remaining = speed
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        filters.append("atempo=0.5")
        remaining /= 0.5
    filters.append(f"atempo={remaining:.3f}")
    return ",".join(filters)

def _build_volume_filter(volume: float, muted: bool = False) -> str:
    """Build volume filter. volume is 0-200%, muted disables audio completely."""
    if muted or volume <= 0:
        return "anull"
    vol = volume / 100.0
    return f"volume={vol}"

def _build_fade_filter(duration: float, fade_type: str = "in") -> str:
    """Build fade filter for audio. fade_type: 'in', 'out', or 'both'"""
    if duration <= 0:
        return ""
    if fade_type == "in":
        return f"afade=t=in:st=0:d={duration}"
    elif fade_type == "out":
        return f"afade=t=out:st=0:d={duration}"
    else:
        return f"afade=t=in:st=0:d={duration},afade=t=out:st=0:d={duration}"

def _build_zoom_filter(zoom: float = 1.0, x_zoom: float = 0, y_zoom: float = 0) -> str:
    """Build Ken Burns zoom/pan effect. zoom: 1.0 = no zoom."""
    if zoom <= 1.0 and x_zoom == 0 and y_zoom == 0:
        return ""
    z = zoom
    x_pos = f"(iw-iw/zoom)/2" if x_zoom == 0 else str(x_zoom)
    y_pos = f"(ih-ih/zoom)/2" if y_zoom == 0 else str(y_zoom)
    return f"zoompan=z={z}:x={x_pos}:y={y_pos}:d=25"

def _build_rotate_filter(angle: float) -> str:
    """Build rotation filter. angle: 90, 180, 270"""
    angle = float(angle)
    if angle == 0 or angle == 360:
        return ""
    if angle == 90:
        return "transpose=1"
    elif angle == 180:
        return "transpose=2,transpose=2"
    elif angle == 270:
        return "transpose=2"
    else:
        return ""

def clip_video(video_path: str, start: float, end: float, out_path: str, filters: dict = None) -> bool:
    """ High-accuracy FFmpeg clipping with advanced filters. """
    if filters is None:
        filters = {}

    duration = end - start
    if duration <= 0:
        print(f"Invalid clip duration {duration}s (start={start}, end={end})")
        return False

    try:
        command = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-i", video_path,
            "-t", str(duration)
        ]

        vf_chain = []
        af_chain = []

# 1. Aspect Ratio Crop
        aspect = filters.get('aspect_ratio', '16:9')
        if aspect == '9:16':
            vf_chain.append("crop=ih*9/16:ih:(iw-ih*9/16)/2:0")
        elif aspect == '1:1':
            vf_chain.append("crop=ih:ih:(iw-ih)/2:0")
        # 16:9 needs no crop

        # 2. Rotation (apply before other transforms)
        rotation = filters.get('rotation', 0)
        rot_filter = _build_rotate_filter(rotation)
        if rot_filter:
            vf_chain.append(rot_filter)

        # 3. Ken Burns Zoom/Pan
        zoom = filters.get('zoom', 1.0)
        x_zoom = filters.get('x_zoom', 0)
        y_zoom = filters.get('y_zoom', 0)
        zoom_filter = _build_zoom_filter(zoom, x_zoom, y_zoom)
        if zoom_filter:
            vf_chain.append(zoom_filter)

        # 4. Speed (video) — apply before text so text timing stays relative to sped-up video
        speed = filters.get('speed', 1.0)
        if speed and abs(speed - 1.0) > 0.01:
            # Check for reverse first
            if filters.get('reverse', False):
                vf_chain.append("reverse")
            vf_chain.append(f"setpts=PTS/{speed}")
            audio_speed = _speed_to_audio_filter(speed)
            if audio_speed:
                af_chain.append(audio_speed)
        elif filters.get('reverse', False):
            # Reverse only, no speed change
            vf_chain.append("reverse")

        # 5. Color adjustments
        b = filters.get('brightness', 1.0) - 1.0
        c = filters.get('contrast', 1.0)
        gray = filters.get('grayscale', 0.0)
        s_base = filters.get('saturation', 1.0)
        s = s_base * (1.0 - gray) if gray < 1.0 else 0
        vf_chain.append(f"eq=brightness={b}:contrast={c}:saturation={s}")

        # 6. Effects
        fx = filters.get('effects', [])
        if 'sepia' in fx:
            vf_chain.append("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131")
        if 'blur' in fx:
            vf_chain.append("gblur=sigma=2")
        if 'sharpen' in fx:
            vf_chain.append("unsharp=3:3:1.5")
        if 'vignette' in fx:
            vf_chain.append("vignette=PI/4")

        # 7. Audio Volume Control
        volume = filters.get('volume', 100)
        muted = filters.get('muted', False)
        vol_filter = _build_volume_filter(volume, muted)
        if vol_filter:
            af_chain.append(vol_filter)

        # 8. Audio Fade In/Out
        audio_fade_in = filters.get('audio_fade_in', 0)
        audio_fade_out = filters.get('audio_fade_out', 0)
        if audio_fade_in > 0:
            fade_in = _build_fade_filter(audio_fade_in, "in")
            if fade_in:
                af_chain.append(fade_in)
        if audio_fade_out > 0:
            fade_out = _build_fade_filter(audio_fade_out, "out")
            if fade_out:
                af_chain.append(fade_out)

        # 9. Text Overlay
        text = filters.get('text_overlay', '')
        if text:
            font = _find_font()
            if font:
                x_pos = filters.get('text_x', '(w-text_w)/2')
                y_pos = filters.get('text_y', 'h-text_h-20')
                fontcolor = filters.get('text_color', 'white')
                fontsize = filters.get('text_size', 24)
                vf_chain.append(f"drawtext=fontfile='{font}':text='{text}':x={x_pos}:y={y_pos}:fontcolor={fontcolor}:fontsize={fontsize}:box=1:boxcolor=black@0.5:boxborderw=5")
            else:
                print("Warning: No system font found, skipping text overlay")

        if vf_chain:
            command.extend(["-vf", ",".join(vf_chain)])
        if af_chain:
            command.extend(["-af", ",".join(af_chain)])

        command.extend([
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            out_path
        ])
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, timeout=300)
        if not os.path.exists(out_path) or os.path.getsize(out_path) < 1024:
            print(f"Clip output missing or too small: {out_path}")
            return False
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error clipping {video_path}: {e}")
        if e.stderr:
            print("FFMPEG STDERR:", e.stderr.decode('utf-8', errors='ignore'))
        return False

def merge_videos(video_paths: list, out_path: str) -> bool:
    """ Merges video segments using concat demuxer with fallback to re-encode. """
    if not video_paths:
        print("No video paths provided for merge")
        return False

    for vp in video_paths:
        if not os.path.exists(vp):
            print(f"Missing clip for merge: {vp}")
            return False

    list_file = os.path.join(os.path.dirname(out_path), f"merge_list_{os.path.basename(out_path)}.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for vp in video_paths:
            f.write(f"file '{vp.replace(chr(92), '/')}'\n")

    try:
        command = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_file,
            "-c", "copy",
            "-movflags", "+faststart",
            out_path
        ]
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, timeout=300)
        if os.path.exists(list_file):
            os.remove(list_file)
        if os.path.exists(out_path) and os.path.getsize(out_path) >= 1024:
            return True
    except subprocess.CalledProcessError as e:
        print("Concat copy failed, falling back to re-encode...")
        if e.stderr:
            print("FFMPEG STDERR:", e.stderr.decode('utf-8', errors='ignore'))
    except subprocess.TimeoutExpired:
        print("Concat merge timed out after 5 minutes")

    try:
        command = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_file,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            out_path
        ]
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, timeout=300)
        if os.path.exists(list_file):
            os.remove(list_file)
        if os.path.exists(out_path) and os.path.getsize(out_path) >= 1024:
            return True
    except subprocess.CalledProcessError as e:
        print(f"Error merging videos (re-encode fallback): {e}")
        if e.stderr:
            print("FFMPEG STDERR:", e.stderr.decode('utf-8', errors='ignore'))
    except subprocess.TimeoutExpired:
        print("Re-encode merge timed out after 5 minutes")

    if os.path.exists(list_file):
        os.remove(list_file)
    return False

