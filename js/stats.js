/* ===== 学习进度统计 + 学习时长计时 ===== */
(function () {
  const App = (window.App = window.App || {});
  App.stats = {};

  let tickId = null;
  let tickModule = null;
  let lastTick = 0;

  App.stats.startTick = function (moduleId) {
    App.stats.stopTick();
    tickModule = moduleId;
    lastTick = Date.now();
    tickId = setInterval(() => {
      const now = Date.now();
      const dt = Math.round((now - lastTick) / 1000);
      lastTick = now;
      if (dt > 0 && tickModule) App.store.addStudyTime(tickModule, dt);
    }, 5000);
  };

  App.stats.stopTick = function () {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
    tickModule = null;
  };

  // 计算某模块统计 { answered, correct, rate }
  function moduleStats(moduleId) {
    const hist = App.store.get().quizHistory[moduleId] || {};
    const entries = Object.values(hist);
    const answered = entries.length;
    const correct = entries.filter((e) => e.correct).length;
    return { answered, correct, rate: answered ? Math.round((correct / answered) * 100) : null };
  }

  App.stats.render = function (container) {
    const s = App.store.get();
    const mods = App.MANIFEST.modules;

    let totalAnswered = 0,
      totalCorrect = 0,
      totalWrong = 0,
      totalTime = 0;
    const perModule = [];

    mods.forEach((m) => {
      const ms = moduleStats(m.id);
      totalAnswered += ms.answered;
      totalCorrect += ms.correct;
      const done = s.courseProgress[m.id]?.completed ? 1 : 0;
      // 掌握度 = 课程完成 50% + 正确率 50%
      const mastery = Math.round(done * 50 + (ms.rate === null ? 0 : ms.rate * 0.5));
      totalTime += s.studyTime[m.id] || 0;
      totalWrong += (s.wrongBook[m.id] || []).length;
      perModule.push({ m, ms, done, mastery });
    });

    const overallRate = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;
    const exams = s.examRecords;

    let html = `
      <h1>学习进度统计</h1>

      <div class="stat-grid">
        <div class="card stat-card"><div class="stat-num">${App.fmtDuration(totalTime)}</div><div class="stat-label">累计学习时长</div></div>
        <div class="card stat-card"><div class="stat-num">${totalAnswered}</div><div class="stat-label">累计做题数</div></div>
        <div class="card stat-card"><div class="stat-num" style="color:${overallRate === null ? "var(--text-sub)" : "var(--primary)"}">${overallRate === null ? "—" : overallRate + "%"}</div><div class="stat-label">总正确率</div></div>
        <div class="card stat-card"><div class="stat-num" style="color:var(--danger)">${totalWrong}</div><div class="stat-label">待复习错题</div></div>
        <div class="card stat-card"><div class="stat-num">${exams.length}</div><div class="stat-label">模拟考次数</div></div>
      </div>

      <div class="section-title"><h2>各模块掌握度</h2></div>
      <div class="card">
        ${perModule
          .map(
            (p) => `
          <div class="bar-row">
            <div class="name">${p.m.icon} ${App.esc(p.m.title)}</div>
            <div class="bar"><span style="width:${p.mastery}%"></span></div>
            <div class="val">${p.mastery}%</div>
          </div>`
          )
          .join("")}
        <p style="font-size:.82rem;color:var(--text-sub);margin-top:8px">掌握度 = 课程完成(50%) + 做题正确率(50%)</p>
      </div>

      <div class="section-title"><h2>做题正确率（分模块）</h2></div>
      <div class="card">
        ${perModule
          .map((p) => {
            const rate = p.ms.rate;
            return `
            <div class="bar-row">
              <div class="name">${p.m.icon} ${App.esc(p.m.title)}</div>
              <div class="bar"><span style="width:${rate === null ? 0 : rate}%;background:linear-gradient(90deg,var(--success),#4ade80)"></span></div>
              <div class="val">${rate === null ? "未做" : rate + "%"}</div>
            </div>`;
          })
          .join("")}
      </div>

      <div class="section-title"><h2>模拟考成绩</h2></div>
      <div class="card">
        ${
          exams.length
            ? exams
                .slice()
                .reverse()
                .slice(0, 12)
                .map(
                  (r) => `
              <div class="bar-row">
                <div class="name" style="width:170px">${App.esc(r.dateStr)}</div>
                <div class="bar"><span style="width:${r.score}%;background:linear-gradient(90deg,var(--accent),#fbbf24)"></span></div>
                <div class="val">${r.score}</div>
              </div>`
                )
                .join("")
            : '<div class="empty" style="padding:10px">还没考过，去 <a href="#/exam">模拟考试</a> 试试吧</div>'
        }
      </div>
    `;

    container.innerHTML = html;
  };
})();
