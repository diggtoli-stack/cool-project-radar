[English](README.md) | **中文**

# Cool Project Radar

一个用来发现新项目的 Codex skill。

你告诉它你喜欢什么：App、AI 工具、浏览器插件、硬件、小众网页、小游戏、创作者工具、奇怪但有意思的产品。它会去公开来源里扫一圈，挑出最值得看的项目，然后整理成一份带链接的简短 digest。

你可以把它理解成：一个可以按你口味调节的“新项目雷达”。

## 你会得到什么

Cool Project Radar 可以帮你发现：

- 新 App、网页产品、浏览器插件、AI 工具
- 独立开发者项目、开源 demo、Product Hunt 风格的新发布
- 消费硬件、可穿戴设备、智能家居、硬件 + App 服务
- 好玩的工具、小实验、网页玩具、新交互
- 按场景整理的产品灵感，而不是简单罗列来源
- 每个项目的原始链接和来源链接

它不是普通新闻阅读器。它更关注“产品味道”：新的使用场景、新的人群、新交互、新工作流、奇怪但有启发的小想法。

## 快速开始

1. 在 Codex 里安装这个 skill。
2. 对 agent 说：

```text
配置 Cool Project Radar。
```

3. 它会给你 3 组选项。前两题可多选，第三题单选：

```text
1. 你想看哪类项目？（可多选）
A. App / 移动应用
B. Web / 网页产品
C. 浏览器插件
D. AI 工具 / Agent 工作流
E. 开源工具 / 开发者工具
F. 硬件 / 可穿戴 / 智能设备
G. 游戏 / 互动玩具
H. 创作者工具 / 设计工具

2. 你关心哪些场景或领域？（可多选）
A. 效率 / 自动化
B. 写作 / 研究 / 知识管理
C. 设计 / 图片 / 审美
D. 社交 / 社区 / 协作
E. 家庭 / 旅行 / 生活方式
F. 健康 / 自控 / 习惯
G. 教育 / 学习
H. 开发者工作流
I. 消费硬件 / 智能家居

3. 你偏好的筛选风格？（单选）
A. 创新优先
B. 热门优先
C. 实用优先
D. 奇怪有趣优先
E. 平衡
```

推荐回复格式：

```text
类型：B、C、D、H
领域：A、B、C
风格：A
```

设置完以后，之后可以随时说：

```text
Run my project radar for the last 24 hours.
```

默认来源不需要 API key。

## 每次怎么调用

你不需要每次都改配置文件。直接告诉 agent 这次想找什么就行。

你可以这样说：

```text
Find weird browser extensions from the past week.
```

```text
Look for consumer hardware and wearable projects from the last 10 days.
```

```text
I want practical AI workflow tools for researchers, last 72 hours.
```

```text
Only scan Product Hunt and GitHub for creator tools.
```

```text
This time, bias toward local-first privacy apps.
```

它会把这些自然语言理解成：

- 时间范围：24 小时、72 小时、过去一周、过去 10 天
- 项目类型：App、网页、插件、硬件、游戏、AI 工具
- 场景领域：效率、创作者、写作、设计、家庭、旅行、健康、教育、开发者工作流
- 筛选风格：创新、热门、实用、奇怪/实验、平衡
- 额外偏好：local-first、隐私、相机、音乐、ADHD、WebGPU 等

## 筛选风格

首次设置时选一个默认风格；每次运行时也可以临时覆盖。

- `innovation`：优先看新场景、新交互、新品味、新工作流
- `popular`：优先看热度、讨论度、发布声量
- `practical`：优先看明确有用、能反复使用的工具
- `weird`：优先看好玩、奇怪、小而美、实验性的项目
- `balanced`：实用项目和实验项目都收一点

## 安装

用 Codex 的 skill installer 安装：

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo diggtoli-stack/cool-project-radar \
  --path cool-project-radar
```

安装后重启 Codex，让它识别新 skill。

也可以手动复制：

```bash
cp -R cool-project-radar ~/.codex/skills/
```

## 手动配置

如果你想直接生成配置：

```bash
node ~/.codex/skills/cool-project-radar/scripts/init-config.js \
  --language zh \
  --formats "web apps,browser extensions,AI tools" \
  --domains "productivity,creator tools,design" \
  --style innovation
```

配置会写到：

```text
~/.cool-project-radar/config.json
```

示例见：[examples/config.example.json](examples/config.example.json)

## 它是怎么工作的

1. 读取你的本地兴趣配置。
2. 抓取公开的新项目/发布来源。
3. 把不同来源整理成统一候选 JSON。
4. Codex 阅读候选，不盲按分数，而是按产品判断筛选。
5. Codex 写成一份带项目链接和来源链接的 digest。

默认公开来源包括 Hacker News、Product Hunt RSS、GitHub Search、Firefox Add-ons、App Store/iTunes Search、V2EX、Lobsters、科技/产品 RSS、Reddit public JSON、YouTube channel RSS、Bluesky public search。

有些来源是 best-effort：可能限流、超时、被挡或返回部分结果。如果 DNS 不通，脚本会返回 `network_unavailable`，不会误报成“今天没有项目”。

## 可选截图

挑完项目后，Codex 可以给入选项目抓落地页截图：

```bash
node ~/.codex/skills/cool-project-radar/scripts/capture-screenshots.js \
  --input /tmp/cool-project-radar-selected.json \
  --output-dir /tmp/cool-project-radar-shots \
  --limit 8 \
  --timeout-ms 15000
```

截图只是展示辅助。不能因为一个项目有图或没图，就决定选不选它。

## 隐私

- 你的兴趣配置在本地：`~/.cool-project-radar/config.json`
- 默认来源不需要 API key
- 可选 API 来源应使用环境变量，不要把 key 写进仓库
- skill 只读取公开网页、公开 feed 和公开 API
- 你的偏好留在你自己的机器上

## 要求

- Codex 或其他能读取 skill 文件、运行 shell 命令的本地 coding agent
- Node.js 18+
- 网络连接
- 如果要截图，需要本机有 Chrome/Chromium

## License

MIT
