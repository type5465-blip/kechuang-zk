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
  }

  App.store = {
    get() { return load(); },

    // 课程进度
    setCourseDone(moduleId, done) {
      const s = load();
      if (done) s.courseProgress[moduleId] = { completed: true, ts: Date.now() };
      else delete s.courseProgress[moduleId];
      save();
    },
    isCourseDone(moduleId) {
      return !!(load().courseProgress[moduleId] && load().courseProgress[moduleId].completed);
    },

    // 做题记录 + 错题本
    recordAnswer(moduleId, qid, correct) {
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
      const s = load();
      const arr = s.wrongBook[moduleId] || [];
      const idx = arr.indexOf(qid);
      if (idx >= 0) arr.splice(idx, 1);
      save();
    },

    // 模拟考
    addExamRecord(rec) {
      const s = load();
      s.examRecords.push(rec);
      save();
    },
    getExamRecords() {
      return load().examRecords.slice();
    },

    // 学习时长（按模块累加秒）
    addStudyTime(moduleId, seconds) {
      const s = load();
      s.studyTime[moduleId] = (s.studyTime[moduleId] || 0) + seconds;
      save();
    },
    getStudyTime() {
      return Object.assign({}, load().studyTime);
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
    }
  };
})();
