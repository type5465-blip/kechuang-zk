/* ===== 登录与云同步：腾讯云开发 CloudBase =====
 * 部署前请填写下方 ENV_ID（环境 ID），并在 CloudBase 控制台开启「手机号验证码登录」与「用户名密码登录」。
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
  let otp = null;       // signInWithOtp / signUp 返回的 data（含 verifyOtp）
  let pendingPassword = null; // 注册时暂存密码
  let loginTab = "login"; // 登录页标签：login=登录 / reg=注册
  let loginWay = "pwd";   // 登录方式：pwd=密码 / sms=短信验证码
  let phoneDraft = "";    // 切换标签时保留已输入的手机号

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

    // 手机号 + 密码登录
    async passwordLogin(phone, password) {
      ensure();
      if (!auth) throw new Error("CloudBase 未配置");
      const r = await auth.signInWithPassword({ phone: PHONE_PREFIX + phone, password });
      if (r && r.error) throw new Error(r.error.message || "手机号或密码错误");
      const state = await getState().catch(() => null);
      current = readUser(state) || { uid: null, phone: PHONE_PREFIX + phone };
      if (!current.uid) throw new Error("登录失败，请重试");
      return current;
    },

    // 注册第一步：发送短信验证码（同时带上密码）
    async sendSignupCode(phone, password) {
      ensure();
      if (!auth) throw new Error("CloudBase 未配置");
      pendingPassword = password;
      const r = await auth.signUp({ phone: PHONE_PREFIX + phone, password });
      if (r && r.error) throw new Error(r.error.message || "验证码发送失败");
      otp = r.data;
      return true;
    },

    // 注册第二步：校验验证码，完成注册并登录
    async signup(phone, token) {
      ensure();
      if (!auth) throw new Error("CloudBase 未配置");
      if (!otp || typeof otp.verifyOtp !== "function") throw new Error("请先获取验证码");
      const vr = await otp.verifyOtp({ token });
      if (vr && vr.error) throw new Error(vr.error.message || "验证码错误");
      let state = await getState().catch(() => null);
      current = readUser(state);
      if (!current || !current.uid) {
        // 注册完成后若未自动登录，用刚设置的密码兜底登录一次
        await this.passwordLogin(phone, pendingPassword);
      }
      if (!current.uid) throw new Error("注册失败，请重试");
      return current;
    },

    async logout() {
      ensure();
      if (auth) await auth.signOut().catch(() => {});
      current = null;
      // 退出登录时清空本地进度缓存（云端已保存，重新登录会拉回）
      if (App.store && App.store.clearProgress) App.store.clearProgress();
    },

    // 登录页视图（#/login）：登录 / 注册 双标签，登录内可切密码 / 短信
    renderLogin(container) {
      const c = configured();
      const logged = current;
      const isLogin = loginTab === "login";
      const isPwd = loginWay === "pwd";

      container.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-hero">
            <div class="auth-logo">🔧</div>
            <h1>深圳科创自招 · 硬件备考</h1>
            <p class="auth-sub">登录后学习进度与错题本自动云同步，换设备也不丢</p>
          </div>
          ${!c ? `
            <div class="auth-card">
              <p style="color:var(--danger);text-align:center;margin:0">CloudBase 尚未配置。请在 js/auth.js 顶部填写 ENV_ID（环境 ID）后刷新。</p>
            </div>` : logged ? `
            <div class="auth-card" style="text-align:center">
              <p style="font-size:2.4rem;margin:0">✅</p>
              <p style="font-weight:700;font-size:1.05rem;margin:10px 0 2px">已登录</p>
              <p style="color:var(--text-sub);font-size:.95rem;margin:0 0 20px">${App.esc(App.auth.phoneMask() || App.auth.phone())}</p>
              <button class="auth-submit" id="loginHome" type="button">进入学习</button>
              <button class="btn ghost block" id="loginOut" type="button" style="margin-top:10px">退出登录</button>
            </div>` : `
            <div class="auth-card">
              <div class="auth-seg">
                <button id="segLogin" class="${isLogin ? "active" : ""}" type="button">登录</button>
                <button id="segReg" class="${!isLogin ? "active" : ""}" type="button">注册</button>
              </div>

              <div class="auth-field">
                <label class="auth-label" for="loginPhone">手机号</label>
                <input class="auth-input" id="loginPhone" inputmode="numeric" maxlength="11" placeholder="请输入 11 位手机号" value="${App.esc(phoneDraft)}">
              </div>

              ${isLogin ? (isPwd ? `
                <div class="auth-field">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
                    <label class="auth-label" for="loginPwd" style="margin:0">密码</label>
                    <a id="forgotPwd" style="font-size:.82rem;color:var(--text-sub);cursor:pointer">忘记密码？</a>
                  </div>
                  <div class="auth-pwd">
                    <input class="auth-input" id="loginPwd" type="password" placeholder="请输入密码">
                    <button class="auth-eye" id="eyePwd" type="button" aria-label="显示或隐藏密码">👁</button>
                  </div>
                </div>` : `
                <div class="auth-field">
                  <label class="auth-label" for="loginCode">短信验证码</label>
                  <div class="auth-code-row">
                    <input class="auth-input" id="loginCode" inputmode="numeric" maxlength="6" placeholder="6 位验证码">
                    <button class="auth-send" id="loginSend" type="button">获取验证码</button>
                  </div>
                  <p class="auth-hint">忘记密码也没关系，短信验证码同样能登录</p>
                </div>`) : `
                <div class="auth-field">
                  <label class="auth-label" for="loginPwd">设置密码</label>
                  <div class="auth-pwd">
                    <input class="auth-input" id="loginPwd" type="password" placeholder="6–20 位，建议字母 + 数字">
                    <button class="auth-eye" id="eyePwd" type="button" aria-label="显示或隐藏密码">👁</button>
                  </div>
                  <p class="auth-hint">注册后每次用密码直接登录，不再收短信</p>
                </div>
                <div class="auth-field">
                  <label class="auth-label" for="loginCode">短信验证码</label>
                  <div class="auth-code-row">
                    <input class="auth-input" id="loginCode" inputmode="numeric" maxlength="6" placeholder="6 位验证码">
                    <button class="auth-send" id="loginSend" type="button">获取验证码</button>
                  </div>
                </div>`}

              <button class="auth-submit" id="loginBtn" type="button">${isLogin ? "登录" : "注册"}</button>

              ${isLogin ? `
                <div class="auth-links"><a id="linkWay">${isPwd ? "短信验证码登录" : "密码登录"}</a></div>
                <div class="auth-alt">还没有账号？<a id="goReg">立即注册</a></div>` : `
                <div class="auth-alt">已有账号？<a id="goLogin">直接登录</a></div>`}

              <p class="auth-msg" id="loginMsg"></p>
            </div>`}
          <div class="auth-trust">🔒 手机号与密码加密传输，仅用于保存你的学习记录</div>
        </div>
      `;

      const msg = (t, err) => {
        const el = document.getElementById("loginMsg");
        if (el) { el.style.color = err ? "var(--danger)" : "var(--success)"; el.textContent = t; }
      };

      if (logged) {
        document.getElementById("loginHome").onclick = () => { location.hash = "#/"; };
        document.getElementById("loginOut").onclick = async () => { await App.auth.logout(); App.renderRoute(); };
        return;
      }

      const $ = (id) => document.getElementById(id);

      // 切换标签 / 方式
      if ($("segLogin")) $("segLogin").onclick = () => { loginTab = "login"; App.auth.renderLogin(container); };
      if ($("segReg")) $("segReg").onclick = () => { loginTab = "reg"; loginWay = "pwd"; App.auth.renderLogin(container); };
      if ($("goReg")) $("goReg").onclick = () => { loginTab = "reg"; loginWay = "pwd"; App.auth.renderLogin(container); };
      if ($("goLogin")) $("goLogin").onclick = () => { loginTab = "login"; App.auth.renderLogin(container); };
      if ($("linkWay")) $("linkWay").onclick = () => { loginWay = loginWay === "pwd" ? "sms" : "pwd"; App.auth.renderLogin(container); };
      if ($("forgotPwd")) $("forgotPwd").onclick = () => { loginWay = "sms"; App.auth.renderLogin(container); };

      // 密码可见性切换
      const pwdEl = $("loginPwd");
      if ($("eyePwd") && pwdEl) $("eyePwd").onclick = () => {
        const show = pwdEl.type === "password";
        pwdEl.type = show ? "text" : "password";
        $("eyePwd").textContent = show ? "🙈" : "👁";
      };

      const phoneEl = $("loginPhone");
      const codeEl = $("loginCode");
      const sendBtn = $("loginSend");
      const btn = $("loginBtn");

      if (phoneEl) phoneEl.oninput = () => { phoneDraft = phoneEl.value; };

      const phoneOk = () => /^1\d{10}$/.test((phoneEl.value || "").trim());

      const countdown = (b) => {
        let left = 60;
        b.textContent = left + "s";
        const t = setInterval(() => {
          left--;
          if (left <= 0) { clearInterval(t); b.disabled = false; b.textContent = "获取验证码"; }
          else b.textContent = left + "s";
        }, 1000);
      };

      if (sendBtn) sendBtn.onclick = async () => {
        const phone = (phoneEl.value || "").trim();
        if (!phoneOk()) { msg("请输入正确的 11 位手机号", true); return; }
        if (!isLogin && (pwdEl.value || "").trim().length < 6) { msg("请先设置至少 6 位密码", true); return; }
        sendBtn.disabled = true;
        try {
          if (!isLogin) await App.auth.sendSignupCode(phone, (pwdEl.value || "").trim());
          else await App.auth.sendCode(phone);
          msg("验证码已发送，请查收短信");
          countdown(sendBtn);
        } catch (e) {
          sendBtn.disabled = false;
          msg(e.message || "发送失败", true);
        }
      };

      if (btn) btn.onclick = async () => {
        const phone = (phoneEl.value || "").trim();
        if (!phoneOk()) { msg("请输入正确的 11 位手机号", true); return; }
        btn.disabled = true; btn.textContent = "请稍候…";
        try {
          if (isLogin && isPwd) {
            const pw = (pwdEl.value || "");
            if (!pw) throw new Error("请输入密码");
            await App.auth.passwordLogin(phone, pw);
          } else if (isLogin && !isPwd) {
            const code = (codeEl.value || "").trim();
            if (!/^\d{4,6}$/.test(code)) throw new Error("请输入验证码");
            await App.auth.login(phone, code);
          } else {
            const pw = (pwdEl.value || "");
            if (pw.length < 6) throw new Error("请设置至少 6 位密码");
            const code = (codeEl.value || "").trim();
            if (!/^\d{4,6}$/.test(code)) throw new Error("请输入验证码");
            await App.auth.signup(phone, code);
          }
          msg(isLogin ? "登录成功，正在同步…" : "注册成功，正在同步…");
          await App.sync.pullCloud();
          location.hash = "#/";
        } catch (e) {
          btn.disabled = false; btn.textContent = isLogin ? "登录" : "注册";
          msg(e.message || "操作失败", true);
        }
      };
    }
  };
})();
