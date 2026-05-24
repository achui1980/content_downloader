import type { AppStatus } from "../state";

interface ResultPanelProps {
  status: AppStatus;
  message: string | null;
}

export function ResultPanel(props: ResultPanelProps) {
  return (
    <section>
      <h2>Result</h2>
      <p>State: {props.status}</p>
      <p>{props.message ?? "No result yet."}</p>
    </section>
  );
}
