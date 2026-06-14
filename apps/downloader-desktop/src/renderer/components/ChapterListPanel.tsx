import type { PreviewChapter } from "../state";

interface ChapterListPanelProps {
  chapters: PreviewChapter[];
  selectedChapterUrls: string[];
  activeChapterUrl: string | null;
  selectionLocked: boolean;
  chapterActionDisabled?: boolean;
  onToggleChapter: (chapterUrl: string) => void;
  onSelectChapter: (chapterUrl: string) => void;
}

export function ChapterListPanel(props: ChapterListPanelProps) {
  const selectedSet = new Set(props.selectedChapterUrls);

  return (
    <section className="card card--chapter-list">
      <h2>Chapter Navigator</h2>
      <p className="chapter-list-meta">Choose from {props.chapters.length} previewed chapters.</p>
      <p className="chapter-list-help">Choose a chapter title to open it in the reader.</p>
      <p className="chapter-list-help">
        Selected for download: {props.selectedChapterUrls.length} / {props.chapters.length}
      </p>
      <ul className="chapter-list" aria-label="Chapter navigator">
        {props.chapters.length === 0 ? (
          <li className="chapter-list-empty">Preview chapters to build your reading list.</li>
        ) : null}
        {props.chapters.map((chapter) => {
          const isActive = chapter.chapterUrl === props.activeChapterUrl;
          const isChecked = selectedSet.has(chapter.chapterUrl);
          const chapterAriaLabel = `Select chapter ${chapter.index}: ${chapter.chapterTitle}`;
          return (
            <li key={chapter.chapterUrl} className={`chapter-row-wrap${isActive ? " chapter-row-wrap--active" : ""}`}>
              <label className="chapter-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => props.onToggleChapter(chapter.chapterUrl)}
                  disabled={props.selectionLocked}
                  aria-label={chapterAriaLabel}
                />
              </label>
              <button
                type="button"
                className={`chapter-row${isActive ? " chapter-row--active" : ""}`}
                onClick={() => props.onSelectChapter(chapter.chapterUrl)}
                disabled={props.chapterActionDisabled}
                aria-current={isActive ? "true" : undefined}
                title="Load full chapter"
              >
                <span className="chapter-title">{chapter.chapterTitle}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
