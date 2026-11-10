/* ===== 实操教程 + 面试指导（Markdown 渲染） ===== */
(function () {
  const App = (window.App = window.App || {});
  App.practice = {};

  function renderList(container, items, title, intro, baseHash) {
    container.innerHTML = `
      <h1>${title}</h1>
      <p style="color:var(--text-sub)">${intro}</p>
      <div class="list"></div>
    `;
    const list = container.querySelector(".list");
    items.forEach((it) => {
      const a = document.createElement("a");
      a.className = "list-item";
      a.href = "#/" + baseHash + "/" + it.id;
      a.innerHTML = `
        <div class="li-icon">${it.icon}</div>
        <div class="li-body">
          <div class="li-title">${App.esc(it.title)}</div>
          <div class="li-desc">${App.esc(it.desc)}</div>
        </div>
        <div class="li-arrow">→</div>`;
      list.appendChild(a);
    });
  }

  function renderDetail(container, items, id, backHash, backLabel) {
    const it = items.find((x) => x.id === id);
    if (!it) {
      container.innerHTML = '<div class="empty">未找到该内容</div>';
      return;
    }
    App.fetchText(it.file)
      .then((md) => {
        container.innerHTML = `
          <a class="back-link" href="#/${backHash}">← ${backLabel}</a>
          <div class="card article">
            <div class="markdown">${App.md(md)}</div>
          </div>`;
      })
      .catch((err) => {
        container.innerHTML =
          '<div class="empty">内容加载失败：' + App.esc(err.message || err) + "</div>";
      });
  }

  App.practice.renderList = function (container) {
    renderList(container, App.MANIFEST.practices, "🛠️ 实操教程",
      "动手搭建是硬件方向考核的重点，跟着步骤动手做一遍，比只看书更有效。", "practice");
  };
  App.practice.renderDetail = function (container, id) {
    renderDetail(container, App.MANIFEST.practices, id, "practice", "返回实操教程");
  };

  App.practice.renderInterviewList = function (container) {
    renderList(container, App.MANIFEST.interview, "🎤 面试与答辩",
      "深圳自招普遍采用无领导小组面试或项目答辩，考察表达、逻辑与专业基础。", "interview");
  };
  App.practice.renderInterviewDetail = function (container, id) {
    renderDetail(container, App.MANIFEST.interview, id, "interview", "返回面试指导");
  };
})();
