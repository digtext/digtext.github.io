/**
 * Dig.txt Embed Script
 * Drop-in script that makes <<expandable>> text interactive.
 *
 * Usage:
 *   <div data-digtext>This has <<hidden details>> in it.</div>
 *   <script src="https://pawsys.github.io/digtext/embed.js"></script>
 *
 * Customization (CSS variables on the [data-digtext] element or :root):
 *   --digtext-highlight    – expanded text background (auto-detected from bg)
 *   --digtext-btn-color    – button border/icon color (defaults to currentColor)
 */
(function () {
  "use strict";

  if (window.__digtext_loaded) return;
  window.__digtext_loaded = true;

  var SITE_URL = "https://pawsys.github.io/digtext/";

  // ── SVG icons (matching Lucide Plus / X, strokeWidth 2.5) ──────────

  var ICON_PLUS =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  var ICON_X =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ── Styles (injected once) ──────────────────────────────────────────

  var style = document.createElement("style");
  style.textContent = [
    /* Button — inherits text color, works on any background */
    ".digtext-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  width: 1.25em;",
    "  height: 1.25em;",
    "  border-radius: 50%;",
    "  border: 1.5px solid var(--digtext-btn-color, currentColor);",
    "  background: transparent;",
    "  color: var(--digtext-btn-color, currentColor);",
    "  opacity: 0.5;",
    "  font: inherit;",
    "  font-size: 0.8em;",
    "  line-height: 1;",
    "  cursor: pointer;",
    "  padding: 0;",
    "  margin: 0 0.12em;",
    "  vertical-align: middle;",
    "  position: relative;",
    "  top: -0.08em;",
    "  transition: opacity 0.15s, background-color 0.15s, border-color 0.15s;",
    "}",
    ".digtext-btn:hover { opacity: 0.8; }",
    ".digtext-btn svg { display: block; }",

    /* Expanded state — filled circle, icon becomes the background color */
    ".digtext-btn--open {",
    "  opacity: 0.7;",
    "  background-color: var(--digtext-btn-color, currentColor);",
    "  border-color: var(--digtext-btn-color, currentColor);",
    "}",
    ".digtext-btn--open:hover { opacity: 0.9; }",
    ".digtext-btn--open svg {",
    "  color: var(--_digtext-bg, #fff);",
    "}",

    /* Expanded text highlight — adapts to light/dark via currentColor alpha */
    ".digtext-expanded {",
    "  background: var(--digtext-highlight, color-mix(in srgb, currentColor 8%, transparent));",
    "  border-radius: 3px;",
    "  padding: 0.05em 0.2em;",
    "  -webkit-box-decoration-break: clone;",
    "  box-decoration-break: clone;",
    "}",

    /* Powered-by label — 70% of body text size */
    ".digtext-powered {",
    "  margin-top: 0.5em;",
    "  font-size: 0.7em;",
    "  opacity: 0.4;",
    "  font-family: system-ui, -apple-system, sans-serif;",
    "}",
    ".digtext-powered a {",
    "  color: inherit;",
    "  text-decoration: underline;",
    "  text-underline-offset: 0.15em;",
    "}",
    ".digtext-powered a:hover { opacity: 0.7; }",
  ].join("\n");
  document.head.appendChild(style);

  // ── Detect background color for X icon contrast ─────────────────────

  function detectBg(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return bg;
      node = node.parentElement;
    }
    return "#fff";
  }

  // ── Parser ──────────────────────────────────────────────────────────

  function parse(raw) {
    var segments = [];
    var i = 0;
    var text = "";

    while (i < raw.length) {
      if (raw[i] === "<" && raw[i + 1] === "<") {
        var nest = 1;
        var j = i + 2;
        var matched = false;
        while (j < raw.length) {
          if (raw[j] === "<" && raw[j + 1] === "<") {
            nest++;
            j += 2;
          } else if (raw[j] === ">" && raw[j + 1] === ">") {
            nest--;
            if (nest === 0) {
              matched = true;
              break;
            }
            j += 2;
          } else {
            j++;
          }
        }
        if (!matched) {
          text += "<<";
          i += 2;
          continue;
        }
        if (text) {
          segments.push({ type: "text", value: text });
          text = "";
        }
        var inner = raw.slice(i + 2, j);
        segments.push({ type: "expandable", children: parse(inner) });
        i = j + 2;
      } else if (raw[i] === ">" && raw[i + 1] === ">") {
        i += 2;
      } else {
        text += raw[i];
        i++;
      }
    }
    if (text) segments.push({ type: "text", value: text });
    return segments;
  }

  // ── Renderer ────────────────────────────────────────────────────────

  function renderSegments(segments, container) {
    segments.forEach(function (seg) {
      if (seg.type === "text") {
        container.appendChild(document.createTextNode(seg.value));
      } else {
        var wrapper = document.createElement("span");

        var btn = document.createElement("button");
        btn.className = "digtext-btn";
        btn.innerHTML = ICON_PLUS;
        btn.setAttribute("aria-label", "Expand");
        btn.type = "button";

        var content = document.createElement("span");
        content.className = "digtext-expanded";
        content.style.display = "none";
        renderSegments(seg.children, content);

        btn.addEventListener("click", function () {
          var open = content.style.display !== "none";
          content.style.display = open ? "none" : "";
          btn.className = open ? "digtext-btn" : "digtext-btn digtext-btn--open";
          btn.innerHTML = open ? ICON_PLUS : ICON_X;
          btn.setAttribute("aria-label", open ? "Expand" : "Collapse");
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(content);
        container.appendChild(wrapper);
      }
    });
  }

  function processElement(el) {
    var raw = el.textContent || "";
    if (raw.indexOf("<<") === -1) return;

    // Set the detected background as a CSS var so the X icon can contrast
    var bg = detectBg(el);
    el.style.setProperty("--_digtext-bg", bg);

    var segments = parse(raw);
    el.textContent = "";
    renderSegments(segments, el);

    // "powered by Dig text" label
    var powered = document.createElement("div");
    powered.className = "digtext-powered";
    powered.innerHTML =
      'powered by <a href="' +
      SITE_URL +
      '" target="_blank" rel="noopener">Dig text</a>';
    el.appendChild(powered);
  }

  // ── Auto-scan ───────────────────────────────────────────────────────

  function scan() {
    document.querySelectorAll("[data-digtext]").forEach(function (el) {
      if (el.__digtext_processed) return;
      el.__digtext_processed = true;
      processElement(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
