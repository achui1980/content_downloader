interface LogPanelProps {
  logs: string[];
}

export function LogPanel(props: LogPanelProps) {
  return (
    <section>
      <h2>Logs</h2>
      <div>
        {props.logs.length === 0 ? <p>No logs yet.</p> : null}
        <ul>
          {props.logs.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
