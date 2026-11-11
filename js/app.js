/* ===== 入口：导航、路由注册、首页、设置页 ===== */
(function () {
  const App = (window.App = window.App || {});

  // 首页
  function renderHome(container) {
    const s = App.store.get();
    let answered = 0,
      correct = 0,
      wrongCount = 0,
      time = 0;
    App.MANIFEST.modules.forEach((m) => {
      const hist = s.quizHistory[m.id] || {};
      const vals = Object.values(hist);
      answered += vals.length;
      correct += vals.filter((e) => e.correct).length;
      wrongCount += (s.wrongBook[m.id] || []).length;
      time += s.studyTime[m.id] || 0;
    });
    const rate = answered ? Math.round((correct / answered) * 100) : null;

    container.innerHTML = `
      <div class="hero">
        <h1>🔧 深圳科创自招 · 硬件方向备考</h1>
        <p class="hero-sub">系统备考电路 / 传感器 / 单片机 / 机器人结构 / 数理基础，覆盖笔试、实操与面试。</p>
        <div class="hero-actions">
          <a class="btn btn-solid" href="#/course">开始学习</a>
          <a class="btn btn-glass" href="#/exam">模拟考试</a>
          <a class="btn btn-glass" href="#/practice">实操教程</a>
          <a class="btn btn-glass" href="#/chat">智能答疑</a>
        </div>
        <div class="hero-rule">
          <span class="label">录取规则</span>
          <span class="formula">中考成绩 × 60% + 专项考核 × 40%</span>
        </div>
        <p id="homeSync" style="margin-top:12px;font-size:.85rem;color:var(--text-sub)"></p>
      </div>

      <div class="stat-grid">
        <div class="card stat-card"><div class="stat-num">${answered}</div><div class="stat-label">已做题数</div></div>
        <div class="card stat-card"><div class="stat-num">${rate === null ? "—" : rate + "%"}</div><div class="stat-label">总正确率</div></div>
        <div class="card stat-card"><div class="stat-num" style="color:var(--danger)">${wrongCount}</div><div class="stat-label">待复习错题</div></div>
        <div class="card stat-card"><div class="stat-num">${App.fmtDuration(time)}</div><div class="stat-label">学习时长</div></div>
      </div>

      <div class="section-title"><h2>七大知识模块</h2><a href="#/course">全部 →</a></div>
    `;
    const grid = document.createElement("div");
    container.appendChild(grid);
    App.course.renderGrid(grid);
    updateAccountUI();
  }

  // 设置页
  function renderSettings(container) {
    const st = App.store.getSettings();
    container.innerHTML = `
      <h1>⚙️ 设置</h1>
      <div class="card">
        <h3>🤖 AI 智能答疑（可选）</h3>
        <p style="color:var(--text-sub);font-size:.9rem">默认用课程内容检索答疑，零成本。填入你自己的 API Key 后可启用真·AI 对话。Key 仅保存在本机浏览器，不会上传或硬编码进代码。</p>
        <form id="settingsForm" style="margin-top:10px">
          <label style="display:block;margin-bottom:12px;font-weight:600">
            <input type="checkbox" id="sAi" ${st.aiEnabled ? "checked" : ""}> 启用真·AI 对话
          </label>
          <label style="display:block;margin-bottom:6px;font-size:.88rem">API 地址（Base URL）</label>
          <input class="blank-input" id="sBase" value="${App.esc(st.apiBase)}" style="margin-bottom:12px">
          <label style="display:block;margin-bottom:6px;font-size:.88rem">模型名称</label>
          <input class="blank-input" id="sModel" value="${App.esc(st.apiModel)}" style="margin-bottom:12px">
          <label style="display:block;margin-bottom:6px;font-size:.88rem">API Key</label>
          <input class="blank-input" id="sKey" type="password" value="${App.esc(st.apiKey)}" placeholder="sk-..." style="margin-bottom:14px">
          <button class="btn" type="submit">保存设置</button>
        </form>
        <p style="font-size:.82rem;color:var(--text-sub);margin-top:8px">默认已配置 DeepSeek（api.deepseek.com）。也可换成 OpenAI 兼容接口。</p>
      </div>

      <div class="card">
        <h3>🗑️ 数据管理</h3>
        <p style="color:var(--text-sub);font-size:.9rem">清空本地保存的学习进度、错题本和成绩记录。</p>
        <button class="btn danger" id="resetBtn">清空所有数据</button>
      </div>
    `;

    document.getElementById("settingsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      App.store.setSettings({
        aiEnabled: document.getElementById("sAi").checked,
        apiBase: document.getElementById("sBase").value.trim() || "https://api.deepseek.com",
        apiModel: document.getElementById("sModel").value.trim() || "deepseek-chat",
        apiKey: document.getElementById("sKey").value.trim()
      });
      alert("设置已保存");
      App.renderRoute();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      if (confirm("确定要清空所有本地学习数据吗？此操作不可恢复。")) {
        App.store.resetAll();
        App.renderRoute();
      }
    });
  }

  // 注册路由
  App.route(/^\/$/, (m) => renderHome(document.getElementById("app")));

  App.route(/^\/course$/, () => App.course.renderList(document.getElementById("app")));
  App.route(/^\/course\/([a-z]+)$/, (m) => App.course.renderDetail(document.getElementById("app"), m[1]));

  App.route(/^\/quiz$/, () => App.quiz.renderPicker(document.getElementById("app")));
  App.route(/^\/quiz\/wrong$/, () => App.quiz.renderWrongBook(document.getElementById("app")));
  App.route(/^\/quiz\/([a-z]+)$/, (m) => App.quiz.renderPractice(document.getElementById("app"), m[1]));

  App.route(/^\/exam$/, () => App.exam.renderSetup(document.getElementById("app")));

  App.route(/^\/practice$/, () => App.practice.renderList(document.getElementById("app")));
  App.route(/^\/practice\/([a-z0-9]+)$/, (m) => App.practice.renderDetail(document.getElementById("app"), m[1]));

  App.route(/^\/interview$/, () => App.practice.renderInterviewList(document.getElementById("app")));
  App.route(/^\/interview\/([a-z0-9]+)$/, (m) => App.practice.renderInterviewDetail(document.getElementById("app"), m[1]));

  App.route(/^\/stats$/, () => App.stats.render(document.getElementById("app")));
  App.route(/^\/chat$/, () => App.chat.render(document.getElementById("app")));
  App.route(/^\/settings$/, () => renderSettings(document.getElementById("app")));
  App.route(/^\/login$/, () => App.auth.renderLogin(document.getElementById("app")));

  // 初始化导航
  function initNav() {
    const navItems = [
      ["#/", "首页"],
      ["#/course", "课程"],
      ["#/quiz", "刷题"],
      ["#/exam", "模拟考"],
      ["#/practice", "实操"],
      ["#/interview", "面试"],
      ["#/stats", "统计"],
      ["#/chat", "答疑"],
      ["#/settings", "设置"]
    ];
    const nav = document.getElementById("nav");
    nav.innerHTML = navItems
      .map(([h, t]) => `<a href="${h}">${t}</a>`)
      .join("") + `<a href="#/login" id="navAccount">登录</a>`;
    document.getElementById("navToggle").addEventListener("click", () => {
      nav.classList.toggle("open");
    });
    updateAccountUI();
  }

  // 刷新登录状态显示（导航账号入口 + 首页提示）
  function updateAccountUI() {
    const el = document.getElementById("navAccount");
    if (el) el.textContent = App.auth.isLoggedIn() ? "账号" : "登录";
    const st = document.getElementById("homeSync");
    if (st) {
      st.textContent = App.auth.isLoggedIn()
        ? "已登录 " + App.auth.phoneMask() + " · 进度自动云同步"
        : "登录后可云同步进度与错题本";
    }
  }

  initNav();
  App.renderRoute();
  // 恢复登录会话并刷新账号状态
  App.auth.init().then(() => updateAccountUI()).catch(() => {});
})();
