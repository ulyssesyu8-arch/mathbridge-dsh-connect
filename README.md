# MathBridge Connect for DSH

把课程网站的一段连接指令粘贴给自己的 DeepSeek Harness，连接数学老师。

## 学生使用

1. 打开并登录 Windows DSH 桌面版。
2. 在 [MathBridge](https://minemath-academy-bridge.ulyssesyu8.chatgpt.site/?personal_tutor=1&tutor_provider=dsh#classroom) 点击“复制连接指令”。
3. 粘贴到 DSH 并发送，按必要提示批准安装，回网站等待“已连接”。若提示重新打开 DSH，保存工作后重开一次。

无需克隆仓库、填写 API Key 或编辑 YAML。第一次可直接由粘贴的指令读取 Skill；也可将本仓库的 SKILL.md bundle 安装为 DSH 本地 Skill。GitHub URL 本身不自动安装 Skill。

## 范围与权限

连接插件 **0.2.2**；安装器核验 **Windows DSH 0.2.1-rc.2**。模型、图片能力与额度由学生的 DSH 官方账号提供，不回退 API Key。

安装器校验版本及 SHA-256，通过 DSH 官方 CLI 安装插件和独立配置 bundle。DSH 的安装批准不能绕过。插件只主动访问固定 MathBridge HTTPS 地址，不开放电脑入站端口，也不提供 owner RPC、终端或文件工具。教学会话禁用工具。

网站短期转发学生主动发送的内容，DSH 保留独立教学历史。断开只撤销桥接凭证，不删除 DSH 记录。平台登录凭证始终留在 DSH。

## 内容

- SKILL.md：连接与修复流程
- scripts/：固定哈希的 Windows 安装器
- plugin/：无第三方运行依赖的连接插件
- release/：安装包与校验信息

本机 Windows DSH 0.2.1-rc.2 已通过正式公网服务的真实文字、图片题和同一教学会话追问验证。0.2.2 修复配置包安装及本地/公网双实例重复注册问题。尚未完成干净电脑安装、模型自主执行完整 Skill 与语音转写验收。License: MIT.
