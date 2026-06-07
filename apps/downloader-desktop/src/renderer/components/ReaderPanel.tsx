import type { ChapterDetailStatus, PreviewChapter, PreviewStatus } from "../state";

interface ReaderPanelProps {
  previewStatus: PreviewStatus;
  activeChapter: PreviewChapter | null;
  chapterDetailStatus: ChapterDetailStatus;
  chapterDetail: {
    chapterTitle: string;
    chapterUrl: string;
    totalImages: number;
    images: string[];
    capturedAt?: string;
  } | null;
  chapterDetailError: string | null;
  previewError: string | null;
  onRetry: () => void;
}

export function ReaderPanel(props: ReaderPanelProps) {
  if (props.previewStatus === "failed") {
    return (
      <section className="card card--reader">
        <h2>Reader</h2>
        <p className="reader-placeholder reader-placeholder--error">{props.previewError ?? "Preview failed."}</p>
      </section>
    );
  }

  if (props.previewStatus === "previewing" && !props.activeChapter) {
    return (
      <section className="card card--reader">
        <h2>Reader</h2>
        <p className="reader-placeholder">Loading preview chapters...</p>
      </section>
    );
  }

  if (!props.activeChapter) {
    return (
      <section className="card card--reader">
        <h2>Reader</h2>
        <p className="reader-placeholder">No chapter selected.</p>
      </section>
    );
  }

  if (props.chapterDetailStatus === "loading") {
    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        <p className="reader-placeholder">Loading full chapter...</p>
      </section>
    );
  }

  if (props.chapterDetailStatus === "error") {
    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        <p className="reader-placeholder reader-placeholder--error">{props.chapterDetailError ?? "Failed to load full chapter."}</p>
        <div className="reader-actions">
          <button type="button" className="button button--secondary" onClick={props.onRetry}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (props.chapterDetailStatus !== "success" || !props.chapterDetail || props.chapterDetail.chapterUrl !== props.activeChapter.chapterUrl) {
    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        <p className="reader-placeholder">Click the chapter title to load full pages.</p>
      </section>
    );
  }

  if (props.chapterDetail.images.length === 0) {
    return (
      <section className="card card--reader">
        <h2>{props.chapterDetail.chapterTitle}</h2>
        <p className="reader-placeholder">No images available for this chapter.</p>
      </section>
    );
  }

  const chapterDetail = props.chapterDetail;

  return (
    <section className="card card--reader">
      <h2>{chapterDetail.chapterTitle}</h2>
      <div className="reader-image-stream">
        {chapterDetail.images.map((image, index) => (
          <div key={`${chapterDetail.chapterUrl}-${index}`} className="reader-image-frame">
            <img
              src={image}
              alt={`${chapterDetail.chapterTitle} page ${index + 1}`}
              className="reader-image"
              loading="lazy"
              width={1200}
              height={1600}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
