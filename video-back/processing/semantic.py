from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def compute_semantic_scores(title: str, segments: list) -> list:
    """ 
    Computes topic relevance using TF-IDF. 
    Segments is a list of dicts: {"text": "...", "start": X, "end": Y}.
    Returns a score for each segment.
    """
    if not segments or not title:
        return [0.0] * len(segments)
        
    texts = [seg["text"] for seg in segments]
    
    # Add title as the first document for comparison
    documents = [title] + texts
    
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(documents)
        
        # Calculate cosine similarity of each text fragment with the title
        sim_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        return sim_scores.tolist()
    except Exception as e:
        print(f"Semantic scoring failed: {e}")
        return [0.0] * len(segments)
