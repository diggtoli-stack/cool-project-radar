# Onboarding Reference

Use this reference when `~/.cool-project-radar/config.json` is missing or the user asks to change their radar.

## Language

Ask in Chinese by default. Use English only if the user explicitly asks for English or the surrounding conversation is clearly English.

Do not ask open-ended "for example" questions. Give clear options. Let the user answer with letters, numbers, or short labels.

## Chinese Onboarding Prompt

Use this prompt:

```text
还没有完成 Cool Project Radar 配置。请从下面 3 组里选择，直接回复选项编号或文字即可；前两题可多选，第三题单选。

1. 你想看哪类项目？（可多选）
A. App / 移动应用
B. Web / 网页产品
C. 浏览器插件
D. AI 工具 / Agent 工作流
E. 开源工具 / 开发者工具
F. 硬件 / 可穿戴 / 智能设备
G. 游戏 / 互动玩具
H. 创作者工具 / 设计工具
I. 其他：请写明

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
J. 其他：请写明

3. 你偏好的筛选风格？（单选）
A. 创新优先：更看重新场景、新交互、新品味
B. 热门优先：更看重讨论度、发布声量、增长信号
C. 实用优先：更看重能立刻用、能反复用的工具
D. 奇怪有趣优先：更看重小实验、脑洞、玩具感
E. 平衡：实用项目和实验项目都收一点

推荐回复格式：
类型：B、C、D、H
领域：A、B、C
风格：A
```

## Option Mapping

Map project type answers to `projectFormats`:

- App / 移动应用 -> `mobile apps`
- Web / 网页产品 -> `web apps`
- 浏览器插件 -> `browser extensions`
- AI 工具 / Agent 工作流 -> `AI tools`, `AI workflows`
- 开源工具 / 开发者工具 -> `open-source tools`, `developer tools`
- 硬件 / 可穿戴 / 智能设备 -> `hardware`, `wearables`, `smart devices`
- 游戏 / 互动玩具 -> `games`, `interactive toys`
- 创作者工具 / 设计工具 -> `creator tools`, `design tools`
- Other written text -> preserve as extra `projectFormats` or `focusKeywords`

Map domain answers to `domains`:

- 效率 / 自动化 -> `productivity`, `automation`
- 写作 / 研究 / 知识管理 -> `writing`, `research`, `knowledge management`
- 设计 / 图片 / 审美 -> `design`, `image tools`, `aesthetic tools`
- 社交 / 社区 / 协作 -> `social`, `community`, `collaboration`
- 家庭 / 旅行 / 生活方式 -> `family`, `travel`, `lifestyle`
- 健康 / 自控 / 习惯 -> `health`, `self-control`, `habits`
- 教育 / 学习 -> `education`, `learning`
- 开发者工作流 -> `developer workflow`
- 消费硬件 / 智能家居 -> `consumer hardware`, `smart home`
- Other written text -> preserve as extra `domains` or `focusKeywords`

Map style answers to `curationStyle`:

- 创新优先 -> `innovation`
- 热门优先 -> `popular`
- 实用优先 -> `practical`
- 奇怪有趣优先 -> `weird`
- 平衡 -> `balanced`

## Config

After the user answers, write:

```json
{
  "language": "zh",
  "projectFormats": ["web apps", "browser extensions", "AI tools"],
  "domains": ["productivity", "creator tools", "design"],
  "curationStyle": "innovation",
  "lookbackHours": 72,
  "maxCandidates": 36,
  "focusKeywords": [],
  "blockedDomains": [],
  "sourceOptions": {}
}
```

Store it at `~/.cool-project-radar/config.json`.

Then say:

```text
设置完成。之后你可以直接这样调用：
- 跑一下过去 24 小时的新项目雷达
- 找过去一周里偏创新的浏览器插件和 AI 工具
- 只看 Product Hunt 和 GitHub 上的创作者工具
- 这次偏向 local-first / 隐私 / 小而美项目
```

Do not copy another user's personal taste profile, private examples, email settings, or automation memory into the public config.
