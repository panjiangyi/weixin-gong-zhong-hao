import FormData from "form-data";
import { readFile } from "fs/promises";

const WEIXIN_API = "https://api.weixin.qq.com/cgi-bin";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`WeChat API error: ${data.errcode} - ${data.errmsg}`);
  }
  return data;
}

async function postForm(
  url: string,
  form: FormData
): Promise<Record<string, any>> {
  // Node native fetch doesn't handle form-data streams well,
  // so we manually assemble the body and headers.
  const length = form.getLengthSync();
  const headers = form.getHeaders();
  headers["Content-Length"] = length;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    form.on("data", (chunk: Buffer | string) =>
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    );
    form.on("end", () => resolve(Buffer.concat(chunks)));
    form.on("error", reject);
    form.resume();
  });

  const res = await fetch(url, {
    method: "POST",
    body: new Uint8Array(buffer),
    headers,
  });
  return res.json();
}

// ---------- Access Token ----------

export async function getAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const data = await fetchJson(
    `${WEIXIN_API}/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  );

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}

// ---------- Upload permanent material (cover image) ----------

export async function addMaterial(
  accessToken: string,
  filePath: string,
  type: "thumb" | "image" = "thumb"
): Promise<{ media_id: string; url: string }> {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append("media", buffer, {
    filename: "cover.jpg",
    contentType: "image/jpeg",
  });

  const data = await postForm(
    `${WEIXIN_API}/material/add_material?access_token=${accessToken}&type=${type}`,
    form
  );
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`addMaterial error: ${data.errcode} - ${data.errmsg}`);
  }
  return { media_id: data.media_id, url: data.url };
}

// ---------- Upload image for article body ----------

export async function uploadImage(
  accessToken: string,
  filePath: string
): Promise<string> {
  const buffer = await readFile(filePath);
  return uploadImageBuffer(accessToken, buffer, "image.jpg");
}

// ---------- Upload image from buffer ----------

export async function uploadImageBuffer(
  accessToken: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const form = new FormData();
  form.append("media", buffer, {
    filename,
    contentType: "image/jpeg",
  });

  const data = await postForm(
    `${WEIXIN_API}/media/uploadimg?access_token=${accessToken}`,
    form
  );
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`uploadImage error: ${data.errcode} - ${data.errmsg}`);
  }
  return data.url;
}

// ---------- Create draft ----------

export async function addDraft(
  accessToken: string,
  article: {
    title: string;
    content: string;
    thumb_media_id: string;
    author?: string;
    digest?: string;
    content_source_url?: string;
  }
): Promise<string> {
  const data = await fetchJson(
    `${WEIXIN_API}/draft/add?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles: [article] }),
    }
  );
  return data.media_id;
}

// ---------- Update draft ----------

export async function updateDraft(
  accessToken: string,
  article: {
    media_id: string;
    title?: string;
    content?: string;
    thumb_media_id?: string;
    author?: string;
    digest?: string;
    content_source_url?: string;
  }
): Promise<void> {
  await fetchJson(
    `${WEIXIN_API}/draft/update?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles: [article] }),
    }
  );
}

// ---------- Get all drafts (simple list) ----------

export async function getDraftsList(
  accessToken: string,
  offset: number = 0,
  count: number = 20
): Promise<{ total_count: number; items: { media_id: string; title: string }[] }> {
  const data = await fetchJson(
    `${WEIXIN_API}/draft/get?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset, count }),
    }
  );
  return {
    total_count: data.total_count,
    items: (data.item || []).map((i: any) => ({
      media_id: i.media_id,
      title: i.content?.title || "",
    })),
  };
}

// ---------- Get draft by media_id ----------

export interface DraftDetail {
  media_id: string;
  content: {
    title: string;
    author: string;
    digest: string;
    content: string;
    content_source_url: string;
    thumb_media_id: string;
    show_cover_pic: number;
    need_open_comment: number;
    only_fans_can_comment: number;
  };
  update_time: number;
}

export async function getDraftById(
  accessToken: string,
  mediaId: string
): Promise<DraftDetail> {
  const data = await fetchJson(
    `${WEIXIN_API}/draft/get?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    }
  );
  return data;
}

// ---------- Free publish (no push notification) ----------

export async function freePublish(
  accessToken: string,
  mediaId: string
): Promise<string> {
  const data = await fetchJson(
    `${WEIXIN_API}/freepublish/submit?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    }
  );
  return data.publish_id;
}

// ---------- Mass send (push to followers) ----------

export async function massSend(
  accessToken: string,
  mediaId: string
): Promise<number> {
  const data = await fetchJson(
    `${WEIXIN_API}/message/mass/sendall?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: { is_to_all: true },
        mpnews: { media_id: mediaId },
        msgtype: "mpnews",
        send_ignore_reprint: 0,
      }),
    }
  );
  return data.msg_id;
}
