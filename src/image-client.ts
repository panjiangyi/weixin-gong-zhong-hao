const DEFAULT_BASE_URL = "https://api.tu-zi.com";
const DEFAULT_MODEL = "gpt-image-2";

interface GenerateImageOptions {
  size?: string;
  quality?: string;
  model?: string;
  n?: number;
}

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<{ url?: string; b64_json?: string }[]> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) throw new Error("IMAGE_API_KEY is not set in env");

  const baseUrl = process.env.IMAGE_API_BASE_URL || DEFAULT_BASE_URL;
  const model = options.model || process.env.IMAGE_MODEL || DEFAULT_MODEL;

  const body: Record<string, any> = {
    model,
    prompt,
    size: options.size || "1024x1024",
    quality: options.quality || "auto",
    n: options.n || 1,
  };

  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Image API error: ${JSON.stringify(data.error)}`);
  }

  return data.data;
}

/** Generate an image and return it as a Buffer */
export async function generateImageBuffer(
  prompt: string,
  options?: GenerateImageOptions
): Promise<Buffer> {
  const images = await generateImage(prompt, options);
  const img = images?.[0];
  if (!img) throw new Error("No image generated");

  if (img.b64_json) {
    return Buffer.from(img.b64_json, "base64");
  }

  if (img.url) {
    const res = await fetch(img.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  throw new Error("Image response has neither url nor b64_json");
}
