import { Link } from "react-router-dom";
import { useApp } from "../store";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";

/** Mode 1: Anti-loneliness */
export default function Friend() {
  const { t } = useApp();
  return (
    <div className="page">
      <Link to="/modes" className="change-mode"><Icon name="back" size={18} /> {t("changeMode")}</Link>
      <PageHeader icon="heart" title={t("modeFriend")} color="var(--g-blue)" sub={t("modeFriendDesc")} />

      <Link to="/live" className="tile wide call-tile">
        <span className="ico"><Icon name="phone" size={34} /></span>
        <span>{t("callAi")}<small>{t("callAiSub")}</small></span>
      </Link>

      <div className="grid2" style={{ marginTop: "1rem" }}>
        <Link to="/family" className="tile" data-tone="green">
          <span className="ico"><Icon name="video" size={32} /></span>
          {t("family")}
          <small style={{ fontWeight: 700, fontSize: ".95rem", opacity: .9 }}>{t("familySub")}</small>
        </Link>
        <Link to="/games" className="tile" data-tone="orange">
          <span className="ico"><Icon name="game" size={32} /></span>
          {t("games")}
        </Link>
        <Link to="/chat" className="tile" data-tone="blue">
          <span className="ico"><Icon name="chat" size={32} /></span>
          {t("talk")}
        </Link>
      </div>
    </div>
  );
}
