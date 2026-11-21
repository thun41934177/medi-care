import Icon, { IconName } from "./Icon";

/** Page title: small outline icon, heading and an optional one-line description. */
export default function PageHeader({ icon, title, sub }: { icon: IconName; title: string; color?: string; sub?: string }) {
  return (
    <div className="page-head">
      <span className="page-head-ico"><Icon name={icon} size={28} /></span>
      <div>
        <h1>{title}</h1>
        {sub && <div className="muted">{sub}</div>}
      </div>
    </div>
  );
}
