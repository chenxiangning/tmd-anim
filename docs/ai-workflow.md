# AI 工作流:用 agent 制作与调整动画

> tmd-anim 的差异化主线:场景 JSON 是面向 coding agent 的协议。本文是 AI 闭环的
> 权威说明;协议本身见 [schema.md](./schema.md)。

## 结论

任何能在本机读写文件的 agent(omp / Claude Code / ZCode / tmd-cli 托管的 CLI)都
可以直接制作和修改动画,闭环四件:协议材料投递、文件热重载、单帧截图、校验 CLI。
对话入口推荐放在 tmd-cli(会话工作台)或终端,tmd-anim 只做「AI 调整」一键复制
prompt;不内嵌 PTY 终端(避免复刻 tmd-cli 会话子系统)。

## 闭环

```
agent 读协议(~/.tmd-anim/protocol/)
  → 写/改 ~/.tmd-anim/projects/<id>.json
  → pnpm anim validate 自查
  → tmd-anim 桌面版 watch 热重载,画布自动更新
  → 「导出帧」出 PNG,agent 读图回看(无视觉的模型走 glm-vision 等外部识图)
  → 继续调整
```

## 应用侧机制

| 机制 | 行为 |
|---|---|
| 协议投递 | 桌面版启动时把 `docs/schema.md` 与 `src/samples/bpe.json` 同步到 `~/.tmd-anim/protocol/schema.md`、`bpe-example.json`(内容不同才覆写);agent 在任意目录可读 |
| watch 热重载 | 编辑器打开期间监听项目文件,外部变更 300ms 防抖后与当前内容归一化比对,不同才重载(编辑器自己的保存因内容相同被闸掉);浏览器版无此机制 |
| 导出帧 | 编辑器「导出帧」按钮:当前播放头单帧 PNG,落 `~/.tmd-anim/frames/<id>-<秒>s.png` 并同时走浏览器下载 |
| 校验 CLI | tmd-anim 仓内 `pnpm anim validate <file...> [--json]`:结构解析 + 统计 + lint(未知 kind、连线悬空引用、坐标越界、负 start);警告不挡 exit 0,结构错误 exit 2 |
| AI 调整 | 编辑器「AI 调整」按钮弹出引导:提示词块一键复制(带项目路径与协议路径,均按当前系统渲染为绝对路径,Windows 亦然),粘贴到任意 agent 会话即可开跑 |
| 技能安装 | 「AI 调整」弹窗内可一键把指路技能(docs/skill.md)写入当前用户主目录下的 `.claude/skills/tmd-anim/` 与 `.agents/skills/tmd-anim/`;显式点按才执行,不触及用户其他技能;弹窗打开即逐目标检查并展示按当前用户与系统解析的实际路径,已装区分「已是最新 / 有新版可覆盖」,安装结果区分新建与覆盖更新;技能正文以 docs/skill.md 为模板,`{{…}}` 占位符安装时替换为当前系统绝对路径(Windows 得 `C:\Users\…` 形态),指向 `.tmd-anim/protocol/`,升级后重装即刷新 |

## agent 工作流(推荐)

1. 读 `~/.tmd-anim/protocol/schema.md` 与 `bpe-example.json`。
2. 新建:`~/.tmd-anim/projects/` 下落一个 `<id>.json`(id 只要不重名即可,如
   `p_agent_<时间戳>`);修改:直接改目标项目文件。
3. 自查:`pnpm anim validate <文件>`(需 tmd-anim 仓;警告逐条看,多为坐标越界)。
4. 让用户在 tmd-anim 里看效果(已打开则自动热重载),按反馈迭代。
5. 归一化是宽容的:缺字段/类型跑偏会补默认值照常播放;但 validate 会把被静默
   修正的地方报出来,建议按报告收敛。

## 与 tmd-cli 的联动

tmd-cli 侧 `anim` 插件(src/plugins/anim/):项目列表 tab + 「打开」(拉起
tmd-anim,当前落到主页)+「AI 会话」(以 `~/.tmd-anim/projects` 为 cwd 拉起默认
CLI 并注入初始 prompt)。

## 边界与后置项

- 浏览器版(localStorage 后端)没有文件契约,闭环仅覆盖桌面版。
- tmd-anim 深链打开指定项目(single-instance + argv)后置;当前「打开」落到主页。
- node 侧无头渲染单帧(`@napi-rs/canvas`)后置,当前回看靠应用内导出帧。
- 站内对话层按 L0(复制 prompt)落地;oneshot 聊天面板仅在 L0 手感不足时考虑。
