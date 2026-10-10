// creators.js — THE KITCHEN.
// The website sends an order: "tell me about @MrBeast, @DudePerfect, ..."
// The kitchen asks YouTube (using our SECRET KEY, which never leaves this kitchen),
// then sends back each YouTuber's total views, their picture, and whether they're live.
//
// The secret key lives in Azure, in a setting called YOUTUBE_API_KEY.
// YouTube only lets us ask a certain number of questions per day, so the kitchen
// remembers answers for 5 minutes (that's the "cache") instead of asking every time.

const { app } = require("@azure/functions");

const YT = "https://www.googleapis.com/youtube/v3";
const CACHE_MINUTES = 5;
const MAX_HANDLES = 30;
const HANDLE_OK = /^@[A-Za-z0-9._-]{2,40}$/;

const channelIdByHandle = new Map(); // "@MrBeast" -> "UCX6OQ3DkcsbYNE6H8uQQuVA" (never changes, so keep forever)
let cache = { key: "", at: 0, body: null };

async function youtube(path, params) {
  const url = new URL(YT + path);
  Object.entries({ ...params, key: process.env.YOUTUBE_API_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error("YouTube said " + res.status + " for " + path);
  return res.json();
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Turn "@MrBeast" into YouTube's channel ID (only needed the first time).
async function findChannelIds(handles) {
  const missing = handles.filter((h) => !channelIdByHandle.has(h));
  await Promise.all(
    missing.map(async (h) => {
      try {
        const data = await youtube("/channels", { part: "id", forHandle: h });
        if (data.items && data.items[0]) channelIdByHandle.set(h, data.items[0].id);
      } catch (e) { /* skip this one, try again next time */ }
    })
  );
}

// Each channel has a free "RSS feed" listing its newest videos. A live stream shows up there.
async function newestVideoIds(channelId) {
  try {
    const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].slice(0, 5).map((m) => m[1]);
  } catch (e) {
    return [];
  }
}

async function cook(handles) {
  await findChannelIds(handles);
  const ids = handles.map((h) => channelIdByHandle.get(h)).filter(Boolean);

  // 1) Views + profile picture (up to 50 channels per question)
  const channels = {};
  for (const group of chunks(ids, 50)) {
    const data = await youtube("/channels", { part: "snippet,statistics", id: group.join(",") });
    (data.items || []).forEach((c) => (channels[c.id] = c));
  }

  // 2) Who is live? Look at each channel's newest videos and ask YouTube which ones are "live".
  const videosByChannel = {};
  await Promise.all(ids.map(async (id) => (videosByChannel[id] = await newestVideoIds(id))));
  const allVideos = Object.values(videosByChannel).flat();
  const liveVideoByChannel = {};
  for (const group of chunks(allVideos, 50)) {
    const data = await youtube("/videos", { part: "snippet", id: group.join(",") });
    (data.items || []).forEach((v) => {
      if (v.snippet.liveBroadcastContent === "live") liveVideoByChannel[v.snippet.channelId] = v.id;
    });
  }

  // 3) Put the plate together
  const creators = {};
  handles.forEach((h) => {
    const id = channelIdByHandle.get(h);
    const c = id && channels[id];
    if (!c) return;
    const thumbs = c.snippet.thumbnails || {};
    creators[h] = {
      channelId: id,
      title: c.snippet.title,
      views: Number(c.statistics.viewCount),
      subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount),
      avatar: (thumbs.medium || thumbs.default || {}).url || null,
      live: Boolean(liveVideoByChannel[id]),
      liveVideoId: liveVideoByChannel[id] || null,
    };
  });

  return { updated: new Date().toISOString(), creators };
}

app.http("creators", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (!process.env.YOUTUBE_API_KEY) {
      return { status: 503, jsonBody: { error: "The kitchen has no YouTube key yet." } };
    }

    const handles = [...new Set((request.query.get("handles") || "").split(",").map((h) => h.trim()))]
      .filter((h) => HANDLE_OK.test(h))
      .slice(0, MAX_HANDLES);
    if (handles.length === 0) return { status: 400, jsonBody: { error: "Send ?handles=@name,@name" } };

    const key = [...handles].sort().join(",");
    const fresh = Date.now() - cache.at < CACHE_MINUTES * 60 * 1000;
    if (!(fresh && cache.key === key)) {
      try {
        cache = { key, at: Date.now(), body: await cook(handles) };
      } catch (e) {
        context.error(e);
        if (!cache.body) return { status: 502, jsonBody: { error: "YouTube didn't answer. Try again soon." } };
        // otherwise serve the last good answer
      }
    }

    return {
      jsonBody: cache.body,
      headers: { "Cache-Control": "public, max-age=120" },
    };
  },
});
