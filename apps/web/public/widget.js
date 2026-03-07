/**
 * OrderFlow Embeddable Widget
 *
 * Usage:
 *   <script src="https://orderflow.co.uk/widget.js" data-restaurant="your-slug"></script>
 *
 * Options (via data attributes):
 *   data-restaurant="slug"        — (required) Restaurant slug
 *   data-button-text="Order Now"  — Button text (default: "Order Online")
 *   data-position="bottom-right"  — Button position: bottom-right|bottom-left (default: bottom-right)
 *   data-colour="#1B4F72"         — Brand colour (default: restaurant's brand colour)
 *   data-auto-open="false"        — Auto-open widget on load (default: false)
 */
(function () {
  "use strict";

  // Find our script tag
  var scripts = document.querySelectorAll('script[data-restaurant]');
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var slug = script.getAttribute("data-restaurant");
  if (!slug) return;

  var buttonText = script.getAttribute("data-button-text") || "Order Online";
  var position = script.getAttribute("data-position") || "bottom-right";
  var customColour = script.getAttribute("data-colour");
  var autoOpen = script.getAttribute("data-auto-open") === "true";
  var baseUrl = script.src.replace(/\/widget\.js.*$/, "") || "https://orderflow.co.uk";

  var colour = customColour || "#1B4F72";
  var isOpen = false;
  var container, button, overlay, iframe;

  // Track analytics
  function track(event) {
    try {
      if (window.posthog) window.posthog.capture(event, { restaurant: slug, source: "widget" });
    } catch (e) {}
  }

  // Create floating button
  function createButton() {
    button = document.createElement("div");
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-label", buttonText);
    button.style.cssText =
      "position:fixed;z-index:999998;" +
      (position === "bottom-left" ? "left:20px;" : "right:20px;") +
      "bottom:20px;background:" + colour + ";color:white;" +
      "padding:14px 24px;border-radius:50px;font-family:system-ui,sans-serif;" +
      "font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.15);" +
      "display:flex;align-items:center;gap:8px;transition:transform 0.2s,box-shadow 0.2s;";

    button.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>' +
      '<line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
      "<span>" + buttonText + "</span>";

    button.addEventListener("mouseenter", function () {
      button.style.transform = "scale(1.05)";
      button.style.boxShadow = "0 6px 24px rgba(0,0,0,0.2)";
    });
    button.addEventListener("mouseleave", function () {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 20px rgba(0,0,0,0.15)";
    });
    button.addEventListener("click", toggleWidget);
    button.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWidget(); }
    });

    document.body.appendChild(button);
    track("widget_loaded");
  }

  // Create widget overlay + iframe
  function createWidget() {
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);" +
      "display:none;justify-content:center;align-items:center;" +
      "opacity:0;transition:opacity 0.25s;";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeWidget();
    });

    container = document.createElement("div");
    container.style.cssText =
      "width:100%;max-width:480px;height:90vh;max-height:700px;background:white;" +
      "border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);" +
      "display:flex;flex-direction:column;position:relative;" +
      "transform:translateY(20px);transition:transform 0.25s;";

    // Header
    var header = document.createElement("div");
    header.style.cssText =
      "padding:12px 16px;background:" + colour + ";color:white;" +
      "display:flex;align-items:center;justify-content:space-between;flex-shrink:0;";
    header.innerHTML =
      '<span style="font-weight:600;font-size:14px;font-family:system-ui,sans-serif">Order Online</span>' +
      '<button style="background:rgba(255,255,255,0.2);border:none;color:white;width:28px;height:28px;' +
      'border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center" ' +
      'aria-label="Close">&times;</button>';
    header.querySelector("button").addEventListener("click", closeWidget);

    // Iframe
    iframe = document.createElement("iframe");
    iframe.style.cssText = "flex:1;border:none;width:100%;";
    iframe.setAttribute("title", "OrderFlow — Order Online");
    iframe.setAttribute("loading", "lazy");

    // Footer
    var footer = document.createElement("div");
    footer.style.cssText =
      "padding:8px;text-align:center;font-size:10px;color:#999;font-family:system-ui,sans-serif;" +
      "border-top:1px solid #eee;flex-shrink:0;";
    footer.innerHTML = 'Powered by <a href="' + baseUrl + '" target="_blank" rel="noopener" ' +
      'style="color:#999;text-decoration:underline">OrderFlow</a>';

    container.appendChild(header);
    container.appendChild(iframe);
    container.appendChild(footer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Mobile fullscreen
    var mq = window.matchMedia("(max-width: 640px)");
    function handleMobile(e) {
      if (e.matches) {
        container.style.maxWidth = "100%";
        container.style.height = "100vh";
        container.style.maxHeight = "100vh";
        container.style.borderRadius = "0";
      } else {
        container.style.maxWidth = "480px";
        container.style.height = "90vh";
        container.style.maxHeight = "700px";
        container.style.borderRadius = "16px";
      }
    }
    mq.addEventListener("change", handleMobile);
    handleMobile(mq);
  }

  function openWidget() {
    if (!iframe.src) {
      iframe.src = baseUrl + "/" + slug + "?embed=true";
    }
    overlay.style.display = "flex";
    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
      container.style.transform = "translateY(0)";
    });
    button.style.display = "none";
    isOpen = true;
    track("widget_opened");
    document.addEventListener("keydown", escHandler);
  }

  function closeWidget() {
    overlay.style.opacity = "0";
    container.style.transform = "translateY(20px)";
    setTimeout(function () { overlay.style.display = "none"; }, 250);
    button.style.display = "flex";
    isOpen = false;
    document.removeEventListener("keydown", escHandler);
  }

  function toggleWidget() {
    isOpen ? closeWidget() : openWidget();
  }

  function escHandler(e) {
    if (e.key === "Escape") closeWidget();
  }

  // Initialise
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    createButton();
    createWidget();
    if (autoOpen) setTimeout(openWidget, 500);
  }
})();
