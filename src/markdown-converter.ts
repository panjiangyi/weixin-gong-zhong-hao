import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

// WeChat requires all CSS inline, no <style> tags
const inlineStyles: Record<string, string> = {
  h1: "font-size:22px;font-weight:bold;margin:24px 0 12px;color:#191919;",
  h2: "font-size:20px;font-weight:bold;margin:20px 0 10px;color:#191919;",
  h3: "font-size:18px;font-weight:bold;margin:18px 0 8px;color:#191919;",
  h4: "font-size:16px;font-weight:bold;margin:16px 0 8px;color:#333;",
  p: "margin:10px 0;line-height:1.8;color:#3f3f3f;font-size:15px;",
  blockquote:
    "border-left:3px solid #e0e0e0;padding:8px 16px;margin:12px 0;color:#666;background:#f9f9f9;",
  pre: "background:#f6f8fa;padding:16px;border-radius:4px;overflow-x:auto;margin:12px 0;",
  code: "background:#f0f0f0;padding:2px 4px;border-radius:3px;font-size:14px;color:#c7254e;",
  // code block <code> inside <pre> should not have inline background
  "pre code": "background:none;padding:0;color:#333;font-size:14px;",
  ul: "margin:8px 0;padding-left:24px;color:#3f3f3f;",
  ol: "margin:8px 0;padding-left:24px;color:#3f3f3f;",
  li: "margin:4px 0;line-height:1.8;font-size:15px;",
  table: "border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;",
  th: "border:1px solid #ddd;padding:8px 12px;background:#f6f8fa;font-weight:bold;text-align:left;",
  td: "border:1px solid #ddd;padding:8px 12px;",
  img: "max-width:100%;height:auto;display:block;margin:12px auto;border-radius:4px;",
  a: "color:#576b95;text-decoration:none;",
  strong: "font-weight:bold;color:#191919;",
  em: "font-style:italic;color:#333;",
  hr: "border:none;border-top:1px solid #e0e0e0;margin:20px 0;",
};

function applyInlineStyles(html: string): string {
  let result = html;

  // Apply styles to opening tags
  for (const [tag, style] of Object.entries(inlineStyles)) {
    if (tag.includes(" ")) {
      // e.g. "pre code" — handle nested pattern
      const [parent, child] = tag.split(" ");
      const regex = new RegExp(
        `<${parent}([^>]]*?)>\\s*<${child}(\\s*?)>`,
        "g"
      );
      result = result.replace(regex, (_match, parentAttrs, childSpace) => {
        return `<${parent}${parentAttrs}><${child}${childSpace}style="${style}">`;
      });
    } else {
      // Match <tag> or <tag attr="..."> — always inject space before style
      const regex = new RegExp(`<${tag}(\\s[^>]*)?(\\/?)>`, "g");
      result = result.replace(regex, (_, attrs, selfClose) => {
        return `<${tag}${attrs ?? ""} style="${style}"${selfClose}>`;
      });
    }
  }

  return result;
}

export function markdownToWechatHtml(markdown: string): string {
  const html = md.render(markdown);
  return applyInlineStyles(html);
}
