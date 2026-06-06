import type { AppStatus } from "../state";

interface ResultPanelProps {
  status: AppStatus;
  message: string | null;
}

export function ResultPanel(props: ResultPanelProps) {
  return (
    <section className="card">
      <h2>Result</h2>
      <p>
        State <span className={`status-pill status-pill--${props.status}`}>{props.status}</span>
      </p>
      <p className="result-message">{props.message ?? "No result yet."}</p>
    </section>
  );
}
