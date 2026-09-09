/* ==========================================================================
   markdown.js — 极简 Markdown 渲染器 + 代码高亮（零依赖）
   用法： const { html, toc } = MD.render(markdownText)
   安全：所有内容默认转义，不执行原始 HTML
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- 工具 ---------- */
  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function slugify(text) {
    return String(text)
      .replace(/<[^>]*>/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 64) || 'section';
  }

  const stripTags = (s) => String(s).replace(/<[^>]*>/g, '');

  /* ---------- 行内解析 ---------- */
  function emphasis(t) {
    return t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  }

  function inline(text) {
    const store = [];
    const stash = (html) => { store.push(html); return '\u0000' + (store.length - 1) + '\u0000'; };

    let t = escapeHtml(text);

    /* 行内代码 */
    t = t.replace(/(`+)([\s\S]*?)\1/g, (m, ticks, code) =>
      stash('<code>' + code.replace(/^\s+|\s+$/g, '') + '</code>'));

    /* 图片 */
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (m, alt, src, title) =>
        stash('<img src="' + src + '" alt="' + alt + '"' +
          (title ? ' title="' + title + '"' : '') + ' loading="lazy">'));

    /* 链接 */
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (m, label, href, title) => {
        const ext = /^https?:\/\//i.test(href);
        return stash('<a href="' + href + '"' +
          (title ? ' title="' + title + '"' : '') +
          (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
          emphasis(label) + '</a>');
      });

    /* 裸链接 */
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) =>
      pre + stash('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>'));

    /* 强调 */
    t = emphasis(t);

    /* 还原占位符 */
    t = t.replace(/\u0000(\d+)\u0000/g, (m, i) => store[+i]);
    return t;
  }

  /* ---------- 语法高亮 ---------- */
  const KW = {
    js: 'const let var function return if else for while do break continue class extends new this super typeof instanceof in of null undefined true false async await try catch finally throw switch case default delete void yield static get set import from export as',
    ts: 'const let var function return if else for while do break continue class extends implements new this super typeof instanceof in of null undefined true false async await try catch finally throw switch case default delete void yield static get set import from export as interface type enum declare public private protected readonly abstract namespace as satisfies',
    python: 'def class return if elif else for while break continue import from as pass raise try except finally with lambda None True False and or not in is global nonlocal yield async await assert del print self',
    java: 'public private protected class interface extends implements static final void int long double float boolean char byte short new return if else for while do break continue switch case default try catch finally throw throws this super null true false package import abstract synchronized volatile transient native instanceof enum record var String',
    sql: 'select from where group by order having limit offset insert into values update set delete join left right inner outer full on as and or not null distinct count sum avg min max case when then else end union all create table index view drop alter primary key foreign references default exists between like',
    sh: 'if then else elif fi for do done while case esac function return export local readonly echo cd ls mkdir rm cp mv cat grep sed awk curl wget git npm node python pip sudo chmod source set unset exit',
    go: 'package import func var const type struct interface map chan go defer return if else for range switch case default break continue nil true false fallthrough select make new len cap append',
    rust: 'fn let mut const struct enum impl trait use pub mod match if else for while loop return break continue where async await move ref self Self true false Some None Ok Err dyn box crate super',
    c: 'int long double float char void struct union enum typedef static const return if else for while do break continue switch case default sizeof include define unsigned signed extern goto inline volatile register bool true false class public private template namespace using',
    css: '',
    json: '',
    yaml: '',
  };

  const ALIAS = {
    javascript: 'js', node: 'js', jsx: 'js', mjs: 'js', typescript: 'ts', tsx: 'ts',
    py: 'python', python3: 'python',
    bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', terminal: 'sh', sh: 'sh',
    golang: 'go', rs: 'rust', 'c++': 'c', cpp: 'c', h: 'c', hpp: 'c', objc: 'c',
    mysql: 'sql', postgres: 'sql', psql: 'sql', hive: 'sql', sql: 'sql',
    yml: 'yaml', jsonc: 'json', scss: 'css', less: 'css', html: 'xml', htm: 'xml',
  };

  function langInfo(raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) return null;
    const norm = ALIAS[key] || key;
    if (norm === 'xml' || norm === 'json' || norm === 'yaml' || norm === 'css') {
      return { key: norm, keywords: null, line: norm === 'json' ? null : '#', block: null };
    }
    const keywords = KW[norm];
    if (keywords === undefined) return { key: norm, keywords: null, line: null, block: null };
    const hashComment = norm === 'python' || norm === 'sh' || norm === 'yaml';
    return {
      key: norm,
      keywords: new Set(keywords.split(/\s+/).filter(Boolean)),
      line: hashComment ? '#' : '//',
      block: norm === 'python' ? null : ['/*', '*/'],
      quote: norm === 'sql' ? '"' : null,
    };
  }

  function highlight(code, rawLang) {
    const info = langInfo(rawLang);
    if (!info || !info.keywords) return escapeHtml(code);

    const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const specs = [];
    if (info.block) {
      specs.push({ cls: 'comment', re: esc(info.block[0]) + '[\\s\\S]*?' + esc(info.block[1]) });
    }
    if (info.line) specs.push({ cls: 'comment', re: esc(info.line) + '[^\\n]*' });
    specs.push({ cls: 'string', re: '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'' });
    specs.push({ cls: 'string', re: '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`' });
    specs.push({ cls: 'number', re: '\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b' });
    specs.push({ cls: 'ident',  re: '[A-Za-z_$][\\w$]*' });
    specs.push({ cls: 'punct',  re: '[^\\sA-Za-z0-9_$]+' });

    const rx = new RegExp(specs.map((s) => '(' + s.re + ')').join('|'), 'g');
    let out = '', last = 0, m;
    while ((m = rx.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, m.index));
      const gi = m.slice(1).findIndex((g) => g !== undefined);
      const tok = m[0];
      let cls = specs[gi] ? specs[gi].cls : null;

      if (cls === 'ident') {
        if (info.keywords.has(tok)) cls = 'keyword';
        else if (/^\s*\(/.test(code.slice(m.index + tok.length))) cls = 'func';
        else cls = null;
      }
      out += cls ? '<span class="tok-' + cls + '">' + escapeHtml(tok) + '</span>' : escapeHtml(tok);
      last = m.index + tok.length;
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  function codeBlock(code, lang) {
    const label = String(lang || '').trim();
    return '<div class="code-block">' +
      '<div class="code-bar"><span class="code-lang">' + escapeHtml(label || 'text') + '</span>' +
      '<button class="copy-btn" type="button" data-copy aria-label="复制代码">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '<span>复制</span></button></div>' +
      '<pre><code class="language-' + escapeHtml(label) + '">' +
      highlight(code.replace(/\n$/, ''), label) +
      '</code></pre></div>';
  }

  /* ---------- 块级解析 ---------- */
  const isHr      = (l) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
  const isHeading = (l) => /^\s*#{1,6}\s+/.test(l);
  const isFence   = (l) => /^\s*(```|~~~)/.test(l);
  const isQuote   = (l) => /^\s*>/.test(l);
  const isItem    = (l) => /^\s*([-*+]|\d+\.)\s+/.test(l);
  const isBlock   = (l) => isHr(l) || isHeading(l) || isFence(l) || isQuote(l) || isItem(l);

  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  }
  function isTableSep(line) {
    return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && /-/.test(line) && /\|/.test(line);
  }

  function listBlock(lines, start, slugger) {
    const baseIndent = lines[start].match(/^(\s*)/)[1].length;
    const ordered = /^\s*\d+\./.test(lines[start]);
    let i = start;
    const items = [];

    while (i < lines.length) {
      const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (!m) break;
      const indent = m[1].length;
      if (indent < baseIndent) break;

      if (indent > baseIndent) {                 /* 嵌套列表 → 挂到上一个条目 */
        const [nested, next] = listBlock(lines, i, slugger);
        if (items.length) items[items.length - 1].children.push(nested);
        i = next;
        continue;
      }

      const parts = [m[3]];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          const nx = lines[i + 1];
          if (nx && /^\s+/.test(nx) && !isItem(nx)) { parts.push(''); i++; continue; }
          break;
        }
        if (isItem(l)) {
          if (l.match(/^(\s*)/)[1].length <= baseIndent) break;
          break;                                  /* 更深的条目交给下一轮递归 */
        }
        if (/^\s+/.test(l) || !isBlock(l)) {
          parts.push(l.replace(/^\s{0,4}/, ''));
          i++;
          continue;
        }
        break;
      }
      items.push({ text: parts.join('\n').trim(), children: [] });
    }

    const tag = ordered ? 'ol' : 'ul';
    const html = '<' + tag + '>' + items.map((it) => {
      const body = it.text ? inline(it.text).replace(/\n+/g, '<br>') : '';
      return '<li>' + body + it.children.join('') + '</li>';
    }).join('') + '</' + tag + '>';

    return [html, i];
  }

  function render(md) {
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    const toc = [];
    const usedIds = Object.create(null);
    let i = 0;

    const uniqueId = (text) => {
      let id = slugify(text);
      if (usedIds[id]) { usedIds[id]++; id = id + '-' + usedIds[id]; }
      else usedIds[id] = 1;
      return id;
    };

    while (i < lines.length) {
      const line = lines[i];

      /* 空行 */
      if (!line.trim()) { i++; continue; }

      /* 围栏代码块 */
      const fence = line.match(/^\s*(```|~~~)\s*([^\s`]*)\s*$/);
      if (fence) {
        const marker = fence[1], lang = fence[2] || '';
        const buf = [];
        i++;
        while (i < lines.length && !new RegExp('^\\s*' + marker).test(lines[i])) { buf.push(lines[i]); i++; }
        if (i < lines.length) i++;
        out.push(codeBlock(buf.join('\n'), lang));
        continue;
      }

      /* 标题 */
      const h = line.match(/^\s*(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        const level = h[1].length;
        const raw = h[2];
        const id = uniqueId(raw);
        if (level === 2 || level === 3) {
          toc.push({ level: level, id: id, text: stripTags(inline(raw)) });
        }
        out.push('<h' + level + ' id="' + id + '">' + inline(raw) + '</h' + level + '>');
        i++;
        continue;
      }

      /* 分隔线 */
      if (isHr(line)) { out.push('<hr>'); i++; continue; }

      /* 引用 */
      if (isQuote(line)) {
        const buf = [];
        while (i < lines.length && (isQuote(lines[i]) || (lines[i].trim() && !isBlock(lines[i]) && buf.length))) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(buf.join('\n')).html + '</blockquote>');
        continue;
      }

      /* 表格 */
      if (/\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = splitRow(line);
        const align = splitRow(lines[i + 1]).map((c) => {
          const l = c.startsWith(':'), r = c.endsWith(':');
          return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
        });
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && /\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        const th = head.map((c, k) => '<th' + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inline(c) + '</th>').join('');
        const tb = rows.map((r) => '<tr>' + head.map((_, k) =>
          '<td' + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inline(r[k] || '') + '</td>').join('') + '</tr>').join('');
        out.push('<table><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table>');
        continue;
      }

      /* 列表 */
      if (isItem(line)) {
        const [html, next] = listBlock(lines, i, uniqueId);
        out.push(html);
        i = next;
        continue;
      }

      /* 段落 */
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) { buf.push(lines[i]); i++; }
      out.push('<p>' + inline(buf.join('\n')).replace(/ {2,}\n/g, '<br>\n').replace(/\n/g, ' ') + '</p>');
    }

    return { html: out.join('\n'), toc: toc };
  }

  global.MD = { render: render, escapeHtml: escapeHtml, slugify: slugify };
})(window);
