import subprocess
import json
import os
import whisper

# Load model once globally to avoid 30-60s delay on every transcription
_whisper_model = None

def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model (tiny) — optimized for speed...")
        _whisper_model = whisper.load_model("tiny")
        print("Whisper model loaded.")
    return _whisper_model

def extract_audio(video_path: str, audio_out_path: str):
    """ Extract audio from video using FFmpeg. """
    try:
        command = [
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            audio_out_path
        ]
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, timeout=300)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg audio extraction failed: {e}")
        return False
    except subprocess.TimeoutExpired:
        print(f"FFmpeg audio extraction timed out after 5 minutes")
        return False

def transcribe_audio(audio_path: str) -> dict:
    """ Transcribe using OpenAI Whisper (base model) and return segments. """
    try:
        model = _get_whisper_model()
        result = model.transcribe(audio_path, word_timestamps=False)
        return result
    except Exception as e:
        print(f"Whisper transcription failed: {e}")
        return {"text": "", "segments": []}
