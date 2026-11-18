import { useEffect, useState } from "react";
import { useApp } from "../store";
import { useRoom } from "../lib/room";
import PageHeader from "../components/PageHeader";
import RoomView from "../components/RoomView";
import Icon from "../components/Icon";

/** Resident side: invite family, see who is online, message and video-call. */
export default function Family() {
  const { t } = useApp();
  const { code } = useRoom();
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState(location.origin);
  // "localhost" only works on this computer, so use the network address for the link family will open
  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) return;
    fetch("/api/network").then((r) => r.json()).then((d) => {
      if (d.ips?.length) setBase(`${location.protocol}//${d.ips[0]}${location.port ? ":" + location.port : ""}`);
    }).catch(() => {});
  }, []);
  const link = `${base}/join/${code}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }
  async function share() {
    try { await navigator.share?.({ title: "Medicare", text: t("inviteText"), url: link }); } catch { /* cancelled */ }
  }

  return (
    <div className="page">
      <PageHeader icon="video" title={t("family")} color="var(--g-green)" sub={t("familySub")} />

      <RoomView
        me="resident"
        aside={
      <div className="card invite">
        <h2><Icon name="link" size={22} /> {t("inviteFamily")}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{t("inviteHelp")}</p>
        <div className="code">{code}</div>
        <div className="linkbox">{link}</div>
        <p className="muted" style={{ margin: ".6rem 0 0", fontSize: ".9rem" }}>{t("sameWifi")}</p>
        <div className="row" style={{ marginTop: ".7rem" }}>
          <button className="primary" onClick={copy}>{copied ? `✓ ${t("copied")}` : t("copyLink")}</button>
          {"share" in navigator && <button onClick={share}>{t("share")}</button>}
        </div>
      </div>
        }
      />
    </div>
  );
}
