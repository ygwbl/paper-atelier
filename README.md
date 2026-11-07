# 📜 Paper Atelier (纸境工坊)

<p align="center">
  <strong>东方素纸美学 · 零依赖极简原生 · AI 原生智能回笔 · 全自动自治策展系统</strong>
</p>

<p align="center">
  <em>A Zero-Dependency, Oriental Paper-Tactile & AI-Native Personal Publishing Studio.</em>
</p>

<p align="center">
  <a href="https://blog.hlat.xyz"><img src="https://img.shields.io/badge/Live_Demo-blog.hlat.xyz-b83b3b?style=for-the-badge&logo=safari&logoColor=white" alt="Live Demo"></a>
  <a href="https://linux.do"><img src="https://img.shields.io/badge/Community-LINUX%20DO-2563eb?style=for-the-badge&logo=linux&logoColor=white" alt="LINUX DO"></a>
  <img src="https://img.shields.io/badge/Dependencies-ZERO-success?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/Memory-~30MB-blue?style=for-the-badge&logo=docker&logoColor=white" alt="Low Memory">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready">
  <img src="https://img.shields.io/badge/License-MIT-amber?style=for-the-badge" alt="MIT License">
</p>

---

## 🎐 在线实机体验 (Live Demos)

* 🏮 **国内极速直出**：[https://blog.hlat.xyz](https://blog.hlat.xyz)（腾讯云 BGP 直连 / 边缘毫秒级秒开）
* 🌐 **国际 Anycast 穿透**：[https://hlat.top](https://hlat.top)（全球 CDN 边缘节点网络）

---

## 🏮 为什么选择纸境工坊？(Highlights)

在现代 Web 框架日益臃肿、动辄几百兆 `node_modules` 与层层转译黑盒的时代，**纸境工坊 (Paper Atelier)** 选择回归质朴与克制。

### 1. 🪶 真正的零外部依赖 (Zero Dependencies)
* **纯原生后端**：完全基于 Node.js 标准库（`http`, `fs`, `crypto`, `zlib`, `os`），没有引入任何第三方 npm 包；
* **零构建打包**：前端采用现代原生 ES6 + CSS Variables + 原生 Canvas 3D，无需 Webpack/Vite 繁冗构建，源码即是生产环境；
* **极速轻盈**：**冷启动仅需 10 毫秒**，整机常驻内存仅 **30MB 左右**，在最低配的 1核512M 微型机器或家庭 NAS 上也能流畅飞驰。

### 2. 📜 日本竹尾素纸与东方书籍美学 (Paper-Tactile Aesthetic)
* **竹尾素纸 (Takeo Paper `#fcfbf9`) 色彩体系**：告别刺眼的高对比纯白与浮躁霓虹色，以柔和特种纸质感为底色，点缀传统朱砂红印（`#b83b3b`）与墨黑（`#1a1918`）；
* **正统中文书籍网格排版**：严格遵循中文书籍规范，正文段落首行缩进两中文字符（`text-indent: 2em`）与平滑两端对齐；
* **Canvas 3D 纸牌悬浮舞台**：手写原生 Canvas 透视投影算法，模拟素纸卡片在桌面悬浮微倾翻转；
* **沉浸三色心境**：☀ **竹尾素纸**（经典纸感）、📖 **古籍茶白**（温润护眼）、🌙 **墨夜玄境**（低光沉浸）。

### 3. 🤖 AI-Native 原生智能回笔 (Smart Echo)
* **OpenAI 兼容协议**：不仅支持智谱 GLM，还天然支持 **DeepSeek、通义千问、Kimi、Claude、GPT-4o 以及本地 Ollama**；
* **意图深度洞察**：智能区分访客的打卡问候、技术求教、观点探讨与真诚鼓励；
* **消灭 AI 腔与注水套话**：严禁公关式客套与废话，以真实博主工程师的第一人称，在便签纸上随笔写下温润、克制的回赠墨痕；
* **无缝降级**：未配置 API Key 时，全自动启用内建的本地语义规则引擎，零挂起、零报错。

### 4. 🕰️ 自主策展与全网自治宣发 (Autonomous Curation)
* **自动发布与长文自治**：内置策展守护进程，支持定期自动整理随笔长文与排版校准；
* **SEO & IndexNow 毫秒级收录**：发布即刻向 Bing、Yandex 等搜索引擎下发 IndexNow 实时推送；
* **多平台宣发包自动生成**：文章发布时全自动生成适配 **X (Twitter)**（字符权重动态计算）、**V2EX**、**知乎** 的预制宣发包，支持推特 Intent 一键直发。

### 5. 📊 隐私优先的内建真实统计 (Privacy-First Analytics)
* **绝无明文 IP 收集**：采用安全加盐哈希落盘进行自然日 UV 去重，尊重每一位敲门者的数字隐私；
* **全真指标防刷**：剔除爬虫探活与本机请求，准确记录站点 PV/UV、今日浏览与单篇文章深度阅读量；
* **顺读卡与阅读进度追踪**：基于读者浏览深度的纯客户端顺读推荐卡，无中心化追踪器。

---

## 📊 横向对比 (Comparison Matrix)

| 维度 | Paper Atelier (纸境工坊) | Astro / Next.js | Hugo / Hexo | Ghost / WordPress |
| :--- | :--- | :--- | :--- | :--- |
| **外部运行依赖** | **0（纯原生标准库，无 node_modules）** | 极多 (数百 MB 依赖) | 需外部编译器 | 需 MySQL / PHP 等重型套件 |
| **构建步骤** | **无，即开即跑** | 需 Webpack / Vite 编译 | 需静态编译输出 | 复杂安装向导 |
| **设计美学** | **东方竹尾素纸书籍极简设计** | 依赖外部模版/主题 | 依赖外部模版/主题 | 通用 SaaS 现代风格 |
| **冷启动 / 内存** | **10ms / ~30MB 内存** | ~100MB+ | 纯静态托管 | 300MB ~ 1GB 内存 |
| **AI 原生联动** | **内建智能回笔与自治策展** | 无（需自行手写） | 无 | 依赖插件 |
| **全网宣发与 SEO** | **内建 IndexNow + X 宣发引擎** | 需第三方插件 | 仅基础 Sitemap | 需庞大 SEO 插件包 |

---

## 🚀 30 秒极速上手 (Quick Start)

### 方式一：纯原生裸机运行（推荐，极致轻量）

确保机器已安装 Node.js (>= 18.0.0)，无需安装任何 npm 包：

```bash
# 1. 克隆代码仓库
git clone https://github.com/your-username/paper-atelier.git
cd paper-atelier

# 2. [可选] 创建配置文件（若直接启动，系统将自动依模板初始化）
cp data/config.example.json data/config.json

# 3. 运行！
node server.js
```

打开浏览器访问 `http://localhost:8080`，即可看到完整的纸境工坊！

> [!NOTE]
> 首次启动时，若未在环境变量中传入 `ATELIER_INITIAL_PASSWORD`，控制台将**生成一个高强度初始管理密钥并打印一次**。请登录 `http://localhost:8080/admin` 修改或保存。

---

### 方式二：Docker & Docker Compose 一键拉起

适合群晖 NAS、1Panel、宝塔、VPS 或云原生环境：

```bash
# 一键拉起容器
docker compose up -d
```

或使用纯 Docker 命令行运行：

```bash
docker run -d \
  --name paper-atelier \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/og:/app/public/og \
  -e AI_API_KEY="your-api-key" \
  -e AI_BASE_URL="https://api.deepseek.com/v1" \
  -e AI_MODEL="deepseek-chat" \
  --restart unless-stopped \
  paper-atelier:latest
```

---

## ⚙️ 配置说明 (Configuration)

系统根目录下的 `data/config.json`（或 `.env` 环境变量）控制全站行为：

```json5
{
  "siteTitle": "纸境工坊",                    // 站点标题
  "siteSubtitle": "在微云之境，构筑自治的工程工作流与思想自留地。",
  "author": "纸境墨客",                       // 作者名称
  "bio": "这里是纸境工坊。记录关于云原生架构、现代极简交互与自动化系统的深度沉淀...",
  "stampText": "纸境\nATELIER",               // 动态印章文字
  "homeProvince": "浙江",                     // 主理人所在地省份（用于留言回笔地域感知）
  "homeCity": "杭州",                        // 主理人所在地城市
  
  // 大模型智能回笔配置（支持任意 OpenAI 兼容端点：DeepSeek / GLM / Kimi / Ollama）
  "ai": {
    "provider": "openai-compatible",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "sk-your-deepseek-api-key",
    "model": "deepseek-chat",
    "authorName": "工坊回笔 · 墨迹"
  },
  
  // 社交推特/X 自动化凭据（可选）
  "twitter": {
    "api_key": "",
    "api_secret": "",
    "access_token": "",
    "access_token_secret": ""
  }
}
```

---

## 🏛 核心目录架构 (Architecture)

```text
paper-atelier/
├── server.js              # 纯原生 Node.js 高性能服务器 (零外部依赖)
├── curator_daemon.py      # 自治策展守护进程 (RSS / Sitemap / IndexNow / 多平台宣发)
├── public/                # 静态资产层
│   ├── index.html         # 核心单页 HTML 骨架与 SEO 结构化数据
│   ├── app.js             # 客户端交互引擎 (3D Stage / 状态机 / 顺读卡 / 留墨瀑布流)
│   ├── style.css          # 竹尾素纸、茶白、墨夜三套沉浸质感样式变量库
│   ├── sw.js              # 客户端自愈与缓存生命周期管理
│   └── og/                # 动态生成的 1200x630 社交分享大图
├── data/                  # 持久化数据层 (纯 JSON 存储，免去繁重数据库)
│   ├── config.json        # 站点与模型配置
│   ├── articles.json      # 文章文库
│   ├── moments.json       # 随笔闪念
│   ├── messages.json      # 留言与回笔墨痕
│   └── stats.json         # 原生加盐去重统计数据
├── scripts/               # 实用自动化脚本
│   └── post_to_twitter.py # X (Twitter) 动态权重校验与一键直发引擎
├── Dockerfile             # 55MB 极简 Alpine 生产镜像
└── docker-compose.yml     # 生产容器编排文件
```

---

## 🤝 参与贡献 (Contributing)

纸境工坊推崇极致纯粹的原生之美与克制。我们非常欢迎以下方向的 Issue 与 Pull Request：

1. **排版与无障碍 (A11y)**：优化中文排版阅读韵律，提高屏幕阅读器与键盘无障碍访问体验；
2. **多语言与本地化**：为界面与回笔引擎提供更多优雅的多语言支持；
3. **轻量动效**：在保证 60fps 与零依赖的前提下，进一步提升东方素纸微交互质感。

---

## 🐧 社区友链与鸣谢 (Acknowledgements & Community)

本项目已入驻开源技术社区，特别鸣谢以下极客社区对本项目的关注与支持：
* 🐧 **[LINUX DO](https://linux.do/)** — 真诚、友善、团结、专业的开源与技术极客社区。

---

## 📄 开源许可 (License)

本项目遵循 [MIT License](LICENSE) 协议开源。你可以自由地商业使用、私有部署、修改与二次分发，仅需保留原项目版权与许可声明。
