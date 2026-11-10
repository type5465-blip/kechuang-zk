/* ===== 题库练习：分模块刷题 + 即时判分 + 错题本 ===== */
(function () {
  const App = (window.App = window.App || {});
  App.quiz = {};

  App.quiz.renderPicker = function (container) {
    container.innerHTML = `
      <h1>题库练习</h1>
      <p style="color:var(--text-sub)">选择模块开始刷题，做错的题会自动进入错题本。</p>
      <div style="margin-bottom:14px">
        <a class="btn secondary" href="#/quiz/wrong">📕 错题本</a>
      </div>
      <div class="list" id="quizList"></div>
    `;
    const list = document.getElementById("quizList");
    App.MANIFEST.modules.forEach((m) => {
      const total = (App.store.get().quizHistory[m.id] || {});
      const doneCount = Object.keys(total).length;
      const div = document.createElement("a");
      div.className = "list-item";
      div.href = "#/quiz/" + m.id;
      div.innerHTML = `
        <div class="li-icon">${m.icon}</div>
        <div class="li-body">
          <div class="li-title">${App.esc(m.title)}</div>
          <div class="li-desc">已作答 ${doneCount} 题 · ${App.esc(m.desc)}</div>
        </div>
        <div class="li-arrow">→</div>
      `;
      list.appendChild(div);
    });
  };

  // 归一化题目，返回 { id, type, stem, options, answerText, accept, analysis, moduleId }
  function normalize(q, moduleId) {
    const out = {
      id: q.id,
      type: q.type || "single",
      stem: q.stem || "",
      analysis: q.analysis || "",
      moduleId,
      options: q.options || [],
      answer: q.answer,
      accept: q.accept || null
    };
    return out;
  }

  function isCorrect(q, userAnswer) {
    if (q.type === "single") return userAnswer === q.answer;
    if (q.type === "judge") return userAnswer === q.answer;
    if (q.type === "blank") {
      const u = String(userAnswer || "").trim().toLowerCase().replace(/\s+/g, "");
      const accepted = q.accept
        ? q.accept.map((a) => String(a).toLowerCase().replace(/\s+/g, ""))
        : [String(q.answer || "").toLowerCase().replace(/\s+/g, "")];
      return accepted.includes(u);
    }
    return false;
  }

  function answerLabel(q) {
    if (q.type === "single") return q.options[q.answer] || String(q.answer);
    if (q.type === "judge") return q.answer ? "正确" : "错误";
    if (q.type === "blank") return Array.isArray(q.answer) ? q.answer.join(" / ") : q.answer;
    return "";
  }

  // 渲染单题（供练习 / 错题本复用）
  App.quiz.renderQuestion = function (container, q, opts) {
    opts = opts || {};
    const onSubmit = opts.onSubmit; // (correct, userAnswer) => void

    let body = "";
    if (q.type === "single" || q.type === "judge") {
      const options =
        q.type === "judge"
          ? ["正确", "错误"]
          : q.options;
      const letters = ["A", "B", "C", "D", "E", "F"];
      body = '<div class="quiz-options" id="qOpts">' +
        options.map((o, i) =>
          `<label class="option" data-i="${i}">
             <input type="radio" name="q" value="${i}">
             <span class="txt"><b>${letters[i]}.</b> ${App.esc(o)}</span>
           </label>`
        ).join("") +
        "</div>" +
        '<button class="btn" id="qSubmit" style="margin-top:14px" disabled>确认答案</button>';
    } else {
      body =
        '<input class="blank-input" id="qBlank" placeholder="请输入答案…">' +
        '<button class="btn" id="qSubmit" style="margin-top:14px" disabled>确认答案</button>';
    }

    const typeLabel =
      q.type === "single" ? "单选题" : q.type === "judge" ? "判断题" : "填空题";
    container.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <span class="tag">${typeLabel}</span>
          <span class="tag green">${App.moduleById(q.moduleId)?.title || ""}</span>
        </div>
        <div class="quiz-question">${App.esc(q.stem)}</div>
        ${body}
        <div id="qFeedback"></div>
      </div>
    `;

    const submitBtn = document.getElementById("qSubmit");
    const feedback = document.getElementById("qFeedback");

    function readAnswer() {
      if (q.type === "single" || q.type === "judge") {
        const sel = container.querySelector('input[name="q"]:checked');
        if (!sel) return undefined;
        return q.type === "judge" ? sel.value === "0" : Number(sel.value);
      }
      const inp = document.getElementById("qBlank");
      return inp && inp.value.trim() ? inp.value.trim() : undefined;
    }

    function updateSubmitState() {
      submitBtn.disabled = readAnswer() === undefined;
    }

    if (q.type === "single" || q.type === "judge") {
      container.querySelectorAll('input[name="q"]').forEach((r) =>
        r.addEventListener("change", updateSubmitState)
      );
    } else {
      const blank = document.getElementById("qBlank");
      blank.addEventListener("input", updateSubmitState);
      blank.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !submitBtn.disabled) submitBtn.click();
      });
    }

    submitBtn.addEventListener("click", () => {
      const user = readAnswer();
      if (user === undefined) return;
      const correct = isCorrect(q, user);
      // 高亮选项
      if (q.type === "single" || q.type === "judge") {
        const correctIdx = q.type === "single" ? q.answer : (q.answer ? 0 : 1);
        const userIdx = q.type === "single" ? user : (user ? 0 : 1);
        container.querySelectorAll(".option").forEach((opt) => {
          const i = Number(opt.getAttribute("data-i"));
          opt.classList.add("disabled");
          if (i === correctIdx) opt.classList.add("correct");
          if (i === userIdx && i !== correctIdx) opt.classList.add("wrong");
        });
      }
      submitBtn.disabled = true;
      feedback.innerHTML =
        `<div class="feedback ${correct ? "ok" : "no"}">
           <b>${correct ? "✓ 回答正确" : "✗ 回答错误"}</b>
           ${!correct ? '<div style="margin-top:4px">正确答案：<b>' + App.esc(answerLabel(q)) + "</b></div>" : ""}
           ${q.analysis ? '<div class="analysis">📖 解析：' + App.esc(q.analysis) + "</div>" : ""}
         </div>`;
      if (onSubmit) onSubmit(correct, user);
    });
  };

  App.quiz.renderPractice = async function (container, moduleId) {
    const m = App.moduleById(moduleId);
    if (!m) {
      container.innerHTML = '<div class="empty">未找到该模块</div>';
      return;
    }
    try {
      const data = await App.fetchJSON(m.quiz);
      const qs = (data.questions || []).map((q) => normalize(q, moduleId));
      if (!qs.length) {
        container.innerHTML = '<div class="empty">该模块暂无题目</div>';
        return;
      }
      const order = App.shuffle(qs);
      let idx = 0;
      let correctCount = 0;
      let answered = 0;

      const renderOne = () => {
        container.innerHTML =
          `<a class="back-link" href="#/quiz">← 返回题库</a>
           <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
             <h1 style="margin:0">${m.icon} ${App.esc(m.title)}</h1>
             <span class="tag">第 ${idx + 1} / ${order.length} 题</span>
           </div>
           <div class="progress" style="margin-bottom:14px"><span style="width:${((idx) / order.length) * 100}%"></span></div>`;
        const box = document.createElement("div");
        container.appendChild(box);
        App.quiz.renderQuestion(box, order[idx], {
          onSubmit(correct) {
            answered++;
            if (correct) correctCount++;
            App.store.recordAnswer(moduleId, order[idx].id, correct);
            setTimeout(() => {
              idx++;
              if (idx < order.length) {
                renderOne();
              } else {
                showSummary();
              }
            }, 900);
          }
        });
      };

      const showSummary = () => {
        const wrongs = App.store.getWrongList(moduleId);
        container.innerHTML =
          `<h1>练习完成 🎉</h1>
           <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
             <div class="card stat-card"><div class="stat-num">${answered}</div><div class="stat-label">作答题数</div></div>
             <div class="card stat-card"><div class="stat-num" style="color:var(--success)">${correctCount}</div><div class="stat-label">答对</div></div>
             <div class="card stat-card"><div class="stat-num" style="color:var(--danger)">${answered - correctCount}</div><div class="stat-label">答错（已入错题本）</div></div>
             <div class="card stat-card"><div class="stat-num">${answered ? Math.round(correctCount / answered * 100) : 0}%</div><div class="stat-label">正确率</div></div>
           </div>
           <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
             <a class="btn" href="#/quiz/${moduleId}">再来一轮</a>
             <a class="btn secondary" href="#/quiz/wrong">查看错题本</a>
             <a class="btn secondary" href="#/course/${moduleId}">回顾课程</a>
           </div>`;
      };

      renderOne();
    } catch (err) {
      container.innerHTML =
        '<div class="empty">题库加载失败：' + App.esc(err.message || err) + "</div>";
    }
  };

  App.quiz.renderWrongBook = async function (container) {
    const wrong = App.store.getWrongBook();
    // 收集所有错题 { moduleId, question }
    const mods = App.MANIFEST.modules;
    const list = [];
    for (const m of mods) {
      const ids = wrong[m.id] || [];
      if (!ids.length) continue;
      try {
        const data = await App.fetchJSON(m.quiz);
        const map = {};
        (data.questions || []).forEach((q) => (map[q.id] = q));
        ids.forEach((id) => {
          if (map[id]) list.push({ moduleId: m.id, q: normalize(map[id], m.id) });
        });
      } catch (e) { /* 忽略单个模块加载失败 */ }
    }

    if (!list.length) {
      container.innerHTML = `
        <a class="back-link" href="#/quiz">← 返回题库</a>
        <h1>错题本</h1>
        <div class="empty">暂无错题，去刷题吧 💪</div>`;
      return;
    }

    let idx = 0;
    const renderOne = () => {
      const item = list[idx];
      container.innerHTML =
        `<a class="back-link" href="#/quiz">← 返回题库</a>
         <h1>📕 错题本（共 ${list.length} 题）</h1>
         <div class="progress" style="margin-bottom:14px"><span style="width:${idx / list.length * 100}%"></span></div>`;
      const box = document.createElement("div");
      container.appendChild(box);
      App.quiz.renderQuestion(box, item.q, {
        onSubmit(correct) {
          if (correct) App.store.removeWrong(item.moduleId, item.q.id);
          setTimeout(() => {
            idx++;
            if (idx < list.length) renderOne();
            else {
              container.innerHTML =
                `<h1>错题本已清空 🎉</h1><div class="empty">全部错题已复习完！</div>
                 <a class="btn" href="#/quiz">继续刷题</a>`;
            }
          }, 900);
        }
      });
    };
    renderOne();
  };

  // 暴露给模拟考等模块复用
  App.quiz.normalize = normalize;
  App.quiz.isCorrect = isCorrect;
  App.quiz.answerLabel = answerLabel;
})();
