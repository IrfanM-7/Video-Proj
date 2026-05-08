"""
Semantic segment generation and importance scoring.
Converts transcript into coherent sentence/paragraph segments with importance scores.
"""
import re
from typing import List, Dict
from collections import Counter
import math

def parse_segments_from_transcript(transcription: dict, motion_scores: list, fps: int = 30) -> List[Dict]:
    """
    Parse transcript into sentence-level segments with metadata.
    
    Args:
        transcription: Whisper output with segments
        motion_scores: Frame motion scores
        fps: Video frame rate
    
    Returns:
        List of segments with text, timing, and metadata
    """
    if not transcription.get("segments"):
        return []
    
    segments = []
    for i, seg in enumerate(transcription["segments"]):
        start_sec = seg.get("start", 0)
        end_sec = seg.get("end", 0)
        text = seg.get("text", "").strip()
        
        if not text or end_sec <= start_sec:
            continue
        
        # Compute motion score for this segment
        start_f = int(start_sec * fps)
        end_f = int(end_sec * fps)
        motion_score = 0.0
        if start_f < len(motion_scores) and end_f <= len(motion_scores):
            segment_motion = motion_scores[start_f:end_f]
            motion_score = sum(segment_motion) / len(segment_motion) if segment_motion else 0.0
        
        # Split text into sentences
        sentences = _split_into_sentences(text)
        sentence_start = start_sec
        
        for sentence in sentences:
            sentence_duration = (end_sec - start_sec) / len(sentences) if len(sentences) > 0 else (end_sec - start_sec)
            sentence_end = sentence_start + sentence_duration
            
            if sentence.strip():
                segments.append({
                    "id": len(segments),
                    "text": sentence.strip(),
                    "start_sec": sentence_start,
                    "end_sec": sentence_end,
                    "duration": sentence_duration,
                    "motion_score": motion_score,
                    "word_count": len(sentence.split()),
                })
            
            sentence_start = sentence_end
    
    return segments


def _split_into_sentences(text: str) -> List[str]:
    """Split text into sentences, handling common abbreviations."""
    # Simple sentence splitting on periods, question marks, exclamation marks
    text = text.replace(" U.S. ", " US ").replace(" Dr. ", " Dr ")
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s for s in sentences if s.strip()]


def compute_segment_importance(segments: List[Dict], topic: str = "") -> List[Dict]:
    """
    Score segments by importance based on speech density, keywords, emphasis.
    
    Args:
        segments: List of segments with text and timing
        topic: Optional topic/title for keyword relevance
    
    Returns:
        Segments with importance scores added
    """
    if not segments:
        return segments
    
    # Build vocabulary for TF-IDF
    all_text = " ".join([s["text"].lower() for s in segments])
    words = re.findall(r'\b\w+\b', all_text)
    word_freq = Counter(words)
    total_words = len(words)
    
    topic_words = set(re.findall(r'\b\w+\b', topic.lower())) if topic else set()
    
    for seg in segments:
        # Speech density (words per second)
        speech_density = seg["word_count"] / max(seg["duration"], 0.1)
        speech_density_score = min(speech_density / 10.0, 1.0)  # Normalize to 0-1
        
        # Keyword relevance
        seg_words = re.findall(r'\b\w+\b', seg["text"].lower())
        keyword_score = 0.0
        if topic_words:
            matching_keywords = sum(1 for w in seg_words if w in topic_words)
            keyword_score = matching_keywords / len(seg_words) if seg_words else 0.0
        
        # TF-IDF-like scoring for important words
        tfidf_score = 0.0
        for word in seg_words:
            if word_freq[word] > 0:
                tf = seg_words.count(word) / len(seg_words)
                idf = math.log(len(segments) / (1 + word_freq.get(word, 1)))
                tfidf_score += tf * idf
        tfidf_score = min(tfidf_score / max(len(seg_words), 1), 1.0)
        
        # Motion emphasis (higher motion = more emphasis)
        motion_score = min(seg["motion_score"] / 50.0, 1.0)  # Normalize motion
        
        # Combined importance score
        seg["importance"] = (
            speech_density_score * 0.3 +
            keyword_score * 0.3 +
            tfidf_score * 0.2 +
            motion_score * 0.2
        )
    
    return segments


def compute_segment_keywords(segments: List[Dict]) -> Dict[int, List[str]]:
    """Extract top keywords for each segment (for similarity computation)."""
    keywords = {}
    for seg in segments:
        words = re.findall(r'\b\w+\b', seg["text"].lower())
        # Remove common stopwords
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were'}
        filtered = [w for w in words if w not in stopwords and len(w) > 2]
        keywords[seg["id"]] = filtered[:5]  # Top 5 keywords
    return keywords
