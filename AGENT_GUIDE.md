# 微信公众号文章发布自动化指南 (Agent Skills)

本指南旨在帮助 Agent 通过一系列 API 调用，自动化完成从生成封面到发布公众号草稿的全过程。

## 基础信息

- **接口域名**: `http://123.56.160.120:3009`
- **基础路径**: `/mpapi`
- **鉴权方式**: 所有接口均已预配置凭据，无需额外传入 access_token、app_id、app_secret 等参数。

---

## 自动化发布流程 (Step-by-Step)

### 方式一：一站式发布（推荐）

只需一次调用即可完成所有步骤。

- **接口**: `POST /mpapi/full-publish`
- **Content-Type**: `multipart/form-data`

**使用本地封面图：**
```bash
curl -X POST http://123.56.160.120:3009/mpapi/full-publish \
  -F "title=文章标题" \
  -F "markdown=@article.md" \
  -F "cover=@cover.jpg" \
  -F "author=作者名" \
  -F "publish_method=draft"
```

**使用 AI 自动生成封面（传入描述即可）：**
```bash
curl -X POST http://123.56.160.120:3009/mpapi/full-publish \
  -F "title=文章标题" \
  -F "markdown=@article.md" \
  -F "cover_prompt=a beautiful tech blog cover with blue gradient" \
  -F "author=作者名" \
  -F "publish_method=draft"
```

**参数说明：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 文章标题 |
| `markdown` | 是 | Markdown 格式的文章内容（文本或文件） |
| `cover` | 二选一 | 封面图片文件 |
| `cover_prompt` | 二选一 | 封面图的 AI 生成描述（不传 cover 时使用） |
| `author` | 否 | 作者名 |
| `publish_method` | 否 | `draft`（默认，仅创建草稿）、`free`（发布不推送）、`mass`（群发给粉丝） |

**返回示例：**
```json
{"draft_media_id":"eqs1c0iQ2rnE4P825n_MHxxx","method":"draft"}
```

调用成功后，文章即进入公众号草稿箱。

---

### 方式二：分步调用

如果需要对每一步进行更精细的控制，可以按顺序调用以下接口。

#### Step 1: AI 生成封面图

- **接口**: `POST /mpapi/generate-cover`
- **Content-Type**: `application/json`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/generate-cover \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a minimalist tech blog cover","size":"1024x1024"}'
```

**参数：** `prompt`（必填）、`size`（可选，默认 1024x1024）、`quality`（可选）、`model`（可选）

**返回示例：**
```json
{"images":[{"url":"https://..."}]}
```

> 记录返回的 `url`，可用于后续步骤。

#### Step 2: Markdown 转 HTML

- **接口**: `POST /mpapi/convert`
- **Content-Type**: `application/json`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# 标题\n\n正文内容"}'
```

**返回示例：**
```json
{"html":"<h1 style=\"...\">标题</h1>\n<p style=\"...\">正文内容</p>"}
```

> 返回的 HTML 已自动添加微信兼容的内联样式，可直接用于创建草稿。

#### Step 3: 上传封面图（获取永久素材 MediaID）

- **接口**: `POST /mpapi/addmaterial`
- **Content-Type**: `multipart/form-data`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/addmaterial \
  -F "media=@cover.jpg" \
  -F "type=thumb"
```

**返回示例：**
```json
{"media_id":"eqs1c0iQ2rnE4xxx","url":"https://mmbiz.qpic.cn/..."}
```

> 记录 `media_id`，作为下一步的 `thumb_media_id` 使用。

#### Step 4: 上传正文内嵌图片（获取微信 URL）

- **接口**: `POST /mpapi/uploadimage`
- **Content-Type**: `multipart/form-data`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/uploadimage \
  -F "media=@inline-image.png"
```

**返回示例：**
```json
{"url":"https://mmbiz.qpic.cn/mmbiz_jpg/..."}
```

> Agent 需遍历文章 HTML 中的 `<img>` 标签，将外部图片 URL 替换为微信 URL，确保图片在微信客户端正常显示。

#### Step 5: 创建草稿

- **接口**: `POST /mpapi/draftadd`
- **Content-Type**: `application/json` 或 `multipart/form-data`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/draftadd \
  -H "Content-Type: application/json" \
  -d '{
    "title": "文章标题",
    "html": "<p>正文HTML</p>",
    "thumb_media_id": "Step3返回的media_id",
    "author": "作者名"
  }'
```

**返回示例：**
```json
{"media_id":"eqs1c0iQ2rnE4xxx"}
```

调用成功后，文章即进入公众号草稿箱。

#### Step 6（可选）: 发布草稿

- **接口**: `POST /mpapi/publish`
- **Content-Type**: `application/json`

```bash
curl -X POST http://123.56.160.120:3009/mpapi/publish \
  -H "Content-Type: application/json" \
  -d '{"media_id":"Step5返回的media_id","method":"free"}'
```

`method` 可选值：
- `free` — 发布但不推送粉丝通知
- `mass` — 群发给所有粉丝（订阅号每天限 1 次）

---

## 典型 Agent 工作流

```
用户：「帮我写一篇关于 XX 的文章并发布到公众号」

1. 撰写文章内容（Markdown 格式）
2. 调用 POST /mpapi/full-publish
   - title: 文章标题
   - markdown: 文章内容
   - cover_prompt: 根据文章主题生成封面描述
   - publish_method: draft
3. 告知用户文章已创建到草稿箱
```

## 注意事项

- 所有接口已预配置微信凭据，无需传入 token
- 正文必须是 Markdown 或 HTML 格式，接口会自动转换为微信兼容的内联样式 HTML
- 正文中的外部图片 URL 会在 full-publish 时自动上传到微信服务器替换
- 封面图推荐使用 `cover_prompt` AI 生成，也可上传本地图片文件
- 建议先以 `publish_method=draft` 创建草稿，用户确认后再手动发布
