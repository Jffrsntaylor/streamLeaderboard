// leaderboard.js — builds the Top 25 list.
// Step 1: read OUR list of YouTubers (data/creators.json).
// Step 2: ask the KITCHEN (our /api/creators) for each one's total views and if they're live.
// Step 3: sort them biggest-to-smallest and draw the list.
// Step 4: hand the list to the globe so it can put dots on the map.
// Then do it again every 5 minutes so "LIVE" stays fresh.
(function () {
  const board = document.getElementById("board");
  const status = document.getElementById("status");
  const REFRESH_MINUTES = 5;

  // Turns 1234567890 into "1.23B" so big numbers are easy to read.
  function shortNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
  }

  async function getStats(handles) {
    try {
      const res = await fetch("/api/creators?handles=" + encodeURIComponent(handles.join(",")));
      if (!res.ok) throw new Error("kitchen said " + res.status);
      return await res.json();
    } catch (e) {
      return null; // No kitchen yet (or no YouTube key). We'll still show the list.
    }
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function drawRow(c, i) {
    const li = el("li", "row");
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      window.TubeGlobe.focus(c.handle);
      document.getElementById("globe").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") li.click(); });

    li.appendChild(el("div", "rank", String(i + 1)));

    if (c.avatar) {
      const img = el("img", "avatar");
      img.src = c.avatar;
      img.alt = "";
      img.loading = "lazy";
      li.appendChild(img);
    } else {
      li.appendChild(el("div", "avatar", c.name[0]));
    }

    const who = el("div", "who");
    const name = el("div", "name", c.name);
    if (c.live) {
      const badge = el("a", "live", "LIVE");
      badge.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(c.liveVideoId);
      badge.target = "_blank";
      badge.rel = "noopener";
      badge.addEventListener("click", (e) => e.stopPropagation());
      name.appendChild(badge);
    } else if (c.views != null) {
      name.appendChild(el("span", "offline", "offline"));
    }
    who.appendChild(name);
    who.appendChild(el("div", "where", c.place));
    li.appendChild(who);

    const views = el("div", "views");
    views.appendChild(el("b", null, c.views != null ? shortNumber(c.views) : "—"));
    views.appendChild(el("small", null, "TOTAL VIEWS"));
    li.appendChild(views);

    return li;
  }

  async function update() {
    const data = await (await fetch("data/creators.json")).json();
    const stats = await getStats(data.creators.map((c) => c.handle));

    // Mix our list with the kitchen's numbers.
    const list = data.creators.map((c) => {
      const s = (stats && stats.creators && stats.creators[c.handle]) || {};
      const spot = data.places[c.place] || { lat: 0, lng: 0 };
      return Object.assign({}, c, spot, {
        views: s.views != null ? s.views : null,
        avatar: s.avatar || null,
        live: !!s.live,
        liveVideoId: s.liveVideoId || null,
        viewsText: s.views != null ? shortNumber(s.views) : null,
      });
    });

    // Biggest views first. (YouTubers we couldn't look up go to the bottom.)
    list.sort((a, b) => (b.views || 0) - (a.views || 0));
    list.forEach((c, i) => (c.rank = i + 1));

    board.replaceChildren(...list.map(drawRow));
    window.TubeGlobe.setCreators(list);

    const liveCount = list.filter((c) => c.live).length;
    if (!stats) {
      status.textContent = "views loading soon (kitchen offline)";
    } else {
      const time = new Date(stats.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      status.textContent = liveCount + " live now · updated " + time;
    }
  }

  update();
  setInterval(update, REFRESH_MINUTES * 60 * 1000);
})();
