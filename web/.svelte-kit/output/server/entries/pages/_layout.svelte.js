import { s as spread_props, a as ensure_array_like, b as attr, c as attr_class, e as escape_html, d as bind_props, h as head } from "../../chunks/index.js";
import { p as page } from "../../chunks/index2.js";
import { H as Heart_pulse } from "../../chunks/heart-pulse.js";
import { I as Icon } from "../../chunks/Icon.js";
import { A as Activity } from "../../chunks/activity.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
function Chart_no_axes_column_increasing($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M5 21v-6" }],
    ["path", { "d": "M12 21V9" }],
    ["path", { "d": "M19 21V3" }]
  ];
  Icon($$renderer, spread_props([
    { name: "chart-no-axes-column-increasing" },
    props,
    { iconNode }
  ]));
}
function Check($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "M20 6 9 17l-5-5" }]];
  Icon($$renderer, spread_props([{ name: "check" }, props, { iconNode }]));
}
function Circle_user_round($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M17.925 20.056a6 6 0 0 0-11.851.001" }],
    ["circle", { "cx": "12", "cy": "11", "r": "4" }],
    ["circle", { "cx": "12", "cy": "12", "r": "10" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-user-round" }, props, { iconNode }]));
}
function File_up($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
      }
    ],
    ["path", { "d": "M14 2v5a1 1 0 0 0 1 1h5" }],
    ["path", { "d": "M12 12v6" }],
    ["path", { "d": "m15 15-3-3-3 3" }]
  ];
  Icon($$renderer, spread_props([{ name: "file-up" }, props, { iconNode }]));
}
function Loader_circle($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [["path", { "d": "M21 12a9 9 0 1 1-6.219-8.56" }]];
  Icon($$renderer, spread_props([{ name: "loader-circle" }, props, { iconNode }]));
}
function Settings($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "settings" }, props, { iconNode }]));
}
function Upload($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M12 3v12" }],
    ["path", { "d": "m17 8-5-5-5 5" }],
    ["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
  ];
  Icon($$renderer, spread_props([{ name: "upload" }, props, { iconNode }]));
}
function X($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M18 6 6 18" }],
    ["path", { "d": "m6 6 12 12" }]
  ];
  Icon($$renderer, spread_props([{ name: "x" }, props, { iconNode }]));
}
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const items = [
      { href: "/", label: "Activities", icon: Activity },
      {
        href: "/insights",
        label: "Insights",
        icon: Chart_no_axes_column_increasing,
        disabled: true
      }
    ];
    $$renderer2.push(`<aside class="sidebar"><a class="brand" href="/" aria-label="Kondis home"><span class="brand-mark">`);
    Heart_pulse($$renderer2, { size: 22, strokeWidth: 2.5 });
    $$renderer2.push(`<!----></span> <span>kondis</span></a> <button class="import-button">`);
    Upload($$renderer2, { size: 18 });
    $$renderer2.push(`<!----> Import activity</button> <nav aria-label="Primary navigation"><!--[-->`);
    const each_array = ensure_array_like(items);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<a${attr("href", item.href)}${attr("aria-disabled", item.disabled)}${attr_class("", void 0, {
        "active": page.url.pathname === item.href,
        "disabled": item.disabled
      })}>`);
      if (item.icon) {
        $$renderer2.push("<!--[-->");
        item.icon($$renderer2, { size: 19 });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` ${escape_html(item.label)}</a>`);
    }
    $$renderer2.push(`<!--]--></nav> <div class="sidebar-bottom"><a href="/settings" aria-disabled="true" class="disabled">`);
    Settings($$renderer2, { size: 19 });
    $$renderer2.push(`<!----> Settings</a> <div class="profile">`);
    Circle_user_round($$renderer2, { size: 32 });
    $$renderer2.push(`<!----> <span><strong>Local athlete</strong><small>Self-hosted</small></span></div></div></aside> <nav class="mobile-nav" aria-label="Mobile navigation"><a href="/"${attr_class("", void 0, { "active": page.url.pathname === "/" })}>`);
    Activity($$renderer2, { size: 21 });
    $$renderer2.push(`<!----><span>Activities</span></a> <button><span class="mobile-upload">`);
    Upload($$renderer2, { size: 21 });
    $$renderer2.push(`<!----></span><span>Import</span></button> <a class="disabled" href="/insights">`);
    Chart_no_axes_column_increasing($$renderer2, { size: 21 });
    $$renderer2.push(`<!----><span>Insights</span></a></nav>`);
  });
}
function UploadDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false } = $$props;
    let dragging = false;
    let uploads = [];
    if (open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="dialog-backdrop" role="presentation"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title"><header><div><span class="eyebrow">New import</span><h2 id="upload-title">Add activities</h2></div> <button class="icon-button" aria-label="Close">`);
      X($$renderer2, { size: 20 });
      $$renderer2.push(`<!----></button></header> <button${attr_class("drop-zone", void 0, { "dragging": dragging })}><span class="upload-icon">`);
      File_up($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></span> <strong>Drop your FIT files here</strong> <span>or click to browse your device</span> <small>.fit files only</small></button> <input class="sr-only" type="file" accept=".fit,application/octet-stream" multiple=""/> `);
      if (uploads.length) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="upload-list"><!--[-->`);
        const each_array = ensure_array_like(uploads);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          $$renderer2.push(`<div class="upload-row"><span class="file-name">${escape_html(item.file.name)}<small>${escape_html((item.file.size / 1024).toFixed(0))} KB</small></span> `);
          if (item.state === "uploading") {
            $$renderer2.push("<!--[0-->");
            Loader_circle($$renderer2, { class: "spin", size: 19 });
          } else if (item.state === "processing") {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<span class="processing">`);
            Loader_circle($$renderer2, { class: "spin", size: 16 });
            $$renderer2.push(`<!----> Processing</span>`);
          } else if (item.state === "done") {
            $$renderer2.push("<!--[2-->");
            Check($$renderer2, { class: "success", size: 19 });
          } else if (item.state === "error") {
            $$renderer2.push("<!--[3-->");
            $$renderer2.push(`<span class="error"${attr("title", item.message)}>Failed</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { open });
  });
}
function _layout($$renderer, $$props) {
  let { children } = $$props;
  let uploadOpen = false;
  let $$settled = true;
  let $$inner_renderer;
  function $$render_inner($$renderer2) {
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Kondis</title>`);
      });
      $$renderer3.push(`<meta name="description" content="Your self-hosted activity archive"/>`);
    });
    Sidebar($$renderer2);
    $$renderer2.push(`<!----> <main class="app-main">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main> `);
    UploadDialog($$renderer2, {
      get open() {
        return uploadOpen;
      },
      set open($$value) {
        uploadOpen = $$value;
        $$settled = false;
      }
    });
    $$renderer2.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_renderer = $$renderer.copy();
    $$render_inner($$inner_renderer);
  } while (!$$settled);
  $$renderer.subsume($$inner_renderer);
}
export {
  _layout as default
};
