def combine_scores(motion_scores: list, audio_scores: list, semantic_scores: list) -> list:
    """ Weighted fusion of multimodal scores. """
    final_scores = []
    
    # Ensure all arrays are the same length (align to motion scores which are frame-by-frame)
    # For a real pipeline, we would map audio/semantic segment times to frame indices
    # Here we mock the alignment by assuming they are scaled to the same length or interpolating.
    
    length = max(len(motion_scores), 1)
    
    for i in range(length):
        m = motion_scores[i] if i < len(motion_scores) else 0.0
        a = audio_scores[i] if i < len(audio_scores) else 0.0
        s = semantic_scores[i] if i < len(semantic_scores) else 0.0
        
        # Combining logic based on requirements
        fs = (0.5 * m) + (0.3 * a) + (0.2 * s)
        final_scores.append(fs)
        
    return final_scores
