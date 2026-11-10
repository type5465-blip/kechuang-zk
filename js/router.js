/* ===== hash 路由 ===== */
(function () {
  const App = (window.App = window.App || {});

  const routes = []; // [{ re: RegExp, handler: (params, match) => Promise }]

  App.route = function (re, handler) {
    routes.push({ re, handler });
  };

  App.nav = function (hash) {
    if (location.hash === hash) {
      App.renderRoute();
    } else {
      location.hash = hash;
    }
  };

  App.renderRoute = async function () {
    const container = document.getElementById("app");
    const hash = location.hash.replace(/^#/, "") || "/";
    // 去掉末尾斜杠（根除外）
    const path = hash.length > 1 ? hash.replace(/\/+$/, "") : hash;

    // 结束考试计时器（如果存在）
    if (App.exam && App.exam.stopTimer) App.exam.stopTimer();
    // 结束学习时长计时
    if (App.stats && App.stats.stopTick) App.stats.stopTick();

    container.innerHTML = '<div class="loading">加载中…</div>';

    let matched = false;
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        matched = true;
        try {
          await r.handler(m);
        } catch (err) {
          console.error(err);
          container.innerHTML =
            '<div class="empty">页面加载出错：' + App.esc(err.message || err) + "</div>";
        }
        break;
      }
    }
    if (!matched) {
      container.innerHTML = '<div class="empty">页面不存在，<a href="#/">返回首页</a></div>';
    }
    App.updateNavActive(path);
    window.scrollTo(0, 0);
  };

  App.updateNavActive = function (path) {
    const links = document.querySelectorAll("#nav a");
    const seg = "/" + (path.split("/")[1] || "");
    links.forEach((a) => {
      a.classList.toggle("active", a.getAttribute("href") === ("#" + (seg === "/" ? "/" : seg)));
    });
    // 关闭移动端菜单
    document.getElementById("nav").classList.remove("open");
  };

  window.addEventListener("hashchange", App.renderRoute);
})();
