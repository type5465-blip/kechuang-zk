/* ===== 模拟考试：计时 + 随机组卷 + 自动评分 + 成绩报告 ===== */
(function () {
  const App = (window.App = window.App || {});
  App.exam = {};

  let state = null; // 当前考试状态
  let timerId = null;

  App.exam.stopTimer = function () {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  App.exam.renderSetup = function (container) {
    container.innerHTML = `
      <h1>模拟考试</h1>
      <p style="color:var(--text-sub)">模拟深圳科创自招笔试：随机组卷、限时作答、交卷自动评分。</p>
      <div class="card">
        <form id="examForm">
          <div style="margin-bottom:16px">
            <label style="font-weight:600">考试范围</label>
            <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap" id="scopeBox"></div>
          </div>
          <div style="margin-bottom:16px">
            <label style="font-weight:600">题目数量</label>
            <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap" id="countBox"></div>
          </div>
          <div style="margin-bottom:16px">
            <label style="font-weight:600">考试时长</label>
            <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap" id="timeBox"></div>
          </div>
          <button class="btn block" type="submit">开始考试</button>
        </form>
      </div>
      <div class="card">
        <h3>📋 历史成绩</h3>
        <div id="examHistory"></div>
      </div>
    `;

    const scopeBox = document.getElementById("scopeBox");
    const scopeOpts = [{ v: "all", t: "全部模块" }].concat(
      App.MANIFEST.modules.map((m) => ({ v: m.id, t: m.title }))
    );
    scopeOpts.forEach((o, i) => {
      scopeBox.innerHTML +=
        `<label class="tag" style="cursor:pointer"><input type="radio" name="scope" value="${o.v}" ${i === 0 ? "checked" : ""}> ${App.esc(o.t)}</label>`;
    });

    const countBox = document.getElementById("countBox");
    [10, 20, 30].forEach((c, i) => {
      countBox.innerHTML +=
        `<label class="tag" style="cursor:pointer"><input type="radio" name="count" value="${c}" ${i === 1 ? "checked" : ""}> ${c} 题</label>`;
    });

    const timeBox = document.getElementById("timeBox");
    [30, 60, 80, 120].forEach((t, i) => {
      timeBox.innerHTML +=
        `<label class="tag" style="cursor:pointer"><input type="radio" name="time" value="${t}" ${i === 2 ? "checked" : ""}> ${t} 分钟</label>`;
    });

    document.getElementById("examForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const scope = document.querySelector('input[name="scope"]:checked').value;
      const count = Number(document.querySelector('input[name="count"]:checked').value);
      const time = Number(document.querySelector('input[name="time"]:checked').value);
      App.exam.start(scope, count, time);
    });

    App.exam.renderHistory(document.getElementById("examHistory"));
  };

  App.exam.renderHistory = function (el) {
    const records = App.store.getExamRecords();
    if (!records.length) {
      el.innerHTML = '<div class="empty" style="padding:16px">暂无记录</div>';
      return;
    }
    const recent = records.slice().reverse().slice(0, 10);
    el.innerHTML = recent
      .map(
        (r) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:.9rem">
          <span>${App.esc(r.dateStr)} · ${App.esc(r.scopeLabel)}</span>
          <span><b style="color:${r.score >= 60 ? "var(--success)" : "var(--danger)"}">${r.score} 分</b>（${r.correct}/${r.total} 对）</span>
        </div>`
      )
      .join("");
  };

  App.exam.start = async function (scope, count, timeMin) {
    const container = document.getElementById("app");
    container.innerHTML = '<div class="loading">正在组卷…</div>';

    // 收集题目
    let pool = [];
    const modules = App.MANIFEST.modules.filter((m) => scope === "all" || m.id === scope);
    const scopeLabel = scope === "all" ? "全部模块" : (App.moduleById(scope)?.title || scope);
    for (const m of modules) {
      try {
        const data = await App.fetchJSON(m.quiz);
        (data.questions || []).forEach((q) => {
          pool.push(App.quiz.normalize(q, m.id));
        });
      } catch (e) { /* 忽略 */ }
    }
    if (!pool.length) {
      container.innerHTML = '<div class="empty">没有可用题目</div>';
      return;
    }
    const questions = App.shuffle(pool).slice(0, count);

    // 组卷期间若用户已离开考试页，则不再渲染
    if (location.hash !== "#/exam") return;

    state = {
      questions,
      scopeLabel,
      total: questions.length,
      timeMin,
      deadline: Date.now() + timeMin * 60 * 1000,
      startedAt: Date.now()
    };

    App.exam.renderRun(container);
  };

  App.exam.renderRun = function (container) {
    const { questions, scopeLabel, total, timeMin } = state;
    const letters = ["A", "B", "C", "D", "E", "F"];

    let qHtml = questions
      .map((q, qi) => {
        let inputHtml = "";
        if (q.type === "single" || q.type === "judge") {
          const options = q.type === "judge" ? ["正确", "错误"] : q.options;
          inputHtml = options
            .map(
              (o, i) => `
              <label class="option">
                <input type="radio" name="eq_${qi}" value="${i}">
                <span class="txt"><b>${letters[i]}.</b> ${App.esc(o)}</span>
              </label>`
            )
            .join("");
        } else {
          inputHtml = `<input class="blank-input" name="eq_${qi}" placeholder="请输入答案…">`;
        }
        return `
          <div class="card" style="padding:16px">
            <div style="margin-bottom:8px">
              <span class="tag">${qi + 1}</span>
              <span class="tag green" style="margin-left:4px">${App.moduleById(q.moduleId)?.title || ""}</span>
            </div>
            <div class="quiz-question" style="font-size:.98rem">${App.esc(q.stem)}</div>
            <div class="quiz-options">${inputHtml}</div>
          </div>`;
      })
      .join("");

    container.innerHTML = `
      <div class="exam-top">
        <div>⏱️ 剩余时间：<span class="timer" id="timer">--:--</span></div>
        <div style="color:var(--text-sub)">共 ${total} 题 · ${App.esc(scopeLabel)}</div>
        <div style="flex:1"></div>
        <button class="btn success" id="submitExam">交卷</button>
      </div>
      ${qHtml}
    `;

    const timerEl = document.getElementById("timer");
    const tick = () => {
      const left = state.deadline - Date.now();
      if (left <= 0) {
        App.exam.stopTimer();
        timerEl.textContent = "00:00";
        App.exam.grade();
        return;
      }
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      if (left < 5 * 60 * 1000) timerEl.classList.add("warn");
    };
    tick();
    timerId = setInterval(tick, 1000);

    document.getElementById("submitExam").addEventListener("click", () => {
      if (confirm("确定要交卷吗？交卷后将自动评分。")) {
        App.exam.stopTimer();
        App.exam.grade();
      }
    });
  };

  App.exam.grade = function () {
    const { questions, scopeLabel, total, startedAt } = state;
    const durationSec = Math.round((Date.now() - startedAt) / 1000);

    let correct = 0;
    const detail = [];
    questions.forEach((q, qi) => {
      let user;
      if (q.type === "single" || q.type === "judge") {
        const sel = document.querySelector(`input[name="eq_${qi}"]:checked`);
        user = sel ? (q.type === "judge" ? sel.value === "0" : Number(sel.value)) : undefined;
      } else {
        const inp = document.querySelector(`input[name="eq_${qi}"]`);
        user = inp && inp.value.trim() ? inp.value.trim() : undefined;
      }
      const ok = App.quiz.isCorrect(q, user);
      if (ok) correct++;
      let userLabel;
      if (user === undefined) userLabel = "未作答";
      else if (q.type === "single") userLabel = q.options[user] != null ? q.options[user] : String(user);
      else if (q.type === "judge") userLabel = user ? "正确" : "错误";
      else userLabel = String(user);
      detail.push({
        qid: q.id,
        moduleId: q.moduleId,
        correct: ok,
        userLabel,
        stem: q.stem,
        analysis: q.analysis,
        answer: App.quiz.answerLabel(q)
      });
    });

    const score = Math.round((correct / total) * 100);
    const rec = {
      id: App.uid(),
      date: Date.now(),
      dateStr: App.fmtDate(Date.now()),
      scopeLabel,
      score,
      correct,
      total,
      durationSec
    };
    App.store.addExamRecord(rec);

    const container = document.getElementById("app");
    container.innerHTML = `
      <h1>考试成绩 📊</h1>
      <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        <div class="card stat-card"><div class="stat-num" style="color:${score >= 60 ? "var(--success)" : "var(--danger)"}">${score}</div><div class="stat-label">总分（满分100）</div></div>
        <div class="card stat-card"><div class="stat-num">${correct} / ${total}</div><div class="stat-label">答对 / 总题数</div></div>
        <div class="card stat-card"><div class="stat-num">${App.fmtDuration(durationSec)}</div><div class="stat-label">用时</div></div>
      </div>
      ${App.auth && App.auth.isLoggedIn() ? "" : `<p style="color:var(--text-sub);font-size:.9rem;margin-top:12px">💡 登录后才会保存成绩记录，<a href="#/login">去登录</a></p>`}
      <div class="card" style="margin-top:14px">
        <h3>错题回顾</h3>
        ${detail
          .filter((d) => !d.correct)
          .map(
            (d, i) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="font-weight:600">${i + 1}. ${App.esc(d.stem)}</div>
              <div style="font-size:.86rem;color:var(--danger);margin-top:4px">你的答案：${App.esc(d.userLabel)}</div>
              <div style="font-size:.86rem;color:var(--success)">正确答案：${App.esc(d.answer)}</div>
              ${d.analysis ? '<div style="font-size:.86rem;color:var(--text-sub);margin-top:4px">📖 ' + App.esc(d.analysis) + "</div>" : ""}
            </div>`
          )
          .join("") || '<div class="empty" style="padding:10px">全部答对，太棒了！🎉</div>'}
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="#/exam">再考一次</a>
        <a class="btn secondary" href="#/stats">查看统计</a>
        <a class="btn secondary" href="#/">返回首页</a>
      </div>
    `;
    state = null;
  };
})();
