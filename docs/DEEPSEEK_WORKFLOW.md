# dsh / DeepSeek MCP 委派协作

用户要求以节省 Codex 额度的方式继续：Codex 负责拆任务、审查与验收；DeepSeek 通过本机 dsh 执行实现和补测试。

## MCP 工作方式（2026-11-13）

- 本机服务 `dsh-deepseek`：`C:/Users/Mr.wang/AppData/Local/dsh-deepseek-mcp/server.mjs`，位于游戏工程外。
- 五个工具：`delegate_task`、`get_task_status`、`get_task_result`、`continue_task`、`cancel_task`。默认只读；实现任务显式使用 `permission_mode: workspace-write`。
- 工作目录固定 `E:/A-game`。当前对话尚未暴露原生 MCP 工具时，监督者通过官方 MCP SDK 的 stdio 客户端连接同一个服务，仍按 MCP 协议提交、查询和继续任务，不直接绕过服务调用 dsh。
- 已实际委派 1.2 实现并用同一会话返工。首次实现返回退出码 0、`final_reason: completed`；监督者另行核对文件和检查结果。服务的 `verified_success` 只证明进程正常完成，不能当成产品测试通过。
- 任务状态只存在于该服务进程内。监督者保持客户端连接直到审查完成，避免中途关闭客户端导致无法查询；不要并发启动多个修改同一文件的任务。
- 本轮源码基线保存在忽略目录 `temp/baseline-1-2-mcp`，MCP 请求与结果保存在 `temp/mcp-supervisor-log.jsonl`。不把整段聊天、凭据或无关私有文件发送给执行者。
- dsh 的子进程沙箱可能限制 Vitest worker 或已有构建输出的写入。执行者需准确报告；监督者在本机重新运行项目规定的原始检查命令，再运行 Creator 构建和正式客户端 UI 检查。

## 本机已验证（2026-11-12）

- 启动器：`C:/Users/Mr.wang/AppData/Local/deepseek-harness/bin/dsh.cmd`，版本 0.2.2-rc.1。
- 使用 `.cmd`：本机 PowerShell 默认解析到 `.ps1`，该包装器在当前管道环境会过早结束，导致空输出或 EPIPE；`.cmd` 已能正确等待并捕获结果。未修改安装文件。
- `headless` 支持一次性任务、stdin、`--json` 事件流和 `--session-id` 延续。
- 已通过只读连通测试；另在 `E:/A-game/temp` 工作目录，以 workspace-write 实际调用原生文件工具创建校验文件，监督者读取后确认内容完全一致。两次成功调用均退出码 0 且 final.reason.kind=completed。
- 凭据由 dsh 自己读取现有保存项。headless 默认禁用保存凭据，需要临时 overlay；不读取、打印或复制密钥，不修改常驻配置。

## 临时配置与调用

在忽略目录 `temp/dsh-use-saved-auth.patch.yml` 创建以下非敏感内容：

```yaml
- id: credentials
  disabled: false
- id: authorization
  disabled: false
- id: deepseek-account
  disabled: false
```

从任务工作目录调用，参数示例：

```powershell
& 'C:/Users/Mr.wang/AppData/Local/deepseek-harness/bin/dsh.cmd' --profile headless --patch E:/A-game/temp/dsh-use-saved-auth.patch.yml --json --permission-mode workspace-write --approval-policy never -
```

通过 stdin 传入范围明确的任务；stdout/诊断保存到忽略目录。只读审查用 read-only。继续同一任务时使用事件流给出的准确 sessionId，保持相同工作目录，并再次提供临时配置与权限参数。额外根目录、shell 测试或 Creator 在该权限模式下尚未专门验证；失败时保留日志，由监督者判断和运行必要检查。

## 监督规则

1. 不把整段聊天历史交给 worker。只提供目标、相关文件、允许改动范围、AGENTS.md 和验收标准。
2. 工程已有未提交内容。先记录差异基线；需要隔离时准备包含当前工作内容的副本，不能只按旧 HEAD 开分支而遗漏已完成内容。
3. worker 以小批次实现/补测，报告修改文件、实际测试命令、退出码、日志和未完成项。禁止自行 reset、clean、提交、推送或上传。
4. 只有进程退出码 0 且 final.reason.kind=completed 才算运行结束；结束不等于任务验收通过。监督者核对实际 diff、资源和关键测试，问题用同一 Session 限定范围返工。
5. Codex 的指挥、工具调度和审查仍消耗本侧额度；实现部分使用 dsh 已配置的 DeepSeek API 额度。避免重复全量扫描和无必要的测试重跑。

最初的连通/写入测试只修改临时校验文件。后续 1.2 游戏实现已通过 MCP 委派，具体改动与验收见 `PLAYFUL_1_2.md`。没有修改常驻 dsh 设置或读取 API 密钥。
