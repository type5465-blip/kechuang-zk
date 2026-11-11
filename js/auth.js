/* ===== 登录与云同步：腾讯云开发 CloudBase =====
 * 部署前请填写下方 ENV_ID（环境 ID），并在 CloudBase 控制台开启「手机号验证码登录」。
 * 可选：新版 Publishable Key 填入 ACCESS_KEY。
 * SDK 通过 index.html 里的 CDN 引入（static.cloudbase.net，腾讯自家 CDN，国内快）。
 */
(function () {
  const App = (window.App = window.App || {});

  // ===== 配置区（必填 ENV_ID）=====
  const ENV_ID = "absolute-mastodon-d1d3537ddd6472";          // CloudBase 环境 ID
  const ACCESS_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwM2Y4ZDM0LWQyM2UtNGFjOS1iMTg3LTViYWQ4Nzk4ZTVkMSJ9.eyJpc3MiOiJodHRwczovL2Fic29sdXRlLW1hc3RvZG9uLWQxZDM1MzdkZGQ2NDcyLmFwLXNoYW5naGFpLnRjYi1hcGkudGVuY2VudGNsb3VkYXBpLmNvbSIsInN1YiI6ImFub24iLCJhdWQiOiJhYnNvbHV0ZS1tYXN0b2Rvbi1kMWQzNTM3ZGRkNjQ3MiIsImV4cCI6NDA5Nzk5NjcxNSwiaWF0IjoxNzk0MzEzNTE1LCJub25jZSI6IkEyMTlsQ0RNVGNtSFlVeW1GbFB5S0EiLCJhdF9oYXNoIjoiQTIxOWxDRE1UY21IWVV5bUZsUHlLQSIsIm5hbWUiOiJBbm9ueW1vdXMiLCJzY29wZSI6ImFub255bW91cyIsInByb2plY3RfaWQiOiJhYnNvbHV0ZS1tYXN0b2Rvbi1kMWQzNTM3ZGRkNjQ3MiIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.qtK6T1KBeDCzxnRJerY7_HqwvT8H7p8_PpgXZHFlqvT0mpnIYAK0UX3gRju_HcdxQQ6DH7lC-xYCrlpuLtwreohbGZ4eQORR6De58IN041QfJbJhuhOow0k875rAiwbaBlLXvFZAL2zprf2suXqJGvSNXMMDEXj_HfW2XqudPRd4ui_E_2xHOAH3b7YZwlaP3O7vmOQXma_vrGT8xKaorEg2K0NYrqtfZ9mprPJ2by6T-EylSfxuXCXWUMeOksu2VS8eDtmv62b0yIpPwtbugb3v-6JXonIDQkwvx4hrxaFRrKyUIh0p8hBIQU0HlDaIozdkz8DAkzFiAnUZhEKawQ";  // 新版 Publishable Key（公开密钥）
  const PHONE_PREFIX = "";    // 若控制台要求 +86 前缀，改成 "+86"

  let app = null, auth = null, rdb = null;
  let current = null;   // { uid, phone }
  let otp = null;       // signInWithOtp 返回的 data（含 verifyOtp）

  function configured() {
    return !!(window.cloudbase && ENV_ID);
  }

  function ensure() {
    if (!configured()) return null;
    if (app) return app;
    const opts = { env: ENV_ID };
    if (ACCESS_KEY) opts.accessKey = ACCESS_KEY;
    app = window.cloudbase.init(opts);
    auth = app.auth();
    try {
      const r = (typeof app.rdb === "function") ? app.rdb() : app.rdb;
      rdb = (r && typeof r.then === "function") ? null : r; // 异步返回交给 rdb() 处理
    } catch (e) {
      console.warn("rdb 初始化失败", e);
      rdb = null;
    }
    return app;
  }

  function getState() {
    // 兼容 CloudBase / Supabase 风格：优先 getSession
    if (auth && auth.getSession) return auth.getSession();
    return auth.getLoginState();
  }

  function readUser(state) {
    // 兼容多种返回结构
    let u = null;
    if (state && state.data && state.data.session) u = state.data.session.user;
    else if (state && state.data && state.data.user) u = state.data.user;
    else if (state && state.session) u = state.session.user;
    else if (state && state.user) u = state.user;
    else if (state && (state.id || state.uid)) u = state;
    if (!u) return null;
    const id = u.id || u.uid || u.user_id || null;
    if (!id) return null;
    return { uid: id, phone: u.phone || u.phone_number || u.phoneNumber || "" };
  }

  App.auth = {
    configured,

    init() {
      if (!ensure()) return Promise.resolve(null);
      return getState()
        .then((state) => { current = readUser(state); return current; })
        .catch(() => { current = null; return null; });
    },

    // 同步读当前登录态（init/login/logout 之后可靠）
    current() { return current; },
    isLoggedIn() { return !!current; },
    uid() { return current ? current.uid : null; },
    phone() { return current ? current.phone : ""; },
    async rdb() {
      ensure();
      if (!app) return null;
      if (rdb) return rdb;
      try {
        const r = (typeof app.rdb === "function") ? app.rdb() : app.rdb;
        rdb = (r && typeof r.then === "function") ? await r : r;
      } catch (e) {
        console.warn("rdb 获取失败", e);
        rdb = null;
      }
      return rdb;
    },

    phoneMask() {
      const p = (current && current.phone) || "";
      return p.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
    },

    // 发送验证码（v2 OTP 一步登录，自动注册新用户）
    async sendCode(phone) {
      ensure();
      if (!auth) throw new Error("CloudBase 未配置");
      const r = await auth.signInWithOtp({ phone: PHONE_PREFIX + phone });
      if (r && r.error) throw new Error(r.error.message || "验证码发送失败");
      otp = r.data;
      return true;
    },

    // 验证并登录
    async login(phone, token) {
      ensure();
      if (!auth) throw new Error("CloudBase 未配置");
      if (!otp) throw new Error("请先获取验证码");
      let vr;
      if (otp && typeof otp.verifyOtp === "function") {
        vr = await otp.verifyOtp({ token });
      } else if (auth && typeof auth.verifyOtp === "function") {
        vr = await auth.verifyOtp({ phone: PHONE_PREFIX + phone, token, type: "sms" });
      } else {
        throw new Error("SDK 不支持验证码校验，请稍后再试");
      }
      if (vr && vr.error) throw new Error(vr.error.message || "验证码错误");
      const state = await getState().catch(() => null);
      current = readUser(state) || { uid: null, phone: PHONE_PREFIX + phone };
      if (!current.uid) throw new Error("登录失败，请重试");
      return current;
    },

    async logout() {
      ensure();
      if (auth) await auth.signOut().catch(() => {});
      current = null;
    },

    // 登录页视图（#/login）
    renderLogin(container) {
      const c = configured();
      const logged = current;
      container.innerHTML = `
        <div style="max-width:420px;margin:0 auto">
          <h1>🔑 登录 / 云同步</h1>
          ${!c ? `<div class="card"><p style="color:var(--danger)">CloudBase 尚未配置。请在 js/auth.js 顶部填写 ENV_ID（环境 ID）后刷新。</p></div>` : ""}
          ${logged ? `
            <div class="card">
              <p>已登录：<strong>${App.esc(App.auth.phoneMask() || App.auth.phone())}</strong></p>
              <p style="color:var(--text-sub);font-size:.9rem">学习进度与错题本已自动同步到云端。</p>
              <button class="btn btn-solid" id="loginHome" type="button">回到首页</button>
              <button class="btn danger" id="loginOut" type="button" style="margin-left:8px">退出登录</button>
            </div>` : `
            <div class="card">
              <p style="color:var(--text-sub);font-size:.9rem">手机号登录后，学习进度与错题本自动云同步，换设备也不丢。</p>
              <label style="display:block;margin:14px 0 6px;font-weight:600">手机号</label>
              <input class="blank-input" id="loginPhone" inputmode="numeric" maxlength="11" placeholder="11 位手机号" ${!c ? "disabled" : ""}>
              <div style="display:flex;gap:8px;margin:12px 0">
                <input class="blank-input" id="loginCode" inputmode="numeric" maxlength="6" placeholder="验证码" style="flex:1" ${!c ? "disabled" : ""}>
                <button class="btn" id="loginSend" type="button" ${!c ? "disabled" : ""}>获取验证码</button>
              </div>
              <button class="btn btn-solid" id="loginBtn" type="button" style="width:100%" ${!c ? "disabled" : ""}>登录</button>
              <p id="loginMsg" style="font-size:.85rem;margin-top:12px;min-height:1.2em"></p>
            </div>`}
        </div>
      `;

      const msg = (t, err) => {
        const el = document.getElementById("loginMsg");
        if (el) { el.style.color = err ? "var(--danger)" : "#16a34a"; el.textContent = t; }
      };

      if (logged) {
        const hb = document.getElementById("loginHome");
        const ob = document.getElementById("loginOut");
        if (hb) hb.onclick = () => { location.hash = "#/"; };
        if (ob) ob.onclick = async () => { await App.auth.logout(); App.renderRoute(); };
        return;
      }

      const phoneEl = document.getElementById("loginPhone");
      const codeEl = document.getElementById("loginCode");
      const sendBtn = document.getElementById("loginSend");
      const btn = document.getElementById("loginBtn");

      if (sendBtn) sendBtn.onclick = async () => {
        const phone = (phoneEl.value || "").trim();
        if (!/^1\d{10}$/.test(phone)) { msg("请输入正确的 11 位手机号", true); return; }
        sendBtn.disabled = true;
        try {
          await App.auth.sendCode(phone);
          msg("验证码已发送，请查收短信");
          let left = 60;
          sendBtn.textContent = left + "s";
          const timer = setInterval(() => {
            left--;
            if (left <= 0) { clearInterval(timer); sendBtn.disabled = false; sendBtn.textContent = "获取验证码"; }
            else sendBtn.textContent = left + "s";
          }, 1000);
        } catch (e) {
          sendBtn.disabled = false;
          msg(e.message || "发送失败", true);
        }
      };

      if (btn) btn.onclick = async () => {
        const phone = (phoneEl.value || "").trim();
        const code = (codeEl.value || "").trim();
        if (!/^1\d{10}$/.test(phone)) { msg("请输入正确的 11 位手机号", true); return; }
        if (!/^\d{4,6}$/.test(code)) { msg("请输入验证码", true); return; }
        btn.disabled = true; btn.textContent = "登录中…";
        try {
          await App.auth.login(phone, code);
          msg("登录成功，正在同步…");
          await App.sync.pullCloud();
          location.hash = "#/";
        } catch (e) {
          btn.disabled = false; btn.textContent = "登录";
          msg(e.message || "登录失败", true);
        }
      };
    }
  };
})();
