import { s as spread_props } from "./index.js";
import { I as Icon } from "./Icon.js";
function Bike($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "18.5", "cy": "17.5", "r": "3.5" }],
    ["circle", { "cx": "5.5", "cy": "17.5", "r": "3.5" }],
    ["circle", { "cx": "15", "cy": "5", "r": "1" }],
    ["path", { "d": "M12 17.5V14l-3-3 4-3 2 3h2" }]
  ];
  Icon($$renderer, spread_props([{ name: "bike" }, props, { iconNode }]));
}
function Clock_3($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "M12 6v6h4" }]
  ];
  Icon($$renderer, spread_props([{ name: "clock-3" }, props, { iconNode }]));
}
function Dumbbell($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"
      }
    ],
    ["path", { "d": "m2.5 21.5 1.4-1.4" }],
    ["path", { "d": "m20.1 3.9 1.4-1.4" }],
    [
      "path",
      {
        "d": "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"
      }
    ],
    ["path", { "d": "m9.6 14.4 4.8-4.8" }]
  ];
  Icon($$renderer, spread_props([{ name: "dumbbell" }, props, { iconNode }]));
}
function Footprints($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"
      }
    ],
    [
      "path",
      {
        "d": "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"
      }
    ],
    ["path", { "d": "M16 17h4" }],
    ["path", { "d": "M4 13h4" }]
  ];
  Icon($$renderer, spread_props([{ name: "footprints" }, props, { iconNode }]));
}
function Gauge($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m12 14 4-4" }],
    ["path", { "d": "M3.34 19a10 10 0 1 1 17.32 0" }]
  ];
  Icon($$renderer, spread_props([{ name: "gauge" }, props, { iconNode }]));
}
function Mountain($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "m8 3 4 8 5-5 5 15H2L8 3z" }]];
  Icon($$renderer, spread_props([{ name: "mountain" }, props, { iconNode }]));
}
function Person_standing($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "5", "r": "1" }],
    ["path", { "d": "m9 20 3-6 3 6" }],
    ["path", { "d": "m6 8 6 2 6-2" }],
    ["path", { "d": "M12 10v4" }]
  ];
  Icon($$renderer, spread_props([{ name: "person-standing" }, props, { iconNode }]));
}
function Waves_horizontal($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M2 12q2.5 2 5 0t5 0 5 0 5 0" }],
    ["path", { "d": "M2 19q2.5 2 5 0t5 0 5 0 5 0" }],
    ["path", { "d": "M2 5q2.5 2 5 0t5 0 5 0 5 0" }]
  ];
  Icon($$renderer, spread_props([{ name: "waves-horizontal" }, props, { iconNode }]));
}
function activityName(activity) {
  if (activity.name) return activity.name;
  return activity.sport.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function sportIcon(sport) {
  const normalized = sport.toLowerCase();
  if (normalized.includes("cycl") || normalized.includes("bike")) return Bike;
  if (normalized.includes("run") || normalized.includes("walk")) return Footprints;
  if (normalized.includes("swim")) return Waves_horizontal;
  if (normalized.includes("hike") || normalized.includes("mountain")) return Mountain;
  if (normalized.includes("strength") || normalized.includes("training")) return Dumbbell;
  return Person_standing;
}
function distance(value) {
  return value == null ? "—" : `${(value / 1e3).toFixed(value >= 1e4 ? 1 : 2)} km`;
}
function duration(seconds) {
  if (seconds == null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : `${minutes} min`;
}
function speed(value) {
  return value == null ? "—" : `${(value * 3.6).toFixed(1)} km/h`;
}
function localDate(value) {
  return new Intl.DateTimeFormat(void 0, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(value)
  );
}
function localTime(value) {
  return new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
export {
  Clock_3 as C,
  Gauge as G,
  Mountain as M,
  activityName as a,
  duration as b,
  localDate as c,
  distance as d,
  speed as e,
  localTime as l,
  sportIcon as s
};
