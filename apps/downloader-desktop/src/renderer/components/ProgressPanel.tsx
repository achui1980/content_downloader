import type { AppStatus } from "../state";

interface ProgressPanelProps {
  status: AppStatus;
  progressIndex: number;
  progressTotal: number;
}

export function ProgressPanel(props: ProgressPanelProps) {
  const progressText = props.progressTotal > 0 ? `${props.progressIndex} / ${props.progressTotal}` : "-";

  return (
    <section>
      <h2>Progress</h2>
      <p>Status: {props.status}</p>
      <p>Chapters: {progressText}</p>
    </section>
  );
}
