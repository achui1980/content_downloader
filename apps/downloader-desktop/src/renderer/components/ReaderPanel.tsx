import type { Ref, UIEventHandler } from "react";
import { type ChapterDetailStatus, type PreviewChapter, type PreviewStatus, type ReaderZoom, readerZoomLevels } from "../state";

interface ReaderPanelProps {
  isReaderStage: boolean;
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
  previousChapter: PreviewChapter | null;
  nextChapter: PreviewChapter | null;
  scrollContainerRef: Ref<HTMLDivElement>;
  onReaderScroll: UIEventHandler<HTMLDivElement>;
  onBackToSetup: () => void;
  onStopPreview: () => void;
  canStopPreview?: boolean;
  navigationDisabled?: boolean;
  readerZoom: ReaderZoom;
  onReaderZoomChange: (zoom: ReaderZoom) => void;
  onOpenPreviousChapter: () => void;
  onOpenNextChapter: () => void;
  onRetry: () => void;
}

export function ReaderPanel(props: ReaderPanelProps) {
  const activeTitle = props.chapterDetail?.chapterTitle ?? props.activeChapter?.chapterTitle ?? "Reader";
  const hasReaderContent =
    props.chapterDetailStatus === "loading" ||
    props.chapterDetailStatus === "error" ||
    (props.chapterDetailStatus === "success" &&
      !!props.chapterDetail &&
      props.chapterDetail.chapterUrl === props.activeChapter?.chapterUrl);

  function renderReaderFrame(content: JSX.Element) {
    return (
      <section className="card card--reader">
        <div className="reader-panel-header">
          <div>
            <p className="reader-placeholder">Reader</p>
            <p className="reader-placeholder">Reading now</p>
            <h2>{activeTitle}</h2>
          </div>
          <div className="reader-zoom-control">
            <span className="reader-zoom-label">Page size</span>
            <div className="reader-zoom-options">
              {readerZoomLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={level === props.readerZoom ? "reader-zoom-option reader-zoom-option--active" : "reader-zoom-option"}
                  aria-pressed={level === props.readerZoom}
                  onClick={() => props.onReaderZoomChange(level)}
                >
                  {level}%
                </button>
              ))}
            </div>
          </div>
          <div className="reader-actions">
            <button type="button" className="button button--secondary" onClick={props.onBackToSetup}>
              Back to setup
            </button>
            {props.canStopPreview ? (
              <button type="button" className="button button--secondary" onClick={props.onStopPreview}>
                Stop Preview
              </button>
            ) : null}
            <button
              type="button"
              className="button button--secondary"
              disabled={props.navigationDisabled || !props.previousChapter}
              onClick={props.onOpenPreviousChapter}
            >
              Previous chapter
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={props.navigationDisabled || !props.nextChapter}
              onClick={props.onOpenNextChapter}
            >
              Next chapter
            </button>
          </div>
        </div>
        {props.previewStatus === "failed" ? (
          <p className="reader-placeholder reader-placeholder--error">{props.previewError ?? "Preview failed."}</p>
        ) : null}
        {content}
      </section>
    );
  }

  if (props.previewStatus === "failed" && !props.isReaderStage && !props.activeChapter) {
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

  if (!props.isReaderStage) {
    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        {props.previewStatus === "failed" ? (
          <p className="reader-placeholder reader-placeholder--error">{props.previewError ?? "Preview failed."}</p>
        ) : null}
        <p className="reader-placeholder">Click the chapter title to load full pages.</p>
      </section>
    );
  }

  if (props.chapterDetailStatus === "loading") {
    return renderReaderFrame(<p className="reader-placeholder">Loading full chapter...</p>);
  }

  if (props.chapterDetailStatus === "error") {
    return renderReaderFrame(
      <>
        <p className="reader-placeholder reader-placeholder--error">{props.chapterDetailError ?? "Failed to load full chapter."}</p>
        <div className="reader-actions">
          <button type="button" className="button button--secondary" onClick={props.onRetry}>
            Retry
          </button>
        </div>
      </>
    );
  }

  if (props.chapterDetailStatus !== "success" || !props.chapterDetail || props.chapterDetail.chapterUrl !== props.activeChapter.chapterUrl) {
    if (hasReaderContent) {
      return renderReaderFrame(<p className="reader-placeholder">Click the chapter title to load full pages.</p>);
    }

    return (
      <section className="card card--reader">
        <h2>{props.activeChapter.chapterTitle}</h2>
        {props.previewStatus === "failed" ? (
          <p className="reader-placeholder reader-placeholder--error">{props.previewError ?? "Preview failed."}</p>
        ) : null}
        <p className="reader-placeholder">Click the chapter title to load full pages.</p>
      </section>
    );
  }

  if (props.chapterDetail.images.length === 0) {
    return renderReaderFrame(<p className="reader-placeholder">No images available for this chapter.</p>);
  }

  const chapterDetail = props.chapterDetail;

  return renderReaderFrame(
    <>
      <div className="reader-image-stream" ref={props.scrollContainerRef} onScroll={props.onReaderScroll}>
        {chapterDetail.images.map((image, index) => (
          <div key={`${chapterDetail.chapterUrl}-${index}`} className="reader-image-frame" style={{ width: `${props.readerZoom}%` }}>
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
      <div className="reader-actions reader-actions--endcap">
        <p className="reader-placeholder">Up next</p>
        {props.nextChapter ? (
          <>
            <p>{props.nextChapter.chapterTitle}</p>
            <button
              type="button"
              className="button button--secondary"
              disabled={props.navigationDisabled}
              onClick={props.onOpenNextChapter}
            >
              Open next chapter
            </button>
          </>
        ) : (
          <p className="reader-placeholder">No later preview chapter is available yet.</p>
        )}
      </div>
    </>
  );
}
