def normalize(scores: list) -> list:
    """ Min-Max normalized to scale between 0 and 1. """
    if not scores: return []
    min_val = min(scores)
    max_val = max(scores)
    if max_val == min_val:
        return [0.5 for _ in scores]
        
    return [(s - min_val) / (max_val - min_val) for s in scores]
