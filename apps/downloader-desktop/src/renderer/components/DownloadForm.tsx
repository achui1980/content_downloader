import type { StartInput } from "../../shared/contracts";

interface DownloadFormProps {
  values: StartInput;
  isRunning: boolean;
  hasApi: boolean;
  onChange: (field: keyof StartInput, value: string | number) => void;
  onSubmit: () => void;
  onStop: () => void;
  onSelectOutputDir: () => void;
  onOpenOutputDir: () => void;
}

export function DownloadForm(props: DownloadFormProps) {
  return (
    <section>
      <h2>Download</h2>
      <div>
        <label>
          URL
          <input
            value={props.values.url}
            onChange={(event) => props.onChange("url", event.target.value)}
            placeholder="https://example.com/comic"
          />
        </label>
      </div>
      <div>
        <label>
          Output directory
          <input
            value={props.values.outputDir}
            onChange={(event) => props.onChange("outputDir", event.target.value)}
            placeholder="/path/to/output"
          />
        </label>
        <button type="button" onClick={props.onSelectOutputDir} disabled={!props.hasApi || props.isRunning}>
          Browse
        </button>
      </div>
      <div>
        <label>
          Concurrency
          <input
            type="number"
            min={1}
            value={props.values.concurrency}
            onChange={(event) => props.onChange("concurrency", Number(event.target.value) || 1)}
          />
        </label>
      </div>
      <div>
        <label>
          Retries
          <input
            type="number"
            min={0}
            value={props.values.retries}
            onChange={(event) => props.onChange("retries", Number(event.target.value) || 0)}
          />
        </label>
      </div>
      <div>
        <button type="button" onClick={props.onSubmit} disabled={props.isRunning || !props.values.url || !props.values.outputDir}>
          Start
        </button>
        <button type="button" onClick={props.onStop} disabled={!props.isRunning}>
          Stop
        </button>
        <button type="button" onClick={props.onOpenOutputDir} disabled={!props.values.outputDir || !props.hasApi}>
          Open Output
        </button>
      </div>
      {!props.hasApi ? <p>Preload API unavailable. UI is running in fallback mode.</p> : null}
    </section>
  );
}
