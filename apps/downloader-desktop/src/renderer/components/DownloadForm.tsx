import type { StartInput } from "../../shared/contracts";

interface DownloadFormProps {
  values: StartInput;
  isRunning: boolean;
  hasApi: boolean;
  canStart: boolean;
  validationErrors: string[];
  onChange: (field: keyof StartInput, value: string | number) => void;
  onSubmit: () => void;
  onStop: () => void;
  onSelectOutputDir: () => void;
  onOpenOutputDir: () => void;
}

export function DownloadForm(props: DownloadFormProps) {
  const startDisabled = props.isRunning || !props.hasApi || !props.canStart;

  return (
    <section className="card">
      <h2>Download Setup</h2>

      <div className="field-group">
        <label className="field-label" htmlFor="download-url">
          URL
        </label>
        <div className="field-control">
          <input
            id="download-url"
            className="input"
            value={props.values.url}
            onChange={(event) => props.onChange("url", event.target.value)}
            placeholder="https://www.2025copy.com/comic/slug"
            disabled={props.isRunning}
          />
        </div>
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
            onChange={(event) => props.onChange("concurrency", Number(event.target.value) || 1)}
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
            onChange={(event) => props.onChange("retries", Number(event.target.value) || 0)}
            disabled={props.isRunning}
          />
        </div>
      </div>

      {props.validationErrors.length > 0 ? (
        <ul className="validation-errors" role="alert">
          {props.validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="button-row">
        <button type="button" className="button button--primary" onClick={props.onSubmit} disabled={startDisabled}>
          Start
        </button>
        <button type="button" className="button button--secondary" onClick={props.onStop} disabled={!props.isRunning}>
          Stop
        </button>
        <button type="button" className="button button--ghost" onClick={props.onOpenOutputDir} disabled={!props.values.outputDir || !props.hasApi}>
          Open Output
        </button>
      </div>
    </section>
  );
}
