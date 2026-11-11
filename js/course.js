/* ===== 课程模块：列表 + 详情（Markdown 渲染 + 完成标记） ===== */
(function () {
  const App = (window.App = window.App || {});
  App.course = {};

  // 给渲染后的正文二级标题加锚点，生成目录 { html, items }
  function tocify(html) {
    const items = [];
    let n = 0;
    const out = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_m, inner) => {
      const id = "sec-" + (n++);
      items.push({ id, text: inner.replace(/<[^>]*>/g, "").trim() });
      return '<h2 id="' + id + '">' + inner + "</h2>";
    });
    return { html: out, items };
  }

  // 模块卡片网格（首页与课程列表复用）
  App.course.renderGrid = function (container) {
    const mods = App.MANIFEST.modules;
    const s = App.store.get();
    let html = '<div class="grid">';
    mods.forEach((m) => {
      const isDone = !!(s.courseProgress[m.id] && s.courseProgress[m.id].completed);
      const answered = Object.keys(s.quizHistory[m.id] || {}).length;
      html += `
        <a class="module-card" href="#/course/${m.id}" style="border-top-color:${m.color}">
          <div class="mc-icon" style="background:${m.color}1a;color:${m.color}">${m.icon}</div>
          <h3>${App.esc(m.title)}</h3>
          <p>${App.esc(m.desc)}</p>
          <div class="mc-progress"><span style="width:${isDone ? 100 : 0}%;background:${m.color}"></span></div>
          <div class="mc-meta">
            <span class="${isDone ? "done" : ""}">${isDone ? "✓ 已学完" : "未完成"}</span>
            <span>已刷 ${answered} 题</span>
          </div>
        </a>`;
    });
    html += "</div>";
    container.innerHTML = html;
  };

  App.course.renderList = function (container) {
    container.innerHTML = `
      <h1>课程学习</h1>
      <p class="text-sub" style="color:var(--text-sub)">按深圳科创自招硬件方向考点分为 7 大模块，每个模块学完后点「标记完成」。</p>
    `;
    const wrap = document.createElement("div");
    container.appendChild(wrap);
    App.course.renderGrid(wrap);
  };

  App.course.renderDetail = async function (container, moduleId) {
    const m = App.moduleById(moduleId);
    if (!m) {
      container.innerHTML = '<div class="empty">未找到该模块</div>';
      return;
    }
    try {
      const md = await App.fetchText(m.course);
      // 去掉正文里重复的一级标题（标题已显示在头部卡片）
      const mdBody = md.replace(/^#\s+[^\n]*\n*/, "");
      const { html: articleHtml, items: toc } = tocify(App.md(mdBody));
      const isDone = App.store.isCourseDone(moduleId);
      const logged = App.auth && App.auth.isLoggedIn();
      container.innerHTML = `
        <a class="back-link" href="#/course">← 返回课程列表</a>
        <div class="card">
          <h1 style="margin-bottom:4px">${m.icon} ${App.esc(m.title)}</h1>
          <p style="color:var(--text-sub);margin-bottom:12px">${App.esc(m.desc)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="tag">课程</span>
            <a class="tag green" href="#/quiz/${m.id}">刷题 →</a>
            <a class="tag amber" href="#/practice">实操 →</a>
            ${isDone ? '<span class="tag green">✓ 已完成</span>' : ""}
          </div>
        </div>
        ${toc.length ? `
          <div class="card toc-card">
            <h3>📖 本模块目录</h3>
            <ul class="toc-list">
              ${toc.map((it) => `<li><a data-sec="${it.id}">${App.esc(it.text)}</a></li>`).join("")}
            </ul>
          </div>` : ""}
        <div class="card article">
          <div class="markdown">${articleHtml}</div>
        </div>
        <div class="card" style="text-align:center">
          ${logged ? `
            <button class="btn ${isDone ? "secondary" : "success"}" id="doneBtn">
              ${isDone ? "✓ 已完成（点击取消）" : "标记为已完成"}
            </button>` : `
            <p style="color:var(--text-sub);margin:0 0 8px">💡 登录后才会保存学习进度</p>
            <a class="btn" href="#/login">登录后标记完成</a>`}
        </div>
        <p style="text-align:center;margin-top:2px"><a class="back-top" id="backTop">↑ 回到顶部</a></p>
      `;

      // 目录点击平滑跳转到对应小节
      container.querySelectorAll("[data-sec]").forEach((el) => {
        el.onclick = () => {
          const t = document.getElementById(el.getAttribute("data-sec"));
          if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });
      const backTop = document.getElementById("backTop");
      if (backTop) backTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

      if (logged) {
        document.getElementById("doneBtn").addEventListener("click", () => {
          App.store.setCourseDone(moduleId, !App.store.isCourseDone(moduleId));
          App.renderRoute();
        });
      }

      // 学习时长计时
      App.stats.startTick(moduleId);
    } catch (err) {
      container.innerHTML =
        '<div class="empty">课程加载失败：' + App.esc(err.message || err) + "</div>";
    }
  };
})();
