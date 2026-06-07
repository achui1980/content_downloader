import type { PreviewChapter } from "../state";

interface ChapterListPanelProps {
  chapters: PreviewChapter[];
  selectedChapterUrls: string[];
  activeChapterUrl: string | null;
  selectionLocked: boolean;
  onToggleChapter: (chapterUrl: string) => void;
  onSelectChapter: (chapterUrl: string) => void;
}

export function ChapterListPanel(props: ChapterListPanelProps) {
  const selectedSet = new Set(props.selectedChapterUrls);

  return (
    <section className="card card--chapter-list">
      <h2>Chapters</h2>
      <p className="chapter-list-meta">
        Selected {props.selectedChapterUrls.length} / {props.chapters.length}
      </p>
      <ul className="chapter-list" aria-label="Preview chapters">
        {props.chapters.length === 0 ? (
          <li className="chapter-list-empty">Run preview to load chapters.</li>
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
                aria-current={isActive ? "true" : undefined}
              >
                <span className="chapter-title">{chapter.chapterTitle}</span>
              </button>
              <a className="chapter-open-link" href={chapter.chapterUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
