import Icon, { IconName } from "./Icon";

export default function PageHeader({ icon, title, color, sub }: { icon: IconName; title: string; color: string; sub?: string }) {
  return (
    <div className="page-head">
      <span className="page-head-ico" style={{ background: color }}><Icon name={icon} size={30} /></span>
      <div>
        <h1>{title}</h1>
        {sub && <div className="muted">{sub}</div>}
      </div>
    </div>
  );
}
