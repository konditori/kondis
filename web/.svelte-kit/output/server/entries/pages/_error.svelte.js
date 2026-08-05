import { s as spread_props, e as escape_html } from "../../chunks/index.js";
import { p as page } from "../../chunks/index2.js";
import { I as Icon } from "../../chunks/Icon.js";
import { A as Arrow_left } from "../../chunks/arrow-left.js";
function Route_off($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "6", "cy": "19", "r": "3" }],
    ["path", { "d": "M9 19h8.5c.4 0 .9-.1 1.3-.2" }],
    ["path", { "d": "M5.2 5.2A3.5 3.53 0 0 0 6.5 12H12" }],
    ["path", { "d": "m2 2 20 20" }],
    ["path", { "d": "M21 15.3a3.5 3.5 0 0 0-3.3-3.3" }],
    ["path", { "d": "M15 5h-4.3" }],
    ["circle", { "cx": "18", "cy": "5", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "route-off" }, props, { iconNode }]));
}
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="empty-state error-page"><span class="empty-icon">`);
    Route_off($$renderer2, { size: 28 });
    $$renderer2.push(`<!----></span> <span class="eyebrow">Error ${escape_html(page.status)}</span> <h1>${escape_html(page.error?.message ?? "Something went wrong")}</h1> <a class="back-link" href="/">`);
    Arrow_left($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> Return to activities</a></div>`);
  });
}
export {
  _error as default
};
