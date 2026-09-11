const VERSION = "0.1.0";

class HAHouseStatusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._sig = "";
  }
  static getStubConfig() {
    return {
      title: "Husets status",
      locks: [],
      door_entities: [],
      open_count_entity: "sensor.open_windows",
      alarm_entity: "alarm_control_panel.example",
      garage_entity: "cover.example_garage",
      persons: [],
      appliances: [],
      robots: [],
    };
  }
  setConfig(config) {
    this._config = { title: "Husets status", locks: [], door_entities: [], persons: [], appliances: [], robots: [], ...config };
    this._render();
  }
  _watchedIds() {
    const c = this._config;
    return [
      ...(c.locks || []).map((l) => l.entity),
      ...(c.door_entities || []),
      c.open_count_entity,
      c.alarm_entity,
      c.secondary_alarm_entity,
      c.garage_entity,
      ...(c.persons || []).map((p) => p.entity),
      ...(c.appliances || []).map((a) => a.entity),
      ...(c.robots || []).map((r) => r.entity),
    ].filter(Boolean);
  }
  set hass(hass) {
    this._hass = hass;
    const ids = this._watchedIds();
    const sig = JSON.stringify(ids.map((id) => [id, hass?.states?.[id]?.state]));
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }
  _e(id) {
    return id ? this._hass?.states?.[id] : undefined;
  }
  _s(id) {
    return this._e(id)?.state;
  }
  _esc(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  _more(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  _navigate(path) {
    if (!path) return;
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
  }

  _locksInfo() {
    const locks = this._config.locks || [];
    if (!locks.length) return null;
    const unlocked = locks.filter((l) => this._s(l.entity) === "unlocked");
    return {
      ok: unlocked.length === 0,
      count: unlocked.length,
      total: locks.length,
      detail: unlocked.length ? unlocked.map((l) => l.name).join(", ") : "Alle låst",
    };
  }
  _doorsInfo() {
    const doors = this._config.door_entities || [];
    const openCount = this._config.open_count_entity ? Number(this._s(this._config.open_count_entity)) : doors.filter((id) => this._s(id) === "on").length;
    return { ok: !openCount, count: Number.isFinite(openCount) ? openCount : 0 };
  }
  _alarmInfo() {
    const id = this._config.alarm_entity;
    if (!id) return null;
    const state = this._s(id);
    const armed = ["armed_home", "armed_away", "armed_night", "armed_vacation"].includes(state);
    const labels = { armed_home: "Hjemme", armed_away: "Ude", armed_night: "Nat", armed_vacation: "Ferie", disarmed: "Fra", pending: "Aktiverer", triggered: "UDLØST" };
    return { ok: state !== "triggered", armed, state, label: labels[state] || state || "—" };
  }
  _garageInfo() {
    const id = this._config.garage_entity;
    if (!id) return null;
    const open = this._s(id) === "open";
    return { ok: !open, open };
  }
  _personsInfo() {
    const persons = this._config.persons || [];
    if (!persons.length) return null;
    const home = persons.filter((p) => this._s(p.entity) === "home");
    return { home: home.length, total: persons.length, names: home.map((p) => p.name) };
  }
  _appliancesInfo() {
    const apps = this._config.appliances || [];
    if (!apps.length) return null;
    const running = apps.filter((a) => this._s(a.entity) === "on");
    return { running: running.length, names: running.map((a) => a.name) };
  }
  _robotsInfo() {
    const robots = this._config.robots || [];
    if (!robots.length) return null;
    const activeStates = ["cleaning", "mowing", "returning", "paused", "edgecut"];
    const active = robots.filter((r) => activeStates.includes(this._s(r.entity)));
    const errored = robots.filter((r) => r.error_entity && !["off", "none", "no_error", "unknown", "unavailable"].includes(this._s(r.error_entity)));
    return { active: active.length, errored: errored.length, names: active.map((r) => r.name) };
  }

  _tile({ icon, tone, label, value, detail, entity, path }) {
    return `<button class="tile" style="--tone:${tone}" ${entity ? `data-entity="${this._esc(entity)}"` : ""} ${path ? `data-nav="${this._esc(path)}"` : ""}>
      <ha-icon icon="${this._esc(icon)}"></ha-icon>
      <div class="tile-text"><span>${this._esc(label)}</span><strong>${this._esc(value)}</strong>${detail ? `<small>${this._esc(detail)}</small>` : ""}</div>
    </button>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const locks = this._locksInfo();
    const doors = this._doorsInfo();
    const alarm = this._alarmInfo();
    const garage = this._garageInfo();
    const persons = this._personsInfo();
    const appliances = this._appliancesInfo();
    const robots = this._robotsInfo();

    const issues = [
      locks && !locks.ok,
      !doors.ok,
      alarm && !alarm.ok,
      garage && !garage.ok,
      robots && robots.errored,
    ].filter(Boolean).length;

    const heroOk = issues === 0;
    const heroText = heroOk ? "Alt i orden" : `${issues} ${issues === 1 ? "ting" : "ting"} at tjekke`;

    const tiles = [];
    if (locks) tiles.push(this._tile({
      icon: locks.ok ? "mdi:lock-check-outline" : "mdi:lock-alert-outline",
      tone: locks.ok ? "var(--good)" : "var(--danger)",
      label: "Låse", value: locks.ok ? "Låst" : `${locks.count} ulåst`, detail: locks.ok ? "" : locks.detail,
      path: this._config.security_path,
    }));
    tiles.push(this._tile({
      icon: doors.ok ? "mdi:window-closed-variant" : "mdi:window-open-variant",
      tone: doors.ok ? "var(--good)" : "var(--warn)",
      label: "Døre & vinduer", value: doors.ok ? "Lukket" : `${doors.count} åben${doors.count === 1 ? "" : "e"}`,
      path: this._config.security_path,
    }));
    if (alarm) tiles.push(this._tile({
      icon: alarm.state === "triggered" ? "mdi:alarm-light" : alarm.armed ? "mdi:shield-lock-outline" : "mdi:shield-off-outline",
      tone: alarm.state === "triggered" ? "var(--danger)" : alarm.armed ? "var(--good)" : "var(--warn)",
      label: "Alarm", value: alarm.label, entity: this._config.alarm_entity,
    }));
    if (garage) tiles.push(this._tile({
      icon: garage.open ? "mdi:garage-open-variant" : "mdi:garage-variant",
      tone: garage.ok ? "var(--good)" : "var(--warn)",
      label: "Garageport", value: garage.open ? "Åben" : "Lukket", entity: this._config.garage_entity,
    }));
    if (persons) tiles.push(this._tile({
      icon: "mdi:home-account",
      tone: "var(--accent)",
      label: "Hjemme", value: `${persons.home} / ${persons.total}`, detail: persons.names.join(", "),
    }));
    if (appliances) tiles.push(this._tile({
      icon: "mdi:washing-machine",
      tone: appliances.running ? "var(--accent)" : "var(--good)",
      label: "Apparater", value: appliances.running ? `${appliances.running} kører` : "I ro", detail: appliances.names.join(", "),
    }));
    if (robots) tiles.push(this._tile({
      icon: robots.errored ? "mdi:robot-off-outline" : "mdi:robot-mower-outline",
      tone: robots.errored ? "var(--danger)" : robots.active ? "var(--accent)" : "var(--good)",
      label: "Robotter", value: robots.errored ? `${robots.errored} fejl` : robots.active ? `${robots.active} i gang` : "I dock", detail: robots.names.join(", "),
      path: this._config.robots_path,
    }));

    this.shadowRoot.innerHTML = `<style>
      :host{display:block;--accent:var(--dashboard-accent, var(--primary-color, #62b5ff));--good:var(--dashboard-success, var(--success-color, #54d9aa));--warn:var(--dashboard-warning, var(--warning-color, #ffbd59));--danger:var(--dashboard-danger, var(--error-color, #ff667a));--edge:var(--dashboard-border-neutral, var(--divider-color, rgba(127,145,165,.2)));--card-surface:var(--dashboard-card-bg,var(--surface,var(--ha-card-background,var(--card-background-color,#111820))))}
      *{box-sizing:border-box}
      ha-card{position:relative;overflow:hidden;height:100%;padding:20px;border-radius:22px;background:var(--card-surface);color:var(--primary-text-color);box-shadow:var(--ha-card-box-shadow);display:flex;flex-direction:column}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
      .head-text{display:flex;align-items:center;gap:10px;min-width:0}
      .head-icon{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border-radius:13px;background:color-mix(in srgb,${heroOk ? "var(--good)" : "var(--danger)"} 16%,transparent);color:${heroOk ? "var(--good)" : "var(--danger)"}}
      .head-icon ha-icon{--mdc-icon-size:22px}
      h2{margin:0;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .hero-sub{margin-top:2px;font-size:11px;font-weight:700;color:${heroOk ? "var(--good)" : "var(--danger)"};text-transform:uppercase;letter-spacing:.04em}
      .pulse{width:8px;height:8px;border-radius:50%;background:${heroOk ? "var(--good)" : "var(--danger)"};box-shadow:0 0 10px ${heroOk ? "var(--good)" : "var(--danger)"};flex:0 0 auto;animation:pulse 2.2s ease-in-out infinite}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;flex:1}
      .tile{--tone:var(--accent);position:relative;display:flex;align-items:center;gap:10px;padding:12px 12px;border:1px solid color-mix(in srgb,var(--tone) 18%,var(--edge));border-left:3px solid var(--tone);border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 7%,transparent),transparent 55%);box-shadow:0 4px 12px rgba(0,0,0,.08);color:var(--primary-text-color);cursor:pointer;text-align:left;font:inherit;min-width:0}
      .tile:hover{border-color:var(--tone)}
      .tile ha-icon{--mdc-icon-size:21px;color:var(--tone);flex:0 0 auto}
      .tile-text{min-width:0;display:flex;flex-direction:column}
      .tile-text span{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--secondary-text-color)}
      .tile-text strong{margin-top:2px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .tile-text small{margin-top:1px;font-size:9px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @keyframes pulse{50%{opacity:.4;transform:scale(1.5)}}
      @media(max-width:420px){.grid{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){*{animation:none!important}}
    </style>
    <ha-card>
      <div class="head">
        <div class="head-text">
          <div class="head-icon"><ha-icon icon="${heroOk ? "mdi:home-check-outline" : "mdi:home-alert-outline"}"></ha-icon></div>
          <div>
            <h2>${this._esc(this._config.title)}</h2>
            <div class="hero-sub">${this._esc(heroText)}</div>
          </div>
        </div>
        <div class="pulse"></div>
      </div>
      <div class="grid">${tiles.join("")}</div>
    </ha-card>`;

    this.shadowRoot.querySelectorAll(".tile").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.dataset.nav) this._navigate(el.dataset.nav);
        else if (el.dataset.entity) this._more(el.dataset.entity);
      });
    });
  }
  getCardSize() {
    return 4;
  }
}

if (!customElements.get("ha-house-status-card"))
  customElements.define("ha-house-status-card", HAHouseStatusCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-house-status-card",
  name: "HA House Status Card",
  description: "Komplet statusoverblik: låse, døre/vinduer, alarm, garage, hjemme, apparater og robotter",
  preview: true,
});
console.info(
  `%c HA HOUSE STATUS CARD %c v${VERSION} `,
  "color:white;background:#3f7fbf;font-weight:700",
  "color:#9dc8ff;background:#161b22",
);
