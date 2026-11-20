import Icon, { IconName } from "./Icon";

/** Calm placeholder shown when a list has nothing in it yet. */
export default function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-ico"><Icon name={icon} size={28} /></span>
      <b>{title}</b>
      {hint && <p>{hint}</p>}
    </div>
  );
}
