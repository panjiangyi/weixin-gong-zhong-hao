# 测试文章标题

这是一篇通过 API 自动发布的测试文章。

## 为什么自动化发布很重要

每天手动登录公众号后台、排版、发布，**太浪费时间了**。自动化可以帮你：

- 节省每天 30 分钟的排版时间
- 统一文章风格
- 支持定时批量发布

## 技术实现

核心流程只有四步：

1. 获取 Access Token
2. 上传封面图
3. 创建草稿
4. 触发发布

> 把重复的事情交给程序，把创造力留给内容本身。

## 代码示例

```javascript
const publish = async (title, markdown, cover) => {
  const res = await fetch('/mpapi/full-publish', {
    method: 'POST',
    body: formData
  });
  return res.json();
};
```

---

*本文由自动化系统发布，感谢阅读！*
