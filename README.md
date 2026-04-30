# WeChat Official Account Publisher API

基于 [Hono.js](https://hono.dev/) 的微信公众号文章发布 API 服务。支持 Markdown 转 HTML、AI 文生图自动生成封面、上传封面图/内嵌图片、创建草稿、一键发布。

## 快速开始

```bash
cp .env.example .env
# 编辑 .env，填入你的 WEIXIN_APP_ID 和 WEIXIN_APP_SECRET
npm install
npm run dev
```

## API 接口

所有需要鉴权的接口支持两种方式：
- Query 参数传入 `access_token`
- 自动通过 `app_id` / `app_secret`（env 或 query 参数）获取 token

### `GET/POST /mpapi/getaccesstoken`

获取 access_token。

```
curl "http://localhost:3009/mpapi/getaccesstoken?app_id=XXX&app_secret=YYY"
```

### `POST /mpapi/addmaterial`

上传封面图（永久素材），返回 `media_id`。

```
curl -X POST "http://localhost:3009/mpapi/addmaterial?access_token=TOKEN" \
  -F "media=@cover.jpg" \
  -F "type=thumb"
```

### `POST /mpapi/uploadimage`

上传正文内嵌图片，返回微信域名 URL。

```
curl -X POST "http://localhost:3009/mpapi/uploadimage?access_token=TOKEN" \
  -F "media=@image.png"
```

### `POST /mpapi/draftadd`

创建草稿。支持 `multipart/form-data`、`application/json`、`application/x-www-form-urlencoded`。

```
curl -X POST "http://localhost:3009/mpapi/draftadd?access_token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"标题","html":"<p>内容</p>","thumb_media_id":"MEDIA_ID"}'
```

### `GET /mpapi/drafts`

获取所有草稿列表。

```
curl "http://localhost:3009/mpapi/drafts?access_token=TOKEN"
```

返回 `{ total_count, items: [{ media_id, title }] }`

### `GET /mpapi/draft/:media_id`

获取指定草稿详情。

```
curl "http://localhost:3009/mpapi/draft/EDIA_ID?access_token=TOKEN"
```

### `POST /mpapi/draftupdate`

更新已有草稿。至少传入 `media_id`，其他字段可选。

```
curl -X POST "http://localhost:3009/mpapi/draftupdate?access_token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"media_id":"DRAFT_MEDIA_ID","title":"新标题","content":"<p>新内容</p>","thumb_media_id":"NEW_MEDIA_ID"}'
```

### `POST /mpapi/publish`

发布草稿。

```
curl -X POST "http://localhost:3009/mpapi/publish?access_token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"media_id":"DRAFT_MEDIA_ID","method":"free"}'
```

`method` 可选值：`free`（不推送粉丝）、`mass`（群发给粉丝）。

### `POST /mpapi/convert`

Markdown 转 WeChat 兼容 HTML（内联样式）。不需要鉴权。

```
curl -X POST http://localhost:3009/mpapi/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Hello\n\n**加粗**文本"}'
```

### `POST /mpapi/generate-cover`

AI 文生图，传入描述生成封面图。需要配置 `IMAGE_API_KEY`。

```
curl -X POST http://localhost:3009/mpapi/generate-cover \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a cute cat reading a book","size":"1024x1024"}'
```

可选参数：`model`、`size`、`quality`、`n`。

### `POST /mpapi/full-publish`

一站式发布：上传封面 → Markdown 转 HTML → 上传内嵌图片 → 创建草稿 → 发布。

支持两种封面方式（二选一）：

**方式一：上传本地图片**
```
curl -X POST "http://localhost:3009/mpapi/full-publish" \
  -F "title=文章标题" \
  -F "markdown=@article.md" \
  -F "cover=@cover.jpg" \
  -F "author=作者" \
  -F "publish_method=draft"
```

**方式二：AI 自动生成封面**
```
curl -X POST "http://localhost:3009/mpapi/full-publish" \
  -F "title=文章标题" \
  -F "markdown=@article.md" \
  -F "cover_prompt=a cute cat reading a book" \
  -F "author=作者" \
  -F "publish_method=draft"
```

`publish_method` 可选值：
- `draft` — 只创建草稿，不发布（推荐）
- `free` — 创建草稿 + 发布（不推送粉丝）
- `mass` — 创建草稿 + 群发（推送给粉丝）

## 配置

| 环境变量 | 说明 | 必填 |
|---|---|---|
| `WEIXIN_APP_ID` | 公众号 AppID | 是 |
| `WEIXIN_APP_SECRET` | 公众号 AppSecret | 是 |
| `API_KEY` | API 鉴权密钥，所有 `/mpapi/*` 接口需要传入 | 是 |
| `IMAGE_API_KEY` | 文生图 API Key（用于自动生成封面） | 否 |
| `IMAGE_API_BASE_URL` | 文生图 API 地址，默认 `https://api.tu-zi.com` | 否 |
| `IMAGE_MODEL` | 文生图模型，默认 `gpt-image-2` | 否 |
| `PORT` | 服务端口，默认 3000 | 否 |

## 注意事项

- 运行服务器的 IP 需要加入微信公众号后台的 IP 白名单
- 正文中的 CSS 样式必须是内联样式，`/mpapi/convert` 已自动处理
- 正文中的外部图片会自动上传到微信服务器并替换 URL
- Access Token 全局缓存，过期前 5 分钟自动刷新
