import type { PreviewChapter, PreviewStatus } from "../state";

interface ReaderPanelProps {
  previewStatus: PreviewStatus;
  activeChapter: PreviewChapter | null;
  previewError: string | null;
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

  if (props.activeChapter.images.length === 0) {
    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        <p className="reader-placeholder">No images available for this chapter.</p>
      </section>
    );
  }

  return (
    <section className="card card--reader">
      <h2>{props.activeChapter.chapterTitle}</h2>
      <div className="reader-image-stream">
        {props.activeChapter.images.map((image, index) => (
          <div key={`${props.activeChapter?.chapterUrl}-${index}`} className="reader-image-frame">
            <img
              src={image}
              alt={`${props.activeChapter?.chapterTitle} page ${index + 1}`}
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
