import styles from "./ui.module.css";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  isActive?: boolean;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function Timeline({ events, className = "" }: TimelineProps) {
  return (
    <ol
      className={`${styles.timeline} ${className}`}
      style={{ listStyle: "none", padding: 0, margin: 0 }}
    >
      {events.map((evt) => (
        <li key={evt.id} className={styles.timelineItem}>
          <div
            className={`${styles.timelineDot} ${evt.isActive ? styles.timelineDotActive : ""}`}
            aria-hidden="true"
          />
          <div className={styles.timelineContent}>
            <span className={styles.timelineTime}>{evt.timestamp}</span>
            <span className={styles.timelineTitle}>{evt.title}</span>
            {evt.description && <span className={styles.timelineDesc}>{evt.description}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
