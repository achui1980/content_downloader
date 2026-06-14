import { useState, type Ref, type UIEventHandler } from "react";
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
  immersiveReader?: boolean;
  onToggleImmersive?: () => void;
  onOpenPreviousChapter: () => void;
  onOpenNextChapter: () => void;
  onRetry: () => void;
}

export function ReaderPanel(props: ReaderPanelProps) {
  const [immersiveHeaderVisible, setImmersiveHeaderVisible] = useState(false);
  const activeTitle = props.chapterDetail?.chapterTitle ?? props.activeChapter?.chapterTitle ?? "Reader";
  const hasReaderContent =
    props.chapterDetailStatus === "loading" ||
    props.chapterDetailStatus === "error" ||
    (props.chapterDetailStatus === "success" &&
      !!props.chapterDetail &&
      props.chapterDetail.chapterUrl === props.activeChapter?.chapterUrl);

  function renderReaderFrame(content: JSX.Element) {
    const immersiveHeaderClass =
      props.immersiveReader
        ? `reader-panel-header reader-panel-header--immersive${immersiveHeaderVisible ? " reader-panel-header--immersive-visible" : ""}`
        : "reader-panel-header";
    return (
      <section className="card card--reader">
        {props.immersiveReader ? (
          <div
            className="reader-immersive-anchor"
            onMouseEnter={() => setImmersiveHeaderVisible(true)}
            onMouseLeave={() => setImmersiveHeaderVisible(false)}
          />
        ) : null}
        <div className={immersiveHeaderClass}>
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
          {props.onToggleImmersive ? (
            <button
              type="button"
              className="button button--ghost reader-immersive-toggle"
              aria-label={props.immersiveReader ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={props.onToggleImmersive}
            >
              {props.immersiveReader ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 2h8v8M2 6h8M10 14H2V6M14 10V2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ) : null}
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
