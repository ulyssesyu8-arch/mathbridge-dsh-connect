# MathBridge DSH connector

Desktop integration, version 0.2.2. Install this bundle in an existing DeepSeek Harness desktop profile. Reference version: DSH 0.2.1-rc.2; other versions have not been verified. The MathBridge website supplies a one-copy installation/pairing instruction and a pinned, checksum-verified Windows installer.

On Windows, the public bridge honors DSH's explicit proxy environment. When none is configured, it reads the existing Windows per-URL proxy policy and uses DSH's bundled HTTP implementation in a connection-scoped dispatcher. It does not change system proxy settings or the global DSH dispatcher. TLS checks and the fixed MathBridge destination remain enforced.

Supported destinations are exactly `http://127.0.0.1:4173/api/dsh-tutor/bridge/` and `https://minemath-academy-bridge.ulyssesyu8.chatgpt.site/api/dsh-tutor/bridge/`. Pairing uses a fresh one-time 64-character code from that course. The installer manages a separate app-owned configuration bundle through the official CLI. No model API keys or DSH owner tokens belong in its configuration.

The plugin uses public `agents`, scoped `tools`/`systemPrompt`, `sessionTitle`, `workspaceRegistry`, `sessionPersistence`, `llm`, `attachments`, `deepseekAccount` and `credentials` services. It creates persistent `mathbridge_tutor_…` sessions in the MathBridge workspace. Only the official `deepseek-account` route is allowed. Tool execution is denied; only committed assistant text is returned. Account-state and identity notifications dispose prior teaching scopes and change the connection identity; stale queued requests cannot execute on the new account.

The bridge is outbound-only and limited to the exact allowlisted local/HTTPS destinations. Platform credentials remain with DSH. The dedicated bridge credential is stored with DSH credentials; the gateway stores its hash. No arbitrary shell, filesystem, owner RPC, URL, MCP command or session-list operation exists in the bridge protocol. Public pairing is browser/session scoped and selected learner partitions remain separate. The relay temporarily handles sent questions, images and answers; it does not provide end-to-end encryption. Completed/cancelled image rows are removed, expired data is unreadable and lazily cleaned on subsequent traffic.

Disconnect in MathBridge to revoke this browser's pairing. Removing or unloading the bundle closes only its live teaching agents, preserving DSH session logs and attachments. Manage retained records with DSH's own supported controls; shared attachments are not automatically erased.

Uninstall through DSH's plugin manager, or `dsh plugin --profile desktop remove mathbridge-dsh-connect`. Remove the optional `mathbridge-connect` override from `cordis.patch.yml` afterwards. Do not remove the DSH home directory or other credentials.

Contract tests are not proof of a real account or image inference. See the parent application's `DSH-CONNECT.md` and separate local verification report.
