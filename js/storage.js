/* ===== localStorage 封装：进度 / 错题 / 成绩 / 设置 / 学习时长 ===== */
(function () {
  const App = (window.App = window.App || {});
  const KEY = "hwkz.storage.v1";

  const defaults = {
    courseProgress: {},     // { moduleId: { completed: true, ts: number } }
    quizHistory: {},        // { moduleId: { [qid]: { correct: bool, ts } } }
    wrongBook: {},          // { moduleId: [qid, ...] }
    examRecords: [],        // [{ id, date, scope, score, total, correct, durationSec, detail:[{qid,moduleId,correct,userAnswer,answer}] }]
    studyTime: {},          // { [moduleId]: seconds }
    avatar: "",             // 头像 base64（登录后云端同步）
    settings: {             // AI 配置（仅存本地，不硬编码）
      aiEnabled: false,
      apiBase: "https://api.deepseek.com",
      apiModel: "deepseek-chat",
      apiKey: ""
    }
  };

  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? Object.assign({}, defaults, JSON.parse(raw)) : JSON.parse(JSON.stringify(defaults));
      // 深合并 settings 缺省
      cache.settings = Object.assign({}, defaults.settings, cache.settings || {});
    } catch (e) {
      cache = JSON.parse(JSON.stringify(defaults));
    }
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn("localStorage 写入失败", e);
    }
    scheduleCloudPush();
  }

  // 已登录时，防抖把最新进度推送到云端
  let pushTimer = null;
  function scheduleCloudPush() {
    if (!App.auth || !App.auth.uid()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      App.sync.pushCloud().catch((e) => console.warn("云端同步失败", e));
    }, 800);
  }

  // 进度数据只在登录后写入本地（未登录不缓存）
  function canWrite() {
    return !!(App.auth && App.auth.isLoggedIn());
  }

  App.store = {
    get() { return load(); },

    // 课程进度
    setCourseDone(moduleId, done) {
      if (!canWrite()) return;
      const s = load();
      if (done) s.courseProgress[moduleId] = { completed: true, ts: Date.now() };
      else delete s.courseProgress[moduleId];
      save();
    },
    isCourseDone(moduleId) {
      return !!(load().courseProgress[moduleId] && load().courseProgress[moduleId].completed);
    },

    // 做题记录 + 错题本（仅登录后记录，未登录不缓存进度）
    recordAnswer(moduleId, qid, correct) {
      if (!canWrite()) return;
      const s = load();
      s.quizHistory[moduleId] = s.quizHistory[moduleId] || {};
      s.quizHistory[moduleId][qid] = { correct, ts: Date.now() };

      s.wrongBook[moduleId] = s.wrongBook[moduleId] || [];
      const arr = s.wrongBook[moduleId];
      const idx = arr.indexOf(qid);
      if (correct && idx >= 0) arr.splice(idx, 1);
      if (!correct && idx < 0) arr.push(qid);
      save();
    },
    getWrongBook() {
      const s = load();
      return JSON.parse(JSON.stringify(s.wrongBook));
    },
    getWrongList(moduleId) {
      return load().wrongBook[moduleId] || [];
    },
    removeWrong(moduleId, qid) {
      if (!canWrite()) return;
      const s = load();
      const arr = s.wrongBook[moduleId] || [];
      const idx = arr.indexOf(qid);
      if (idx >= 0) arr.splice(idx, 1);
      save();
    },

    // 模拟考
    addExamRecord(rec) {
      if (!canWrite()) return;
      const s = load();
      s.examRecords.push(rec);
      save();
    },
    getExamRecords() {
      return load().examRecords.slice();
    },

    // 学习时长（按模块累加秒）
    addStudyTime(moduleId, seconds) {
      if (!canWrite()) return;
      const s = load();
      s.studyTime[moduleId] = (s.studyTime[moduleId] || 0) + seconds;
      save();
    },
    getStudyTime() {
      return Object.assign({}, load().studyTime);
    },

    // 头像（base64，登录后云端同步）
    getAvatar() {
      return load().avatar || "";
    },
    setAvatar(base64) {
      if (!canWrite()) return;
      const s = load();
      s.avatar = base64 || "";
      save();
    },

    // 设置
    getSettings() {
      return Object.assign({}, load().settings);
    },
    setSettings(patch) {
      const s = load();
      s.settings = Object.assign({}, s.settings, patch);
      save();
    },

    resetAll() {
      cache = JSON.parse(JSON.stringify(defaults));
      save();
    },

    // 首次欢迎页标记（纯本机浏览器状态，登出/清数据不重置，不同步云端）
    isWelcomed() {
      return localStorage.getItem("hwkz.welcomed") === "1";
    },
    markWelcomed() {
      try { localStorage.setItem("hwkz.welcomed", "1"); } catch (e) { /* ignore */ }
    },

    // 退出登录时清空本地进度缓存（保留 settings，如 AI Key）
    clearProgress() {
      const keepSettings = load().settings;
      cache = Object.assign({}, JSON.parse(JSON.stringify(defaults)), { settings: keepSettings });
      try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
    }
  };

  // 云端同步：与 CloudBase 云数据库双向同步（进度字段，不含 settings）
  // 归一化 RDB 查询返回：兼容 {data:[...]} / 直接数组 / 单行对象 / {data:{...}}
  function rowsOf(res) {
    if (!res) return [];
    if (res.error) throw new Error(res.error.message || "查询失败");
    let d = res.data;
    if (Array.isArray(res)) d = res;
    if (d == null) return [];
    if (!Array.isArray(d)) d = [d];
    return d;
  }

  App.sync = {
    async pullCloud() {
      if (!App.auth || !App.auth.uid()) return null;
      const db = await App.auth.rdb();
      if (!db) return null;
      const uid = App.auth.uid();
      try {
        const rows = rowsOf(await db.from("progress").select("*").eq("uid", uid));
        const row = rows[0] || null;
        const s = load();
        const keepSettings = s.settings;
        if (row && row.data) {
          cache = Object.assign({}, defaults, row.data, { settings: keepSettings });
        }
        localStorage.setItem(KEY, JSON.stringify(cache));
        if (!row) await this.pushCloud(); // 云端无记录，用本地初始化一条
        return !!row;
      } catch (e) {
        console.warn("云端拉取失败", e);
        return null;
      }
    },
    async pushCloud() {
      if (!App.auth || !App.auth.uid()) return null;
      const db = await App.auth.rdb();
      if (!db) return null;
      const uid = App.auth.uid();
      const s = load();
      try {
        return await db.from("progress").upsert({
          uid: uid,
          phone: App.auth.phone() || "",
          data: {
            courseProgress: s.courseProgress,
            quizHistory: s.quizHistory,
            wrongBook: s.wrongBook,
            examRecords: s.examRecords,
            studyTime: s.studyTime,
            avatar: s.avatar
          }
        }, { onConflict: "uid" });
      } catch (e) {
        console.warn("云端同步失败", e);
        return null;
      }
    }
  };
})();
