import WebSocket from "ws";

export type RobotCommand =
  | { type: "speak"; text: string }
  | { type: "move"; dir: "forward" | "back" | "left" | "right"; speed?: number }
  | { type: "face"; emotion: "happy" | "sad" | "neutral" | "alert" }
  | { type: "led"; color: string }
  | { type: "stop" };

export type RobotEvent =
  | { type: "sensor"; name: string; value: number }
  | { type: "button"; id: string }
  | { type: "battery"; pct: number }
  | { type: "fall_detected" };

export interface RobotAdapter {
  name: string;
  connected(): boolean;
  send(cmd: RobotCommand): void;
  onEvent(cb: (e: RobotEvent) => void): void;
}

/** Default: logs commands, so the app works with no robot attached. */
export class MockAdapter implements RobotAdapter {
  name = "mock";
  private cbs: ((e: RobotEvent) => void)[] = [];
  connected() { return true; }
  send(cmd: RobotCommand) { console.log("[robot:mock]", JSON.stringify(cmd)); }
  onEvent(cb: (e: RobotEvent) => void) { this.cbs.push(cb); }
  emit(e: RobotEvent) { this.cbs.forEach((c) => c(e)); }
}

/** ESP32 (or any board) running a WebSocket server that speaks the JSON protocol. */
export class WebSocketAdapter implements RobotAdapter {
  name = "websocket";
  private ws?: WebSocket;
  private cbs: ((e: RobotEvent) => void)[] = [];
  constructor(private url: string) { this.connect(); }
  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.on("open", () => console.log("[robot] connected", this.url));
    ws.on("message", (d) => { try { const e = JSON.parse(d.toString()); this.cbs.forEach((c) => c(e)); } catch {} });
    ws.on("close", () => setTimeout(() => this.connect(), 3000));
    ws.on("error", () => ws.close());
  }
  connected() { return this.ws?.readyState === WebSocket.OPEN; }
  send(cmd: RobotCommand) { if (this.connected()) this.ws!.send(JSON.stringify(cmd)); }
  onEvent(cb: (e: RobotEvent) => void) { this.cbs.push(cb); }
}

export function createRobot(): RobotAdapter {
  if (process.env.ROBOT_MODE === "websocket" && process.env.ROBOT_WS_URL) return new WebSocketAdapter(process.env.ROBOT_WS_URL);
  return new MockAdapter();
}
