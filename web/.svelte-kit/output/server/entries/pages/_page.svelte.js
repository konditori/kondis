import { s as spread_props, b as attr, e as escape_html, a9 as derived, h as head, a as ensure_array_like } from "../../chunks/index.js";
import { a as activityName, l as localTime, G as Gauge, d as distance, C as Clock_3, b as duration, M as Mountain, s as sportIcon, c as localDate } from "../../chunks/format.js";
import { I as Icon } from "../../chunks/Icon.js";
import { A as Activity } from "../../chunks/activity.js";
function Arrow_up_right($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M7 7h10v10" }],
    ["path", { "d": "M7 17 17 7" }]
  ];
  Icon($$renderer, spread_props([{ name: "arrow-up-right" }, props, { iconNode }]));
}
function Cloud_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057"
      }
    ],
    [
      "path",
      {
        "d": "M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78"
      }
    ],
    ["path", { "d": "m2 2 20 20" }]
  ];
  Icon($$renderer, spread_props([{ name: "cloud-off" }, props, { iconNode }]));
}
function Search($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m21 21-4.34-4.34" }],
    ["circle", { "cx": "11", "cy": "11", "r": "8" }]
  ];
  Icon($$renderer, spread_props([{ name: "search" }, props, { iconNode }]));
}
function ActivityCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { activity } = $$props;
    const Icon2 = derived(() => sportIcon(activity.sport));
    $$renderer2.push(`<a class="activity-card"${attr("href", `/activities/${activity.id}`)}><div class="sport-badge">`);
    if (Icon2()) {
      $$renderer2.push("<!--[-->");
      Icon2()($$renderer2, { size: 24, strokeWidth: 1.8 });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</div> <div class="activity-primary"><div class="activity-title"><h3>${escape_html(activityName(activity))}</h3>`);
    Arrow_up_right($$renderer2, { size: 17 });
    $$renderer2.push(`<!----></div> <p><span>${escape_html(localTime(activity.startedAt))}</span>${escape_html(activity.subSport ? ` · ${activity.subSport.replaceAll("_", " ")}` : "")}</p></div> <div class="activity-stat">`);
    Gauge($$renderer2, { size: 16 });
    $$renderer2.push(`<!----><span><strong>${escape_html(distance(activity.distance))}</strong><small>Distance</small></span></div> <div class="activity-stat">`);
    Clock_3($$renderer2, { size: 16 });
    $$renderer2.push(`<!----><span><strong>${escape_html(duration(activity.movingTime ?? activity.elapsedTime))}</strong><small>Moving time</small></span></div> <div class="activity-stat optional">`);
    Mountain($$renderer2, { size: 16 });
    $$renderer2.push(`<!----><span><strong>${escape_html(activity.elevationGain == null ? "—" : `${Math.round(activity.elevationGain)} m`)}</strong><small>Elevation</small></span></div></a>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let query = "";
    const filtered = derived(() => data.activities.filter((activity) => `${activity.name ?? ""} ${activity.sport} ${activity.subSport ?? ""}`.toLowerCase().includes(query.toLowerCase())));
    const groups = derived(() => Object.entries(Object.groupBy(filtered(), (activity) => localDate(activity.startedAt))));
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Activities · Kondis</title>`);
      });
    });
    $$renderer2.push(`<div class="page-shell"><header class="page-header"><div><span class="eyebrow">Your archive</span><h1>Activities</h1><p>${escape_html(data.activities.length)} workouts, all in one place.</p></div> <label class="search">`);
    Search($$renderer2, { size: 18 });
    $$renderer2.push(`<!----><input${attr("value", query)} placeholder="Search activities" aria-label="Search activities"/></label></header> `);
    if (data.unavailable) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="notice">`);
      Cloud_off($$renderer2, { size: 20 });
      $$renderer2.push(`<!----><span><strong>Server unavailable</strong> Start the Kondis API to load your activities.</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (groups().length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="timeline"><!--[-->`);
      const each_array = ensure_array_like(groups());
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let [date, activities] = each_array[$$index_1];
        $$renderer2.push(`<section class="day-group"><div class="date-rail"><span></span><h2>${escape_html(date)}</h2><small>${escape_html(activities?.length)}</small></div> <div class="activity-list"><!--[-->`);
        const each_array_1 = ensure_array_like(activities ?? []);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let activity = each_array_1[$$index];
          ActivityCard($$renderer2, { activity });
        }
        $$renderer2.push(`<!--]--></div></section>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else if (!data.unavailable) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="empty-state"><span class="empty-icon">`);
      Activity($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></span> <h2>${escape_html("Your first activity starts here")}</h2> <p>${escape_html("Import a FIT file to build your private training archive.")}</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
