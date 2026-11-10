/* ===== AI 智能答疑：内容检索（默认） + 可选真·AI（老师自配 Key） ===== */
(function () {
  const App = (window.App = window.App || {});
  App.chat = {};

  const SYSTEM_PROMPT =
    "你是深圳中考科创类自主招生（硬件方向）的备考助教。请用通俗易懂的中文，面向初中生解答电路、传感器、单片机/Arduino、机器人机械结构、数理基础等问题，可给出要点、举例和易错点，控制在 300 字以内。";

  let indexPromise = null;

  // 构建检索索引：FAQ + 各模块题库
  function buildIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
      const items = [];
      // FAQ
      try {
        const faq = await App.fetchJSON(App.MANIFEST.faq);
        (faq.entries || []).forEach((e) => {
          items.push({
            kind: "faq",
            text: (e.keywords || []).join(" ") + " " + e.q + " " + e.a,
            render: () => "**" + e.q + "**\n\n" + e.a
          });
        });
      } catch (e) { /* ignore */ }
      // 题库
      for (const m of App.MANIFEST.modules) {
        try {
          const data = await App.fetchJSON(m.quiz);
          (data.questions || []).forEach((q) => {
            items.push({
              kind: "quiz",
              text: m.title + " " + (q.stem || "") + " " + (q.analysis || "") + " " + (q.keywords || []).join(" "),
              render: () => {
                const ans = q.type === "judge" ? (q.answer ? "正确" : "错误") : q.type === "single" ? (q.options[q.answer] || q.answer) : q.answer;
                return "**相关题目**：" + q.stem + "\n\n**参考答案**：" + ans + (q.analysis ? "\n\n**解析**：" + q.analysis : "");
              }
            });
          });
        } catch (e) { /* ignore */ }
      }
      return items;
    })();
    return indexPromise;
  }

  function tokenize(s) {
    const tokens = new Set();
    const t = String(s).trim();
    if (!t) return [];
    tokens.add(t);
    t.split(/[\s,，。！？、；;：:()（）/]+/).forEach((x) => { if (x) tokens.add(x); });
    for (let i = 0; i < t.length - 1; i++) tokens.add(t.slice(i, i + 2));
    return Array.from(tokens);
  }

  function scoreItem(text, tokens) {
    const lower = String(text).toLowerCase();
    let sc = 0;
    for (const tok of tokens) {
      const tl = tok.toLowerCase();
      if (tl.length >= 2 && lower.includes(tl)) sc += 3;
      else if (tl.length === 1 && lower.includes(tl)) sc += 0.5;
    }
    return sc;
  }

  function search(query) {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    return buildIndex().then((items) => {
      return items
        .map((it) => ({ it, score: scoreItem(it.text, tokens) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    });
  }

  // 真·AI 调用
  async function callRealAI(query) {
    const s = App.store.getSettings();
    const url = s.apiBase.replace(/\/+$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + s.apiKey
      },
      body: JSON.stringify({
        model: s.apiModel || "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query }
        ],
        temperature: 0.5,
        stream: false
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error("AI 接口返回 " + res.status + ": " + txt.slice(0, 200));
    }
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
    if (!content) throw new Error("AI 返回为空");
    return content;
  }

  App.chat.render = function (container) {
    const settings = App.store.getSettings();
    const mode = settings.aiEnabled && settings.apiKey ? "AI" : "检索";
    container.innerHTML = `
      <h1>🤖 智能答疑</h1>
      <p style="color:var(--text-sub)">当前模式：<span class="tag ${mode === "AI" ? "green" : ""}">${mode === "AI" ? "真·AI 对话" : "内容检索"}</span>
        ${mode !== "AI" ? '<a href="#/settings" style="margin-left:8px">配置真 AI →</a>' : ""}
      </p>
      <div class="card">
        <div class="chat-box" id="chatLog"></div>
        <div class="chat-input-row">
          <input id="chatInput" placeholder="例如：什么是上拉电阻？机器人避障用哪个传感器？">
          <button class="btn" id="chatSend">发送</button>
        </div>
        <div class="chat-hint">提示：默认用课程内容检索答疑；在「设置」里填入 API Key 后可切换为真·AI 对话。</div>
      </div>
    `;

    const log = document.getElementById("chatLog");
    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");

    function addMsg(role, markdown) {
      const div = document.createElement("div");
      div.className = "chat-msg " + role;
      div.innerHTML = '<div class="markdown">' + App.md(markdown) + "</div>";
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    }

    addMsg("ai", "你好！我是硬件方向备考助教，可以问我电路、传感器、单片机、机器人结构或数理问题 🙂");

    async function handleSend() {
      const q = input.value.trim();
      if (!q) return;
      input.value = "";
      addMsg("user", q);
      const thinking = addMsg("ai", "_正在思考…_");

      const settings2 = App.store.getSettings();
      try {
        let reply;
        if (settings2.aiEnabled && settings2.apiKey) {
          reply = await callRealAI(q);
        } else {
          const hits = await search(q);
          if (!hits.length) {
            reply = "暂时没有检索到相关内容。可以换个说法，或到「设置」开启真·AI 对话获得更完整的解答。";
          } else {
            reply = hits.map((h, i) => "### " + (i + 1) + ".\n" + h.it.render()).join("\n\n---\n\n") +
              "\n\n> 以上来自课程内容检索，仅供参考。";
          }
        }
        thinking.innerHTML = '<div class="markdown">' + App.md(reply) + "</div>";
      } catch (err) {
        thinking.innerHTML =
          '<div class="markdown" style="color:var(--danger)">答疑出错：' + App.esc(err.message || err) +
          "。请检查「设置」中的 API 配置是否正确。</div>";
      }
      log.scrollTop = log.scrollHeight;
    }

    send.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
  };
})();
