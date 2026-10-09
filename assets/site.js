(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("has-js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const onChange = (query, fn) => {
    if (query.addEventListener) query.addEventListener("change", fn);
    else if (query.addListener) query.addListener(fn);  // Safari before 14
  };

  /* Sticky header height, used for in-page scroll offsets (the CSS has a fallback). */
  const masthead = document.querySelector(".masthead");
  const setHeaderHeight = () => {
    if (!masthead) return;
    const sticky = getComputedStyle(masthead).position === "sticky";
    root.style.setProperty("--header-h", sticky ? `${masthead.offsetHeight}px` : "0px");
  };
  setHeaderHeight();
  window.addEventListener("resize", setHeaderHeight, { passive: true });

  /* Logo: plotted once on load (CSS). Hover or focus then sends a signal through it.
     On the home page the logo scrolls back to the top instead of reloading, so a tap shows the pulse. */
  document.querySelectorAll("[data-logo]").forEach((link) => {
    const logo = link.querySelector(".logo");
    if (!logo) return;
    const ready = () => logo.classList.add("is-ready");
    const pulse = () => {
      if (reduceMotion.matches || !logo.classList.contains("is-ready") || logo.classList.contains("is-pulsing")) return;
      logo.classList.add("is-pulsing");
    };
    logo.addEventListener("animationend", (event) => {
      if (event.animationName === "logo-node") ready();
      if (event.animationName === "logo-ping") logo.classList.remove("is-pulsing");
    });
    // If animations never run (reduced motion, or disabled), the mark is already static and complete.
    setTimeout(ready, reduceMotion.matches ? 0 : 2600);
    link.addEventListener("pointerenter", pulse);
    link.addEventListener("focus", pulse);

    const home = new URL(link.href, location.href);
    const onHome = home.origin === location.origin && ["/", "/index.html"].includes(location.pathname) && home.pathname === "/";
    if (onHome) {
      link.addEventListener("click", (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
        pulse();
      });
    }
  });

  /* Ruler: a drafting marker follows the pointer along the masthead rule. */
  const ruler = document.querySelector(".ruler");
  const mark = document.querySelector("[data-ruler-mark]");
  if (ruler && mark) {
    let frame = 0;
    document.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = ruler.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 0, rect.width);
        mark.style.setProperty("--x", `${x}px`);
        mark.dataset.x = `X ${String(Math.round(x)).padStart(4, "0")}`;
        mark.classList.toggle("is-flip", x > rect.width - 64);
        ruler.classList.add("is-tracking");
      });
    }, { passive: true });
    root.addEventListener("pointerleave", () => ruler.classList.remove("is-tracking"));
  }

  /* Figures drawn small: when callout text would render under 8 px, crop the view to the drawing and
     number the parts instead (CSS shows badges for [data-compact]). --u is viewBox units per CSS px. */
  const fittable = [...document.querySelectorAll("svg[data-compact-viewbox]")];
  const width = (box) => Number(box.split(/[\s,]+/)[2]);
  const fit = (svg) => {
    if (!svg.dataset.fullViewbox) svg.dataset.fullViewbox = svg.getAttribute("viewBox");
    const space = svg.parentElement.clientWidth;
    if (!space) return;
    const compact = space * 11 / width(svg.dataset.fullViewbox) < 8;
    const box = compact ? svg.dataset.compactViewbox : svg.dataset.fullViewbox;
    if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
    svg.closest(".fig")?.toggleAttribute("data-compact", compact);
    svg.style.setProperty("--u", (width(box) / space).toFixed(4));
  };
  const fitFigures = () => fittable.forEach(fit);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver((entries) => entries.forEach((entry) => fit(entry.target.querySelector("svg"))));
    fittable.forEach((svg) => observer.observe(svg.parentElement));
  } else {
    window.addEventListener("resize", fitFigures, { passive: true });
  }
  fitFigures();

  /* Figures: exploded drawings that assemble, with a legend linked to their layers. */
  const figures = [...document.querySelectorAll("[data-fig]")].map((figure) => {
    const svg = figure.querySelector("svg");
    if (!svg) return null;
    // Badge sets sit above every layer but move with their own.
    const layers = [...svg.querySelectorAll(".f-layer[data-lift], .f-badge-set[data-lift]")].map((el) => ({ el, lift: Number(el.dataset.lift) }));
    const guides = [...svg.querySelectorAll(".f-guide[data-lift]")].map((el) => ({
      el,
      y1: Number(el.getAttribute("y1")),
      y2: Number(el.getAttribute("y2")),
      fromLift: Number(el.dataset.fromLift || 0),
      toLift: Number(el.dataset.lift),
    }));
    const state = { figure, svg, explode: 1, target: 1, mode: figure.dataset.fig };

    // value 1 is the drawing as authored (exploded); 0 is fully assembled.
    state.render = (value) => {
      state.explode = value;
      const closed = 1 - value;
      svg.style.setProperty("--explode", value.toFixed(3));
      layers.forEach(({ el, lift }) => {
        el.style.transform = lift ? `translateY(${(closed * lift).toFixed(2)}px)` : "";
      });
      guides.forEach(({ el, y1, y2, fromLift, toLift }) => {
        el.setAttribute("y1", (y1 + closed * fromLift).toFixed(2));
        el.setAttribute("y2", (y2 + closed * toLift).toFixed(2));
        el.style.opacity = value < 0.04 ? "0" : "";
      });
    };

    /* Legend: upgrade the plain list entries into buttons that highlight a layer or a part. */
    const buttons = [...figure.querySelectorAll("[data-parts] .part[data-part]")].map((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part";
      button.dataset.part = label.dataset.part;
      button.setAttribute("aria-pressed", "false");
      button.append(...label.childNodes);
      label.replaceWith(button);
      return button;
    });

    let pinned = null;
    let pointer = "mouse";
    figure.addEventListener("pointerdown", (event) => { pointer = event.pointerType; });
    figure.addEventListener("keydown", () => { pointer = "keyboard"; });

    const highlight = (part) => {
      if (part) figure.dataset.active = part; else delete figure.dataset.active;
      const layerId = part ? part.replace(/[a-z]$/, "") : null;
      svg.querySelectorAll(".f-layer").forEach((el) => el.classList.toggle("is-active", el.dataset.layer === layerId));
      // A whole layer ("2") lights all of its parts ("2a", "2b"); a part lights only itself.
      svg.querySelectorAll("[data-part]").forEach((el) => {
        const own = el.dataset.part;
        el.classList.toggle("is-active", Boolean(part) && (own === part || own.replace(/[a-z]$/, "") === part));
      });
    };
    const restore = () => highlight(pinned);
    buttons.forEach((button) => {
      const part = button.dataset.part;
      button.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") highlight(part); });
      button.addEventListener("pointerleave", restore);
      button.addEventListener("focus", () => highlight(part));
      button.addEventListener("blur", restore);
      button.addEventListener("click", () => {
        pinned = pinned === part ? null : part;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === pinned)));
        // A touch has no hover to fall back to, so un-pinning clears the drawing at once.
        highlight(pinned || (pointer === "touch" || pointer === "pen" ? null : part));
      });
    });

    /* Pointing at the drawing highlights the matching legend entry; a click pins it. */
    const partAt = (layer, target) => target.closest?.("[data-part]")?.dataset.part || layer.dataset.layer;
    svg.querySelectorAll(".f-layer").forEach((el) => {
      el.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;
        const part = partAt(el, event.target);
        highlight(part);
        buttons.forEach((b) => b.classList.toggle("is-hot", b.dataset.part === part));
      });
      el.addEventListener("pointerleave", () => {
        restore();
        buttons.forEach((b) => b.classList.remove("is-hot"));
      });
      el.addEventListener("click", (event) => {
        const part = partAt(el, event.target);
        const button = buttons.find((b) => b.dataset.part === part)
          || buttons.find((b) => b.dataset.part.replace(/[a-z]$/, "") === el.dataset.layer);
        button?.click();
      });
    });
    return state;
  }).filter(Boolean);

  const animateTo = (state, target, duration = 1400) => {
    cancelAnimationFrame(state.raf);
    clearTimeout(state.settle);
    if (reduceMotion.matches) { state.render(target); return; }  // the choice still applies, without motion
    const from = state.explode;
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / duration);
      state.render(from + (target - from) * easeInOut(t));
      if (t < 1) state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
    // Frames pause in background tabs; make sure the drawing still ends in its target state.
    state.settle = setTimeout(() => { cancelAnimationFrame(state.raf); state.render(target); }, duration + 250);
  };

  /* Cover figure: assembled on arrival, it opens out once; a toggle closes and reopens it. */
  figures.filter((s) => s.mode === "assemble").forEach((state) => {
    const toggle = state.figure.querySelector("[data-fig-toggle]");
    state.sync = () => { if (toggle) toggle.textContent = state.target === 0 ? "Explode" : "Assemble"; };
    if (!reduceMotion.matches) {
      state.render(0);
      state.settle = setTimeout(() => animateTo(state, 1, 1600), 450);
    }
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener("click", () => {
        state.target = state.target === 0 ? 1 : 0;
        animateTo(state, state.target, 900);
        state.sync();
      });
      state.sync();
    }
  });

  /* Product figures: scroll position drives the explode amount, closed below the fold and open by mid-screen. */
  const scrolled = figures.filter((s) => s.mode === "scroll");
  let frame = 0;
  const update = () => {
    frame = 0;
    const vh = window.innerHeight;
    // Read every position first, then write, and only where something changed.
    const values = scrolled.map((state) => reduceMotion.matches ? 1
      : easeInOut(clamp((vh * 0.95 - state.svg.getBoundingClientRect().top) / (vh * 0.55))));
    scrolled.forEach((state, i) => { if (values[i] !== state.explode) state.render(values[i]); });
  };
  if (scrolled.length) {
    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    update();
  }

  onChange(reduceMotion, () => {
    figures.forEach((state) => {
      cancelAnimationFrame(state.raf);
      clearTimeout(state.settle);
      if (state.mode === "assemble") state.render(state.target);
    });
    update();
    if (reduceMotion.matches) ruler?.classList.remove("is-tracking");
  });

  /* Print the drawings open and fully labelled, then restore the live state. */
  window.addEventListener("beforeprint", () => {
    fittable.forEach((svg) => {
      svg.setAttribute("viewBox", svg.dataset.fullViewbox || svg.getAttribute("viewBox"));
      svg.closest(".fig")?.removeAttribute("data-compact");
    });
    figures.forEach((state) => {
      cancelAnimationFrame(state.raf);
      clearTimeout(state.settle);
      state.render(1);
    });
  });
  window.addEventListener("afterprint", () => {
    fitFigures();
    figures.filter((s) => s.mode === "assemble").forEach((s) => s.render(s.target));
    update();
  });

  /* Section indicator in the main navigation: the last section whose top has passed 45% of the
     viewport, or the last section once the page cannot scroll any further. */
  const navLinks = [...document.querySelectorAll("[data-nav]")];
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (sections.length) {
    let navFrame = 0;
    const markCurrent = () => {
      navFrame = 0;
      const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight - 2;
      let current = null;
      if (atBottom) current = sections[sections.length - 1];
      else sections.forEach((section) => { if (section.getBoundingClientRect().top <= window.innerHeight * 0.45) current = section; });
      navLinks.forEach((link) => {
        if (current && link.getAttribute("href") === `#${current.id}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    };
    const request = () => { if (!navFrame) navFrame = requestAnimationFrame(markCurrent); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    markCurrent();
  }

  /* Email: the address is put together here instead of being written in the HTML, which keeps it
     away from simple scrapers. Without JavaScript the page shows "contact [at] mflow.com.au". */
  const [user, domain] = ["contact", "mflow.com.au"];
  const email = `${user}@${domain}`;
  document.querySelectorAll("[data-email]").forEach((link) => {
    const subject = link.dataset.subject;
    link.href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  });
  document.querySelectorAll("[data-email-text]").forEach((el) => {
    el.replaceChildren(`${user}@`, document.createElement("wbr"), domain);  // breaks cleanly after the @
  });

  /* Copy email: writes the address to the clipboard after an explicit click. */
  document.querySelectorAll("[data-copy-email]").forEach((button) => {
    if (!navigator.clipboard?.writeText) return;
    const status = button.parentElement.querySelector(".copy-status");
    let timer = 0;
    const say = (message) => {  // clear first, so a repeated message is announced again
      if (!status) return;
      clearTimeout(timer);
      status.textContent = "";
      timer = setTimeout(() => {
        status.textContent = message;
        timer = setTimeout(() => { status.textContent = ""; }, 5000);
      }, 100);
    };
    button.hidden = false;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(email);
        say("Address copied.");
      } catch {
        say("Copy unavailable. Select the address above instead.");
      }
    });
  });
})();
