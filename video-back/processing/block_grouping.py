"""
Semantic block grouping and selection.
Groups adjacent similar segments into coherent blocks and selects top blocks for summary.
"""
from typing import List, Dict
import math

def compute_similarity(keywords1: List[str], keywords2: List[str]) -> float:
    """
    Compute Jaccard similarity between two keyword lists.
    
    Args:
        keywords1, keywords2: Lists of keywords
    
    Returns:
        Similarity score 0-1
    """
    if not keywords1 or not keywords2:
        return 0.0
    
    set1 = set(keywords1)
    set2 = set(keywords2)
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0.0


def group_segments_into_blocks(
    segments: List[Dict],
    keywords: Dict[int, List[str]],
    similarity_threshold: float = 0.3
) -> List[Dict]:
    """
    Group adjacent segments with high semantic similarity into blocks.
    
    Args:
        segments: List of scored segments
        keywords: Keywords for each segment
        similarity_threshold: Minimum similarity to group segments
    
    Returns:
        List of blocks (groups of consecutive segments)
    """
    if not segments:
        return []
    
    blocks = []
    current_block = [segments[0]]
    
    for i in range(1, len(segments)):
        prev_seg = segments[i - 1]
        curr_seg = segments[i]
        
        # Compute similarity between consecutive segments
        prev_keywords = keywords.get(prev_seg["id"], [])
        curr_keywords = keywords.get(curr_seg["id"], [])
        similarity = compute_similarity(prev_keywords, curr_keywords)
        
        # Add to current block if similar
        if similarity >= similarity_threshold:
            current_block.append(curr_seg)
        else:
            # Start new block
            if current_block:
                blocks.append(_create_block(current_block))
            current_block = [curr_seg]
    
    # Add final block
    if current_block:
        blocks.append(_create_block(current_block))
    
    return blocks


def _create_block(segments: List[Dict]) -> Dict:
    """Create a block metadata from constituent segments."""
    start_sec = segments[0]["start_sec"]
    end_sec = segments[-1]["end_sec"]
    duration = end_sec - start_sec
    
    # Aggregate importance
    avg_importance = sum(s["importance"] for s in segments) / len(segments)
    total_words = sum(s["word_count"] for s in segments)
    
    # Coherence bonus: longer coherent blocks are more valuable
    coherence_bonus = min(duration / 10.0, 1.0)  # Bonus for longer blocks
    
    text = " ".join([s["text"] for s in segments])
    
    block_score = avg_importance * (1 + coherence_bonus * 0.3)
    
    return {
        "segments": segments,
        "start_sec": start_sec,
        "end_sec": end_sec,
        "duration": duration,
        "avg_importance": avg_importance,
        "coherence_bonus": coherence_bonus,
        "block_score": block_score,
        "text": text,
        "segment_count": len(segments),
    }


def select_blocks_for_summary(
    blocks: List[Dict],
    target_duration: float
) -> List[Dict]:
    """
    Select top blocks preserving chronological order until target duration reached.
    
    Args:
        blocks: List of scored blocks
        target_duration: Target summary duration in seconds
    
    Returns:
        Selected blocks in chronological order
    """
    if not blocks:
        return []
    
    # Sort blocks by score (descending)
    sorted_blocks = sorted(blocks, key=lambda b: b["block_score"], reverse=True)
    
    # Select blocks until reaching target duration
    selected = []
    total_duration = 0
    
    for block in sorted_blocks:
        if total_duration + block["duration"] <= target_duration:
            selected.append(block)
            total_duration += block["duration"]
        elif total_duration < target_duration:
            # Partial block if space remains
            remaining = target_duration - total_duration
            if remaining > 2.0:  # Only add if at least 2 seconds
                selected.append(block)
                break
    
    # Sort selected blocks by chronological order (start time)
    selected.sort(key=lambda b: b["start_sec"])
    
    return selected


def add_transition_buffers(selected_blocks: List[Dict], buffer_sec: float = 0.3) -> List[Dict]:
    """
    Add temporal buffers and adjust timings for smooth transitions.
    
    Args:
        selected_blocks: Chronologically ordered blocks
        buffer_sec: Buffer duration in seconds
    
    Returns:
        Blocks with adjusted timings
    """
    if not selected_blocks:
        return selected_blocks
    
    adjusted = []
    for i, block in enumerate(selected_blocks):
        adj_block = dict(block)
        
        # Add buffer before block (except first)
        if i > 0:
            adj_block["start_sec"] = max(adj_block["start_sec"] - buffer_sec / 2, 0)
        
        # Add buffer after block (except last)
        if i < len(selected_blocks) - 1:
            adj_block["end_sec"] = adj_block["end_sec"] + buffer_sec / 2
        
        adjusted.append(adj_block)
    
    return adjusted


def compute_target_duration(original_duration: float, compression_ratio: float = 0.3) -> float:
    """
    Compute target summary duration based on original video and compression ratio.
    
    Args:
        original_duration: Original video duration in seconds
        compression_ratio: Target ratio (0.3 = 30% of original)
    
    Returns:
        Target duration in seconds
    """
    target = original_duration * compression_ratio
    # Ensure reasonable bounds: 30s min, 10 min max
    return max(30, min(target, 600))
