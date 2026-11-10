/* ===== 内容清单：模块 / 课程 / 题库 / 实操 / 面试 ===== */
(function () {
  const App = (window.App = window.App || {});

  App.MANIFEST = {
    modules: [
      {
        id: "circuit",
        title: "电路基础",
        icon: "⚡",
        desc: "欧姆定律、串并联、二极管三极管、上拉下拉电阻",
        color: "#2563eb",
        course: "content/courses/01-电路基础.md",
        quiz: "content/quiz/circuit.json"
      },
      {
        id: "sensor",
        title: "传感器",
        icon: "📡",
        desc: "灰度循迹、超声波、红外、光敏、触碰与信号类型",
        color: "#0891b2",
        course: "content/courses/02-传感器.md",
        quiz: "content/quiz/sensor.json"
      },
      {
        id: "mcu",
        title: "单片机与编程",
        icon: "💻",
        desc: "Arduino/ESP32、Mixly、C/C++、三大结构与流程",
        color: "#7c3aed",
        course: "content/courses/03-单片机与编程.md",
        quiz: "content/quiz/mcu.json"
      },
      {
        id: "mech",
        title: "机器人机械结构",
        icon: "⚙️",
        desc: "简单机械、齿轮传动、电机舵机、循迹避障控制",
        color: "#d97706",
        course: "content/courses/04-机器人机械结构.md",
        quiz: "content/quiz/mech.json"
      },
      {
        id: "math",
        title: "数理基础",
        icon: "📐",
        desc: "力学、电学、几何（对应笔试数学40+物理30）",
        color: "#16a34a",
        course: "content/courses/05-数理基础.md",
        quiz: "content/quiz/math.json"
      }
    ],

    practices: [
      { id: "p1", title: "面包板基础：搭一串 LED 串联电路", desc: "认识面包板与元器件，完成串联电路", file: "content/practice/p1-面包板串联LED.md", icon: "🔌" },
      { id: "p2", title: "按键开关与蜂鸣器", desc: "按键输入 + 蜂鸣器发声电路", file: "content/practice/p2-按键与蜂鸣器.md", icon: "🔊" },
      { id: "p3", title: "光敏电阻：环境光线检测", desc: "光敏电阻分压，模拟量读取", file: "content/practice/p3-光敏电阻.md", icon: "💡" },
      { id: "p4", title: "超声波避障小车", desc: "超声波测距 + 机器人避障逻辑", file: "content/practice/p4-超声波避障.md", icon: "🚗" }
    ],

    interview: [
      { id: "i1", title: "无领导小组面试技巧", desc: "深圳自招常见的无领导小组面试怎么应对", file: "content/interview/i1-无领导小组面试.md", icon: "🗣️" },
      { id: "i2", title: "项目答辩模板与常见问题", desc: "如何讲清你的科创项目：背景/方案/过程/反思", file: "content/interview/i2-项目答辩.md", icon: "🎤" }
    ],

    faq: "content/faq.json"
  };

  App.moduleById = function (id) {
    return App.MANIFEST.modules.find((m) => m.id === id);
  };
})();
