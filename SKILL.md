---
name: mathbridge-connect
description: Connect or repair the MathBridge course AI teacher in DeepSeek Harness desktop. Use when a student pastes a MathBridge connection instruction or asks to connect the MathBridge website, install its connector, or fix its pairing. Handle installation and pairing for the student instead of asking them to locate files or edit configuration.
---

# MathBridge Connect

Connect the student's existing Windows DSH desktop to their own MathBridge browser session. The student should only paste the website's instruction and approve DSH's necessary installation prompts.

## Read the pasted instruction

It supplies the course origin, a five-minute one-time pairing code, the installer URL, and the installer's SHA-256. Accept only:

- `https://minemath-academy-bridge.ulyssesyu8.chatgpt.site`
- `http://127.0.0.1:4173` for explicitly local testing

The pairing code is exactly 64 lowercase hexadecimal characters. A URL alone does not grant account or computer access. If the instruction expired, ask the student to click the website's fresh-instruction button; do not ask them to invent a code.

## Install and pair

1. Explain briefly: “我来安装并连接；如果 DSH 弹出安装批准，请点允许。” Use the student's language.
2. Use DSH's existing file/network/command tools to download the exact installer from the accepted course origin to a local file. Do not use `Invoke-Expression`, pipe network text into a shell, disable TLS verification, or follow an unexpected redirect. Check the file's SHA-256 against the pasted instruction before execution.
3. Run the downloaded file using PowerShell:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<downloaded installer>" -PairingCode '<code from website>' -CourseOrigin '<accepted origin>'
   ```

   The installer locates the desktop CLI, checks the verified DSH version, downloads and verifies the pinned connector, and installs a separate configuration bundle through the official plugin CLI. It does not require the course source code, system Node, a model API key, or hand-edited profile YAML.
4. Preserve DSH approvals. If the current mode cannot run installation tools, give the single necessary instruction to switch to Creator or approve the installer. Never bypass permission checks, approve dependency build scripts, install another DSH instance, grant version exemptions, or kill/restart the student's desktop process.
5. Inspect the installer output. `MATHBRIDGE_CONNECTED` means the site received a paired plugin heartbeat and at least one account model. `MATHBRIDGE_PAIRED_NO_MODELS` means the plugin paired but DSH sign-in/model availability still needs attention. `MATHBRIDGE_WAITING` means installation completed but activation is unverified: ask the student to save their work and reopen DSH only if needed, then check again. An exit code alone is not connection proof.

## Keep the student out of setup details

Perform supported steps yourself. Do not ask the student to find install folders, paste terminal commands, edit YAML, supply API keys, copy DSH login tokens, or run a local course server. The HTTPS website remains open; the installed plugin connects outward automatically while DSH runs. Once connected, say: “已连接，回到课程网站就可以圈图提问了。”

The connector uses the student's official DSH account route and independent MathBridge history. Usage allowance is governed by DSH. Do not silently switch providers or use an API key. Do not read `.credentials.yaml`, other conversations, production databases, or DSH owner RPC. The installation session can use installation tools; the teaching session denies tools.

## Repair

For a newly generated pairing instruction, rerun the same verified installer with its fresh code. It replaces only MathBridge's app-owned connection settings and retains DSH records. For unsupported DSH versions, report the detected version and stop without changing the profile. For network or checksum failures, stop with a short actionable explanation; never substitute another download source.

Source and installer are versioned together at `/connect/0.2.1/`. The course website's “断开 DSH 连接” revokes its bridge credential. Closing the page or uninstalling the connector does not delete DSH teaching history.
