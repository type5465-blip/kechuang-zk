# 深圳科创自招 · 硬件方向备考平台

面向**深圳中考科创类自主招生（硬件方向）**的静态网页学习应用，帮助学生系统备考电路、传感器、单片机、机器人结构、数理基础五大模块，覆盖笔试、实操与面试。

## 功能

- 📚 **课程学习**：5 大知识模块图文课程（Markdown），可标记完成
- ✏️ **题库练习**：单选 / 判断 / 填空，即时判分 + 解析 + 自动错题本
- ⏱️ **模拟考试**：限时、随机组卷、交卷自动评分 + 成绩报告
- 🛠️ **实操教程**：面包板电路、按键蜂鸣器、光敏电阻、超声波避障
- 🎤 **面试指导**：无领导小组面试技巧、项目答辩模板
- 📊 **进度统计**：掌握度、正确率、学习时长、考试成绩
- 🤖 **智能答疑**：默认课程内容检索答疑，可选真·AI（自配 Key）

## 技术方案

- **纯 HTML / CSS / JavaScript**，无构建工具、无框架、无后端
- 内容用 **Markdown** 编写，运行时 `fetch` 加载，用 CDN `marked.js` 渲染
- 题库用 **JSON** 存储
- 数据用 **localStorage** 持久化（进度 / 错题 / 成绩 / 设置）
- 唯一外部依赖：`marked.js`（CDN）

## 本地预览

因课程/题库通过 `fetch` 加载，需通过 HTTP 访问（不能直接双击 `index.html`）。任选其一：

```bash
# 方式一：Python
python -m http.server 8080

# 方式二：Node（如已安装 npx）
npx serve .
```

然后浏览器打开 http://localhost:8080 （VS Code 用户也可用 Live Server 插件）。

## 部署到 GitHub Pages

1. 在 GitHub 新建公开仓库，如 `hardware-app`。
2. 把本项目全部文件 push 到 `main` 分支：

```bash
git init
git add .
git commit -m "init: 深圳科创自招硬件备考平台"
git branch -M main
git remote add origin https://github.com/<你的用户名>/hardware-app.git
git push -u origin main
```

3. 打开仓库 → **Settings → Pages** → Source 选 **Deploy from a branch** → 分支 `main`、目录 `/ (root)` → Save。
4. 几分钟后访问 `https://<你的用户名>.github.io/hardware-app/`。

> 纯静态站点无需 GitHub Actions 或构建步骤。

## 内容目录与更新指南

```
content/
├── courses/      课程 Markdown（5 个模块，直接改 .md 即可更新课程）
├── quiz/         题库 JSON（每个模块一个文件）
├── practice/     实操教程 Markdown
├── interview/    面试指导 Markdown
└── faq.json      答疑检索问答库
```

- **改课程 / 教程 / 面试**：直接编辑对应 `.md` 文件，Markdown 语法。
- **加题目**：编辑 `content/quiz/<模块>.json`，字段说明：
  - `type`: `single`（单选，`answer` 为选项下标）、`judge`（判断，`answer` 为 `true/false`）、`blank`（填空，`answer` 为答案字符串，可用 `accept` 数组列出可接受答案）
  - `stem`: 题干；`options`: 选项数组（单选）；`answer`: 答案；`analysis`: 解析；`keywords`: 用于答疑检索的关键词
- **加 FAQ**：编辑 `content/faq.json`，每条含 `q`、`a`、`keywords`。
- **改模块入口**：编辑 `js/manifest.js` 中的 `modules` / `practices` / `interview` 数组。

## AI 答疑说明（重要）

GitHub Pages 是纯静态托管，无法安全地在给所有学生开放时隐藏 API Key。因此：

- **默认**：内容检索答疑，零成本、零配置。
- **可选真 AI**：在「设置」页填入你自己的 API Key（仅存本地浏览器，不硬编码），即可启用真·LLM 对话（默认配置 DeepSeek，兼容 OpenAI 接口）。
- 若要给所有学生开放真 AI 且不泄露 Key，需再加一层 Serverless 代理（如 Cloudflare Workers），属于后续扩展。

## 免责声明

本平台的招生政策、考核内容整理自公开网络资料，**请以深圳市教育局、各高中官方发布的招生简章为准**。
