import { Hono, type Context } from "hono";
import {
  getAccessToken,
  addMaterial,
  uploadImageBuffer,
  addDraft,
  freePublish,
  massSend,
} from "./wechat-client.js";
import { markdownToWechatHtml } from "./markdown-converter.js";
import { generateImage, generateImageBuffer } from "./image-client.js";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// ---------- Config from env ----------

function getConfig(c: Context) {
  const appId =
    c.req.query("app_id") || process.env.WEIXIN_APP_ID;
  const appSecret =
    c.req.query("app_secret") ||
    process.env.WEIXIN_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("app_id and app_secret are required (query param or env)");
  }
  return { appId, appSecret };
}

async function resolveToken(c: Context) {
  const token = c.req.query("access_token");
  if (token) return token;
  const { appId, appSecret } = getConfig(c);
  return getAccessToken(appId, appSecret);
}

// ---------- GET/POST /mpapi/getaccesstoken ----------

app.on(["GET", "POST"], "/mpapi/getaccesstoken", async (c) => {
  const { appId, appSecret } = getConfig(c);
  const token = await getAccessToken(appId, appSecret);
  return c.json({ access_token: token });
});

// ---------- POST /mpapi/addmaterial ----------

app.post("/mpapi/addmaterial", async (c) => {
  const accessToken = await resolveToken(c);
  const body = await c.req.parseBody();
  const file = body["media"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "media file is required" }, 400);
  }

  const type = (body["type"] as string) || "thumb";
  const tmpDir = join(process.cwd(), ".tmp");
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `upload_${Date.now()}_${file.name}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPath, buffer);

  try {
    const result = await addMaterial(accessToken, tmpPath, type as "thumb");
    return c.json(result);
  } finally {
    if (existsSync(tmpPath)) await unlink(tmpPath);
  }
});

// ---------- POST /mpapi/uploadimage ----------

app.post("/mpapi/uploadimage", async (c) => {
  const accessToken = await resolveToken(c);
  const body = await c.req.parseBody();
  const file = body["media"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "media file is required" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadImageBuffer(accessToken, buffer, file.name);
  return c.json({ url });
});

// ---------- POST /mpapi/draftadd ----------

app.post("/mpapi/draftadd", async (c) => {
  const accessToken = await resolveToken(c);
  const contentType = c.req.header("content-type") || "";

  let title: string;
  let html: string;
  let thumbMediaId: string;
  let contentSourceUrl = "";
  let author = "";

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    title = body["title"] as string;
    html = body["html"] as string;
    thumbMediaId = body["thumb_media_id"] as string;
    contentSourceUrl = (body["content_source_url"] as string) || "";
    author = (body["author"] as string) || "";
  } else {
    // application/x-www-form-urlencoded or JSON
    const body = contentType.includes("application/json")
      ? await c.req.json()
      : Object.fromEntries(new URLSearchParams(await c.req.text()));
    title = body.title;
    html = body.html;
    thumbMediaId = body.thumb_media_id;
    contentSourceUrl = body.content_source_url || "";
    author = body.author || "";
  }

  if (!html || !thumbMediaId) {
    return c.json({ error: "html and thumb_media_id are required" }, 400);
  }

  const mediaId = await addDraft(accessToken, {
    title: title || "Untitled",
    content: html,
    thumb_media_id: thumbMediaId,
    content_source_url: contentSourceUrl,
    author,
  });

  return c.json({ media_id: mediaId });
});

// ---------- POST /mpapi/publish ----------

app.post("/mpapi/publish", async (c) => {
  const accessToken = await resolveToken(c);
  const body = await c.req.json();
  const { media_id, method = "free" } = body;

  if (!media_id) {
    return c.json({ error: "media_id is required" }, 400);
  }

  if (method === "mass") {
    const msgId = await massSend(accessToken, media_id);
    return c.json({ msg_id: msgId, method: "mass" });
  } else {
    const publishId = await freePublish(accessToken, media_id);
    return c.json({ publish_id: publishId, method: "free" });
  }
});

// ---------- POST /mpapi/convert ----------

app.post("/mpapi/convert", async (c) => {
  const contentType = c.req.header("content-type") || "";
  let markdown: string;

  if (contentType.includes("application/json")) {
    const body = await c.req.json();
    markdown = body.markdown;
  } else {
    markdown = await c.req.text();
  }

  if (!markdown) {
    return c.json({ error: "markdown content is required" }, 400);
  }

  const html = markdownToWechatHtml(markdown);
  return c.json({ html });
});

// ---------- POST /mpapi/generate-cover ----------

app.post("/mpapi/generate-cover", async (c) => {
  const body = await c.req.json();
  const { prompt, size, quality, model } = body;

  if (!prompt) {
    return c.json({ error: "prompt is required" }, 400);
  }

  const images = await generateImage(prompt, { size, quality, model });
  return c.json({ images });
});

// ---------- POST /mpapi/full-publish (all-in-one) ----------

app.post("/mpapi/full-publish", async (c) => {
  const accessToken = await resolveToken(c);
  const body = await c.req.parseBody();

  const title = body["title"] as string;
  const markdownRaw = body["markdown"];
  const coverFile = body["cover"] as File | undefined;
  const coverPrompt = (body["cover_prompt"] as string) || "";
  const author = (body["author"] as string) || "";
  const contentSourceUrl = (body["content_source_url"] as string) || "";
  const publishMethod = (body["publish_method"] as string) || "free";

  // parseBody may return File for markdown if sent as @file
  const markdown =
    typeof markdownRaw === "string"
      ? markdownRaw
      : await (markdownRaw as File).text();

  if (!title || !markdown) {
    return c.json({ error: "title and markdown are required" }, 400);
  }

  if (!coverFile && !coverPrompt) {
    return c.json(
      { error: "cover image file or cover_prompt is required" },
      400
    );
  }

  // Step 1: Get cover image buffer
  const tmpDir = join(process.cwd(), ".tmp");
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

  let coverBuffer: Buffer;
  if (coverFile) {
    coverBuffer = Buffer.from(await coverFile.arrayBuffer());
  } else {
    // Generate cover via text-to-image
    coverBuffer = await generateImageBuffer(coverPrompt);
  }

  const coverPath = join(tmpDir, `cover_${Date.now()}.jpg`);
  await writeFile(coverPath, coverBuffer);

  let materialResult;
  try {
    materialResult = await addMaterial(accessToken, coverPath, "thumb");
  } finally {
    if (existsSync(coverPath)) await unlink(coverPath);
  }

  // Step 2: Convert markdown to HTML
  let html = markdownToWechatHtml(markdown);

  // Step 3: Upload inline images in HTML and replace URLs
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const imgSources: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (!match[1].includes("mmbiz.qpic.cn")) {
      imgSources.push(match[1]);
    }
  }

  for (const src of imgSources) {
    try {
      // Download image
      const imgRes = await fetch(src);
      if (!imgRes.ok) continue;
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const wxUrl = await uploadImageBuffer(
        accessToken,
        imgBuffer,
        `inline_${Date.now()}.jpg`
      );
      html = html.replaceAll(src, wxUrl);
    } catch {
      // Skip images that fail to download/upload
    }
  }

  // Step 4: Create draft
  const draftMediaId = await addDraft(accessToken, {
    title,
    content: html,
    thumb_media_id: materialResult.media_id,
    author,
    content_source_url: contentSourceUrl,
  });

  // Step 5: Publish or just return draft
  if (publishMethod === "draft") {
    return c.json({ draft_media_id: draftMediaId, method: "draft" });
  } else if (publishMethod === "mass") {
    const msgId = await massSend(accessToken, draftMediaId);
    return c.json({
      draft_media_id: draftMediaId,
      msg_id: msgId,
      method: "mass",
    });
  } else {
    const publishId = await freePublish(accessToken, draftMediaId);
    return c.json({
      draft_media_id: draftMediaId,
      publish_id: publishId,
      method: "free",
    });
  }
});

export default app;
