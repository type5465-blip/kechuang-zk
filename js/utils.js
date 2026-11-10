/* ===== 工具函数（挂载到 window.App） ===== */
(function () {
  const App = (window.App = window.App || {});

  App.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  App.md = function (text) {
    if (window.marked && typeof window.marked.parse === "function") {
      return window.marked.parse(String(text || ""));
    }
    return App.renderMarkdown(String(text || ""));
  };

  // ===== 轻量 Markdown 渲染器（CDN 不可用时的兜底） =====
  function inline(s) {
    let html = App.esc(s);
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    html = html.replace(/(^|[^_])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    return html;
  }

  function splitRow(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  }

  App.renderMarkdown = function (src) {
    const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let list = null;

    const flushList = () => {
      if (list && list.items.length) {
        const tag = list.type === "ol" ? "ol" : "ul";
        out.push("<" + tag + ">" + list.items.map((x) => "<li>" + x + "</li>").join("") + "</" + tag + ">");
      }
      list = null;
    };

    const isBlockStart = (l) =>
      /^\s*$/.test(l) ||
      /^(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s)/.test(l) ||
      (/^\s*\|/.test(l) && /^\s*\|[\s:\-|]+\|\s*$/.test(l));

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        flushList();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push("<pre><code>" + App.esc(buf.join("\n")) + "</code></pre>");
        continue;
      }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushList();
        const lvl = h[1].length;
        out.push("<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">");
        i++;
        continue;
      }

      if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flushList();
        out.push("<hr>");
        i++;
        continue;
      }

      if (/^>\s?/.test(line)) {
        flushList();
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + App.renderMarkdown(buf.join("\n")) + "</blockquote>");
        continue;
      }

      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
        flushList();
        const header = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        let t = "<table><thead><tr>" + header.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>";
        rows.forEach((r) => { t += "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>"; });
        out.push(t + "</tbody></table>");
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          list.items.push(inline(lines[i].replace(/^\s*[-*+]\s+/, "")));
          i++;
        }
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          list.items.push(inline(lines[i].replace(/^\s*\d+[.)]\s+/, "")));
          i++;
        }
        continue;
      }

      if (/^\s*$/.test(line)) { flushList(); i++; continue; }

      flushList();
      const buf = [];
      while (i < lines.length && !isBlockStart(lines[i])) { buf.push(lines[i]); i++; }
      out.push("<p>" + inline(buf.join("<br>")) + "</p>");
    }
    flushList();
    return out.join("\n");
  };

  App.fetchText = async function (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("加载失败: " + url + " (" + res.status + ")");
    return res.text();
  };

  App.fetchJSON = async function (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("加载失败: " + url + " (" + res.status + ")");
    return res.json();
  };

  App.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  App.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  App.fmtDate = function (ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  App.fmtDuration = function (seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} 小时 ${m} 分`;
    if (m > 0) return `${m} 分钟`;
    return `${seconds} 秒`;
  };

  App.clamp = function (n, min, max) {
    return Math.min(max, Math.max(min, n));
  };
})();
