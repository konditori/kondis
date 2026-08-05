import { s as spread_props, h as head, e as escape_html, a as ensure_array_like, a9 as derived } from "../../../../chunks/index.js";
import { I as Icon } from "../../../../chunks/Icon.js";
import { a as activityName, c as localDate, C as Clock_3, l as localTime, s as sportIcon, G as Gauge, M as Mountain, d as distance, b as duration, e as speed } from "../../../../chunks/format.js";
import { A as Arrow_left } from "../../../../chunks/arrow-left.js";
import { H as Heart_pulse } from "../../../../chunks/heart-pulse.js";
function Calendar_days($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M8 2v3" }],
    ["path", { "d": "M16 2v3" }],
    [
      "rect",
      { "x": "3", "y": "3", "width": "18", "height": "18", "rx": "2" }
    ],
    ["path", { "d": "M3 9h18" }],
    ["path", { "d": "M8 13h.01" }],
    ["path", { "d": "M12 13h.01" }],
    ["path", { "d": "M16 13h.01" }],
    ["path", { "d": "M8 17h.01" }],
    ["path", { "d": "M12 17h.01" }],
    ["path", { "d": "M16 17h.01" }]
  ];
  Icon($$renderer, spread_props([{ name: "calendar-days" }, props, { iconNode }]));
}
function Flame($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "flame" }, props, { iconNode }]));
}
function Map_pin_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12.75 7.09a3 3 0 0 1 2.16 2.16" }],
    [
      "path",
      {
        "d": "M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568"
      }
    ],
    ["path", { "d": "m2 2 20 20" }],
    [
      "path",
      {
        "d": "M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533"
      }
    ],
    ["path", { "d": "M9.13 9.13a3 3 0 0 0 3.74 3.74" }]
  ];
  Icon($$renderer, spread_props([{ name: "map-pin-off" }, props, { iconNode }]));
}
function Timer($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["line", { "x1": "10", "x2": "14", "y1": "2", "y2": "2" }],
    ["line", { "x1": "12", "x2": "15", "y1": "14", "y2": "11" }],
    ["circle", { "cx": "12", "cy": "14", "r": "8" }]
  ];
  Icon($$renderer, spread_props([{ name: "timer" }, props, { iconNode }]));
}
function Zap($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "zap" }, props, { iconNode }]));
}
function RouteMap($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { coordinates } = $$props;
    if (coordinates && coordinates.length >= 2) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="route-map" aria-label="Activity route map"></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="map-empty">`);
      Map_pin_off($$renderer2, { size: 27 });
      $$renderer2.push(`<!----><strong>No GPS route</strong><span>This activity did not include location data.</span></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const activity = derived(() => data.activity);
    const Icon2 = derived(() => sportIcon(activity().sport));
    const stats = derived(() => [
      {
        label: "Distance",
        value: distance(activity().distance),
        icon: Gauge
      },
      {
        label: "Moving time",
        value: duration(activity().movingTime ?? activity().elapsedTime),
        icon: Timer
      },
      {
        label: "Elapsed time",
        value: duration(activity().elapsedTime),
        icon: Clock_3
      },
      {
        label: "Elevation gain",
        value: activity().elevationGain == null ? "—" : `${Math.round(activity().elevationGain)} m`,
        icon: Mountain
      },
      {
        label: "Average speed",
        value: speed(activity().avgSpeed),
        icon: Gauge
      },
      {
        label: "Average heart rate",
        value: activity().avgHr == null ? "—" : `${activity().avgHr} bpm`,
        icon: Heart_pulse
      },
      {
        label: "Average power",
        value: activity().avgPower == null ? "—" : `${activity().avgPower} W`,
        icon: Zap
      },
      {
        label: "Energy",
        value: activity().calories == null ? "—" : `${activity().calories} kcal`,
        icon: Flame
      }
    ]);
    head("1vb1e6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(activityName(activity()))} · Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="detail-page"><header class="detail-header"><a class="back-link" href="/">`);
    Arrow_left($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> All activities</a> <div class="detail-heading"><span class="detail-sport">`);
    if (Icon2()) {
      $$renderer2.push("<!--[-->");
      Icon2()($$renderer2, { size: 27 });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</span> <div><span class="eyebrow">${escape_html(activity().sport.replaceAll("_", " "))}${escape_html(activity().subSport ? ` · ${activity().subSport.replaceAll("_", " ")}` : "")}</span><h1>${escape_html(activityName(activity()))}</h1></div></div> <div class="detail-date"><span>`);
    Calendar_days($$renderer2, { size: 17 });
    $$renderer2.push(`<!---->${escape_html(localDate(activity().startedAt))}</span><span>`);
    Clock_3($$renderer2, { size: 17 });
    $$renderer2.push(`<!---->${escape_html(localTime(activity().startedAt))}</span></div></header> <section class="map-panel">`);
    RouteMap($$renderer2, { coordinates: activity().track?.coordinates ?? null });
    $$renderer2.push(`<!----> `);
    if (activity().track) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="map-key"><span><i class="start-dot"></i> Start</span><span><i class="finish-dot"></i> Finish</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section> <section class="metrics-section"><div class="section-heading"><div><span class="eyebrow">Workout summary</span><h2>At a glance</h2></div></div> <div class="metric-grid"><!--[-->`);
    const each_array = ensure_array_like(stats());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let stat = each_array[$$index];
      $$renderer2.push(`<article class="metric"><span>`);
      if (stat.icon) {
        $$renderer2.push("<!--[-->");
        stat.icon($$renderer2, { size: 19 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(`</span><div><small>${escape_html(stat.label)}</small><strong>${escape_html(stat.value)}</strong></div></article>`);
    }
    $$renderer2.push(`<!--]--></div></section></div>`);
  });
}
export {
  _page as default
};
