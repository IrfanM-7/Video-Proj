import matplotlib.pyplot as plt
import numpy as np


def generate_matrix_image(data, output_path="outputs/matrix.png"):
    fig, ax = plt.subplots(figsize=(8, max(2, len(data) * 0.7)))

    columns = ["Segment", "Motion", "Audio", "Semantic", "Final"]
    rows = []

    for i, d in enumerate(data):
        rows.append([
            f"Segment {i+1}",
            round(d.get("motion", 0), 2),
            round(d.get("audio", 0), 2),
            round(d.get("semantic", 0), 2),
            round(d.get("final", 0), 2)
        ])

    ax.table(cellText=rows, colLabels=columns, loc='center', cellLoc='center')
    ax.axis('off')

    plt.savefig(output_path, bbox_inches='tight', dpi=200)
    plt.close()

    return output_path


def generate_segment_heatmap(data, output_path="outputs/matrix_heatmap.png", title="Video"):
    modalities = ["Motion", "Audio", "Semantic", "Final"]
    values = np.array([
        [d.get("motion", 0), d.get("audio", 0), d.get("semantic", 0), d.get("final", 0)]
        for d in data
    ])

    fig, ax = plt.subplots(figsize=(10, max(3, len(data) * 0.6)))
    im = ax.imshow(values, cmap="YlGnBu", aspect="auto", vmin=0, vmax=1)

    ax.set_xticks(np.arange(len(modalities)))
    ax.set_xticklabels(modalities, fontsize=12)
    ax.set_yticks(np.arange(len(data)))
    ax.set_yticklabels([f"Segment {i+1}" for i in range(len(data))], fontsize=12)

    for i in range(values.shape[0]):
        for j in range(values.shape[1]):
            value = values[i, j]
            color = "white" if value > 0.55 else "black"
            ax.text(j, i, f"{value:.2f}", ha="center", va="center", color=color, fontsize=10)

    cbar = fig.colorbar(im, ax=ax, fraction=0.05, pad=0.04)
    cbar.ax.set_ylabel("Normalized Score", rotation=-90, va="bottom", fontsize=12)
    ax.set_title(f"Multimodal Score Heatmap - {title}", fontsize=14, pad=20)
    ax.set_xlabel("Modalities", fontsize=12)
    ax.set_ylabel("Segment", fontsize=12)

    fig.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches='tight')
    plt.close()
    return output_path


def generate_segment_trend_chart(data, output_path="outputs/segment_score_trends.png", title="Video"):
    segments = list(range(1, len(data) + 1))
    motion = [d.get("motion", 0) for d in data]
    audio = [d.get("audio", 0) for d in data]
    semantic = [d.get("semantic", 0) for d in data]
    final = [d.get("final", 0) for d in data]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(segments, motion, marker="o", label="Motion", color="#1f77b4", linewidth=2)
    ax.plot(segments, audio, marker="s", label="Audio", color="#ff7f0e", linewidth=2)
    ax.plot(segments, semantic, marker="^", label="Semantic", color="#2ca02c", linewidth=2)
    ax.plot(segments, final, marker="D", label="Final", color="#d62728", linewidth=2)

    ax.set_xticks(segments)
    ax.set_xlabel("Segment Index", fontsize=12)
    ax.set_ylabel("Normalized Score", fontsize=12)
    ax.set_title(f"Multimodal Score Trends - {title}", fontsize=14)
    ax.set_ylim(0, 1)
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(loc="upper right", fontsize=10)

    fig.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches='tight')
    plt.close()
    return output_path


def generate_segment_grouped_bar_chart(data, output_path="outputs/segment_grouped_scores.png", title="Video"):
    modalities = ["Motion", "Audio", "Semantic", "Final"]
    values = np.array([
        [d.get("motion", 0), d.get("audio", 0), d.get("semantic", 0), d.get("final", 0)]
        for d in data
    ])
    segments = np.arange(1, len(data) + 1)
    width = 0.18

    fig, ax = plt.subplots(figsize=(10, 5))
    for i, modality in enumerate(modalities):
        ax.bar(segments + (i - 1.5) * width, values[:, i], width, label=modality)

    ax.set_xticks(segments)
    ax.set_xticklabels([f"S{i}" for i in segments], fontsize=11)
    ax.set_xlabel("Segment", fontsize=12)
    ax.set_ylabel("Normalized Score", fontsize=12)
    ax.set_title(f"Segment Score Breakdown - {title}", fontsize=14)
    ax.set_ylim(0, 1)
    ax.legend(fontsize=10)
    ax.grid(axis="y", linestyle="--", alpha=0.3)

    fig.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches='tight')
    plt.close()
    return output_path


def generate_research_charts(data, title="Video"):
    outputs = {
        "table": generate_matrix_image(data, "outputs/matrix.png"),
        "heatmap": generate_segment_heatmap(data, "outputs/matrix_heatmap.png", title),
        "trend": generate_segment_trend_chart(data, "outputs/segment_score_trends.png", title),
        "bar": generate_segment_grouped_bar_chart(data, "outputs/segment_grouped_scores.png", title),
    }
    return outputs
