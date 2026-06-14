import type { StartInput } from "../../shared/contracts";

interface DownloadFormProps {
  values: StartInput;
  isRunning: boolean;
  isPreviewing: boolean;
  hasApi: boolean;
  canStart: boolean;
  canDownloadAll?: boolean;
  canDownloadSelected?: boolean;
  canPreview: boolean;
  selectedChapterCount: number;
  previewMaxChapters: number;
  previewImagesPerChapter: number;
  previewValidationErrors?: string[];
  validationErrors: string[];
  onChange: (field: keyof StartInput, value: string | number) => void;
  onChangePreviewMaxChapters: (value: number) => void;
  onChangePreviewImagesPerChapter: (value: number) => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onDownloadAll?: () => void;
  onDownloadSelected?: () => void;
  onSubmit?: () => void;
  onStop: () => void;
  onSelectOutputDir: () => void;
  onOpenOutputDir: () => void;
}

export function DownloadForm(props: DownloadFormProps) {
  const downloadAllDisabled = props.isRunning || !props.hasApi || !(props.canDownloadAll ?? props.canStart);
  const downloadSelectedDisabled = props.isRunning || !props.hasApi || props.selectedChapterCount === 0 || !(props.canDownloadSelected ?? props.canStart);
  const previewDisabled = props.isRunning || props.isPreviewing || !props.hasApi || !props.canPreview;
  const previewValidationErrors = props.previewValidationErrors ?? [];

  return (
    <section className="card">
      <h2>Open Reader</h2>

      <div className="field-group">
        <label className="field-label" htmlFor="download-url">
          URL
        </label>
        <div className="field-control">
          <input
            id="download-url"
            className="input"
            type="url"
            value={props.values.url}
            onChange={(event) => props.onChange("url", event.target.value)}
            placeholder="https://www.2025copy.com/comic/slug"
            disabled={props.isRunning || props.isPreviewing}
          />
        </div>
      </div>

      <div className="field-row-grid">
        <div className="field-group">
          <label className="field-label" htmlFor="preview-max-chapters">
            Preview Chapters
          </label>
          <input
            id="preview-max-chapters"
            className="input"
            type="number"
            min={1}
            value={props.previewMaxChapters}
            onChange={(event) => {
              const nextValue = event.target.valueAsNumber;
              props.onChangePreviewMaxChapters(Number.isNaN(nextValue) ? props.previewMaxChapters : nextValue);
            }}
            disabled={props.isRunning || props.isPreviewing}
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="preview-images-per-chapter">
            Images/Chapter
          </label>
          <input
            id="preview-images-per-chapter"
            className="input"
            type="number"
            min={1}
            value={props.previewImagesPerChapter}
            onChange={(event) => {
              const nextValue = event.target.valueAsNumber;
              props.onChangePreviewImagesPerChapter(Number.isNaN(nextValue) ? props.previewImagesPerChapter : nextValue);
            }}
            disabled={props.isRunning || props.isPreviewing}
          />
        </div>
      </div>

      <div className="button-row">
        <button type="button" className="button button--primary" onClick={props.onStartPreview} disabled={previewDisabled}>
          Preview Chapters
        </button>
        <button type="button" className="button button--secondary" onClick={props.onStopPreview} disabled={!props.isPreviewing}>
          Stop Preview
        </button>
        {props.isRunning ? (
          <button type="button" className="button button--secondary" onClick={props.onStop}>
            Stop
          </button>
        ) : null}
      </div>

      {previewValidationErrors.length > 0 ? (
        <ul className="validation-errors" role="status" aria-live="polite">
          {previewValidationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {props.validationErrors.length > 0 ? (
        <ul className="validation-errors" role="status" aria-live="polite">
          {props.validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <details>
        <summary>Download images instead</summary>

        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            onClick={props.onDownloadAll ?? props.onSubmit}
            disabled={downloadAllDisabled}
          >
            Download All Chapters
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={props.onDownloadSelected ?? props.onSubmit}
            disabled={downloadSelectedDisabled}
          >
            Download Selected Chapters ({props.selectedChapterCount})
          </button>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="download-output-dir">
            Output directory
          </label>
          <div className="field-control field-control--row">
            <input
              id="download-output-dir"
              className="input"
              value={props.values.outputDir}
              onChange={(event) => props.onChange("outputDir", event.target.value)}
              placeholder="/path/to/output"
              disabled={props.isRunning}
            />
            <button type="button" className="button button--ghost" onClick={props.onSelectOutputDir} disabled={!props.hasApi || props.isRunning}>
              Browse
            </button>
          </div>
        </div>

        <div className="field-row-grid">
          <div className="field-group">
            <label className="field-label" htmlFor="download-concurrency">
              Concurrency
            </label>
            <input
              id="download-concurrency"
              className="input"
              type="number"
              min={1}
              value={props.values.concurrency}
              onChange={(event) => {
                const nextValue = event.target.valueAsNumber;
                props.onChange("concurrency", Number.isNaN(nextValue) ? props.values.concurrency : nextValue);
              }}
              disabled={props.isRunning}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="download-retries">
              Retries
            </label>
            <input
              id="download-retries"
              className="input"
              type="number"
              min={0}
              value={props.values.retries}
              onChange={(event) => {
                const nextValue = event.target.valueAsNumber;
                props.onChange("retries", Number.isNaN(nextValue) ? props.values.retries : nextValue);
              }}
              disabled={props.isRunning}
            />
          </div>
        </div>

        <button type="button" className="button button--ghost" onClick={props.onOpenOutputDir} disabled={!props.values.outputDir || !props.hasApi}>
          Open Output
        </button>
      </details>
    </section>
  );
}
