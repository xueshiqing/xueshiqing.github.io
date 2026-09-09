# xueshiqing.github.io

个人主页 + 技术博客。**纯静态、零依赖、零构建**，直接把文件推到 GitHub Pages 即可生效。

- 线上地址：<https://xueshiqing.github.io/>
- 主题：明 / 暗双色，跟随系统偏好，可手动切换（记忆在 `localStorage`）

---

## 目录结构

```
.
├── index.html              首页：个人简介 + 最新文章
├── blog.html               文章归档（按年份分组）
├── post.html               文章详情页（?p=slug）
├── 404.html                自定义 404
├── .nojekyll               告诉 GitHub Pages 不要用 Jekyll 处理
├── assets/
│   ├── css/style.css       全部样式（配色变量集中在文件顶部）
│   ├── js/markdown.js      极简 Markdown 渲染器 + 代码高亮
│   ├── js/site.js          主题切换 / 列表渲染 / 文章加载 / 复制按钮
│   └── favicon.svg
├── posts/
│   ├── posts.json          文章清单（列表页只读这个文件）
│   └── *.md                文章正文
└── lab/
    └── ultraman-bike/      独立小页面（未在导航中链接）
```

---

## 写一篇新文章

只需要两步。

**1. 新建 Markdown 文件**，例如 `posts/yarn-capacity-scheduler.md`：

````markdown
## 背景

在离线混部的场景里，资源超卖和稳定性经常互相拉扯。

```java
public class Foo {
    // 代码块会自动高亮
}
```

正文支持 **加粗**、*斜体*、`行内代码`、[链接](https://example.com)、
> 引用、列表、表格、分隔线等。
````

**2. 在 `posts/posts.json` 里登记**：

```json
{
  "posts": [
    {
      "slug": "yarn-capacity-scheduler",
      "title": "YARN Capacity Scheduler 在离线混部里的取舍",
      "date": "2025-03-14",
      "summary": "一句话摘要，显示在列表里。",
      "tags": ["资源调度", "YARN"],
      "file": "yarn-capacity-scheduler.md"
    }
  ]
}
```

提交后文章会自动出现在首页「最新文章」和 `/blog.html` 归档里。

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `slug` | ✅ | URL 里的标识，建议用英文短横线，不要重复 |
| `title` | ✅ | 文章标题 |
| `date` | ✅ | `YYYY-MM-DD`，列表按它倒序排列 |
| `summary` | — | 列表页摘要 |
| `tags` | — | 字符串数组 |
| `file` | — | 默认取 `slug + ".md"` |

> Markdown 里也可以写 `---` 包裹的 front matter（`title` / `date` / `tags`），
> 当 `posts.json` 里没写对应字段时作为兜底。

### Markdown 支持范围

标题、段落、`**加粗**`、`*斜体*`、`~~删除线~~`、行内代码、围栏代码块（带高亮和复制按钮）、
有序/无序列表（支持嵌套）、引用、表格、图片、链接、分隔线、自动识别裸链接。

出于安全考虑**原始 HTML 会被转义**，不会被当作标签执行。

---

## 改个人信息

- **名字、标语、简介、联系方式**：编辑 `index.html` 里的 `.hero` 区块。
- **头像**：用的是 GitHub 头像地址 `https://avatars.githubusercontent.com/u/39235658?v=4`，
  换成自己的链接或放一张图到 `assets/` 里引用即可。
- **导航里的 GitHub 链接 / 页脚**：三个 HTML 页面的顶栏和页脚是复制粘贴的，一起改。

## 改配色

全部颜色都在 `assets/css/style.css` 顶部的 CSS 变量里，明暗两套：

```css
:root { --accent: #2563eb; --bg: #ffffff; /* … */ }
html[data-theme="dark"] { --accent: #6ea8fe; --bg: #0a0d13; /* … */ }
```

改 `--accent` 就能换掉全站主色。

## 本地预览

因为文章是 `fetch()` 加载的 Markdown，**不能直接双击打开**（`file://` 会被浏览器拦截），
起一个静态服务器即可：

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000
```

## 部署

仓库根目录就是站点根目录，推送到 `master` 后 GitHub Pages 会自动发布（通常 1 分钟内）。

```bash
git add -A
git commit -m "更新文章"
git push origin master
```

---

## 关于 `lab/`

`lab/` 下放一些和博客无关的独立小页面，目前有：

- `lab/ultraman-bike/` —— 一个纯 SVG 骨骼动画：奥特曼骑自行车（蹬踏为二段式 IK 运动学）。
  地址：<https://xueshiqing.github.io/lab/ultraman-bike/>

这些页面**没有在导航里挂链接**，只能通过直接访问 URL 打开。
