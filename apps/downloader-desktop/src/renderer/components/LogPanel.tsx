interface LogPanelProps {
  logs: string[];
}

export function LogPanel(props: LogPanelProps) {
  return (
    <section className="card card--logs">
      <h2>Logs</h2>
      <div className="log-list-wrap">
        {props.logs.length === 0 ? <p>No logs yet.</p> : null}
        <ul className="log-list">
          {props.logs.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
