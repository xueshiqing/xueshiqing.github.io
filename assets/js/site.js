/* ==========================================================================
   site.js — 站点通用逻辑：主题切换 / 文章列表 / 文章渲染 / 代码复制
   依赖：markdown.js（post 页面需要）
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const MANIFEST = 'posts/posts.json';

  /* ---------------------------------------------------------------- 主题 */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $$('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-label', t === 'dark' ? '切换到浅色主题' : '切换到深色主题');
      b.setAttribute('title', t === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    });
  }

  window.toggleTheme = function () {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('blog-theme', next); } catch (e) { /* 隐私模式 */ }
    applyTheme(next);
  };

  /* ------------------------------------------------------- 工具：日期/时长 */
  function fmtDate(d) {
    const s = String(d || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s || '未标注日期';
  }

  function readingTime(md) {
    const cjk = (md.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (md.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 400 + words / 220));
  }

  /* ------------------------------------------------------- front matter */
  function splitFrontMatter(md) {
    const text = String(md || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return { meta: {}, body: text };

    const meta = {};
    m[1].split('\n').forEach((line) => {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kv) return;
      let v = kv[2].trim().replace(/^["']|["']$/g, '');
      if (/^\[.*\]$/.test(v)) {
        v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      }
      meta[kv[1]] = v;
    });
    return { meta: meta, body: text.slice(m[0].length) };
  }

  /* ------------------------------------------------------------- 列表渲染 */
  function postListItem(p) {
    const tags = (p.tags || []).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
    return '<li class="post-item"><a href="post.html?p=' + encodeURIComponent(p.slug) + '">' +
      '<h3>' + esc(p.title) + '</h3>' +
      (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') +
      '<div class="post-meta">' +
        '<time datetime="' + esc(p.date) + '">' + esc(fmtDate(p.date)) + '</time>' +
        (p.reading ? '<span class="dot">·</span><span>' + p.reading + ' 分钟</span>' : '') +
        (tags ? '<span class="dot">·</span>' + tags : '') +
      '</div></a></li>';
  }

  function emptyState(title, sub) {
    return '<div class="empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
      '<p>' + esc(title) + '</p>' +
      (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + '</div>';
  }

  function loadManifest() {
    return fetch(MANIFEST, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.posts || []);
        return list
          .filter((p) => p && p.slug)
          .map((p) => Object.assign({}, p, {
            date: fmtDate(p.date),
            tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []),
          }))
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      });
  }

  /* ------------------------------------------------------------- 首页列表 */
  function renderHomeList() {
    const box = $('[data-latest-posts]');
    if (!box) return;
    const limit = parseInt(box.getAttribute('data-limit') || '4', 10);

    loadManifest().then((posts) => {
      if (!posts.length) {
        box.innerHTML = emptyState('还没有文章。', '写好第一篇之后，它会出现在这里。');
        return;
      }
      box.innerHTML = '<ul class="post-list">' +
        posts.slice(0, limit).map(postListItem).join('') + '</ul>';
    }).catch(() => {
      box.innerHTML = emptyState('文章列表加载失败。', '请检查 posts/posts.json 是否存在且格式正确。');
    });
  }

  /* ------------------------------------------------------------- 归档页 */
  function renderArchive() {
    const box = $('[data-archive]');
    if (!box) return;

    loadManifest().then((posts) => {
      if (!posts.length) {
        box.innerHTML = emptyState('还没有文章。', '写好第一篇之后，它会出现在这里。');
        return;
      }
      const groups = {};
      posts.forEach((p) => {
        const y = String(p.date).slice(0, 4) || '未分类';
        (groups[y] = groups[y] || []).push(p);
      });
      box.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map((y) =>
        '<div class="archive-year">' + esc(y) + ' · ' + groups[y].length + ' 篇</div>' +
        '<ul class="post-list">' + groups[y].map(postListItem).join('') + '</ul>'
      ).join('');
    }).catch(() => {
      box.innerHTML = emptyState('文章列表加载失败。', '请检查 posts/posts.json 是否存在且格式正确。');
    });
  }

  /* ------------------------------------------------------------- 文章页 */
  function renderPostPage() {
    const host = $('[data-post]');
    if (!host) return;

    const slug = new URLSearchParams(location.search).get('p');
    if (!slug) {
      host.innerHTML = emptyState('没有指定文章。', '从文章列表里选一篇吧。');
      return;
    }

    host.innerHTML = '<div class="loading"><div class="spinner"></div>正在加载…</div>';

    loadManifest().then((posts) => {
      const idx = posts.findIndex((p) => p.slug === slug);
      if (idx < 0) throw new Error('not-found');
      const post = posts[idx];
      const file = post.file || (slug + '.md');

      return fetch('posts/' + file, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then((md) => {
          const fm = splitFrontMatter(md);
          const meta = {
            title: post.title || fm.meta.title || slug,
            date: post.date || fm.meta.date || '',
            tags: post.tags && post.tags.length ? post.tags : (fm.meta.tags || []),
            summary: post.summary || fm.meta.summary || '',
          };
          const rendered = window.MD.render(fm.body);

          document.title = meta.title + ' · xueshiqing';

          const toc = rendered.toc.length > 1
            ? '<nav class="toc"><div class="toc-title">目录</div><ul>' +
              rendered.toc.map((t) => '<li class="lvl-' + t.level + '"><a href="#' + t.id + '">' + esc(t.text) + '</a></li>').join('') +
              '</ul></nav>'
            : '';

          const tags = (meta.tags || []).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');

          host.innerHTML =
            '<header class="post-header">' +
              '<h1>' + esc(meta.title) + '</h1>' +
              '<div class="post-meta">' +
                '<time datetime="' + esc(meta.date) + '">' + esc(fmtDate(meta.date)) + '</time>' +
                '<span class="dot">·</span><span>' + readingTime(fm.body) + ' 分钟阅读</span>' +
                (tags ? '<span class="dot">·</span>' + tags : '') +
              '</div>' +
            '</header>' + toc +
            '<article class="prose">' + rendered.html + '</article>' +
            postNav(posts, idx);

          window.scrollTo(0, 0);
        });
    }).catch((err) => {
      host.innerHTML = err && err.message === 'not-found'
        ? emptyState('找不到这篇文章。', '它可能已被重命名或删除。')
        : emptyState('文章加载失败。', '请检查 posts/ 目录下的 Markdown 文件是否存在。');
    });
  }

  function postNav(posts, idx) {
    const newer = posts[idx - 1];   /* 列表按日期倒序，上一条 = 更新 */
    const older = posts[idx + 1];
    if (!newer && !older) return '';
    return '<nav class="post-nav">' +
      (older ? '<a href="post.html?p=' + encodeURIComponent(older.slug) + '">' +
        '<span class="dir">← 上一篇</span><span class="title">' + esc(older.title) + '</span></a>' : '<span></span>') +
      (newer ? '<a class="next" href="post.html?p=' + encodeURIComponent(newer.slug) + '">' +
        '<span class="dir">下一篇 →</span><span class="title">' + esc(newer.title) + '</span></a>' : '') +
      '</nav>';
  }

  /* --------------------------------------------------------- 代码复制按钮 */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); }
      catch (e) { reject(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const block = btn.closest('.code-block');
    const code = block && block.querySelector('code');
    if (!code) return;

    copyText(code.innerText).then(() => {
      const label = btn.querySelector('span');
      const old = label ? label.textContent : '';
      btn.classList.add('done');
      if (label) label.textContent = '已复制';
      setTimeout(() => { btn.classList.remove('done'); if (label) label.textContent = old || '复制'; }, 1600);
    }).catch(() => { /* 静默失败 */ });
  });

  /* --------------------------------------------------------------- 启动 */
  function boot() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', window.toggleTheme));

    /* 当前导航高亮 */
    const here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav a[data-nav]').forEach((a) => {
      const target = a.getAttribute('href');
      const active = target === here || (here === 'post.html' && target === 'blog.html');
      if (active) a.setAttribute('aria-current', 'page');
    });

    renderHomeList();
    renderArchive();
    renderPostPage();

    const y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
