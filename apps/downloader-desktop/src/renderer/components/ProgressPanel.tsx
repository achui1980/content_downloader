import type { AppStatus } from "../state";

interface ProgressPanelProps {
  status: AppStatus;
  progressIndex: number;
  progressTotal: number;
}

export function ProgressPanel(props: ProgressPanelProps) {
  const hasProgress = props.progressTotal > 0;
  const clampedIndex = Math.max(0, props.progressIndex);
  const progressText = hasProgress ? `${clampedIndex} / ${props.progressTotal}` : "-";
  const percent = hasProgress ? Math.min(100, Math.round((clampedIndex / props.progressTotal) * 100)) : 0;

  return (
    <section className="card">
      <h2>Progress</h2>
      <div className="progress-meta">
        <p>
          Status <strong>{props.status}</strong>
        </p>
        <p>
          Chapters <strong>{progressText}</strong>
        </p>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="progress-percent">{percent}%</p>
    </section>
  );
}
