# Project release workflow

代码更新完成后，按以下顺序同步 GitHub 与 npm。不要在仓库、命令参数或日志中保存 GitHub token、npm OTP、API Key。

## 常规发布

1. 验证代码和工作树：

   ```bash
   npm run verify
   npm audit --omit=dev
   git status --short
   ```

2. 按变更类型升级版本（通常使用 `patch`），更新 `CHANGELOG.md`，再提交版本：

   ```bash
   npm version patch --no-git-tag-version
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore: release v<version>"
   git tag -a v<version> -m "v<version>"
   ```

3. 推送到 `xuanfengtechx`。本机存在多个 GitHub 账号时，不要依赖默认 SSH key 或系统 HTTPS 凭据；显式读取该账号的 `gh` token，仅以内存变量传给本次 Git 命令：

   ```bash
   XUANFENG_GH_TOKEN=$(env -u GH_TOKEN -u GITHUB_TOKEN gh auth token --hostname github.com --user xuanfengtechx)
   XUANFENG_GH_BASIC=$(printf 'x-access-token:%s' "$XUANFENG_GH_TOKEN" | base64)
   git -c credential.helper= -c http.https://github.com/.extraheader="AUTHORIZATION: basic $XUANFENG_GH_BASIC" push origin main
   git -c credential.helper= -c http.https://github.com/.extraheader="AUTHORIZATION: basic $XUANFENG_GH_BASIC" push origin v<version>
   unset XUANFENG_GH_TOKEN XUANFENG_GH_BASIC
   ```

4. 使用同一 GitHub 账号创建 Release，release notes 概括功能变化、修复和验证结果：

   ```bash
   XUANFENG_GH_TOKEN=$(env -u GH_TOKEN -u GITHUB_TOKEN gh auth token --hostname github.com --user xuanfengtechx)
   GH_TOKEN="$XUANFENG_GH_TOKEN" gh release create v<version> --repo xuanfengtechx/dsh-openrouter-provider-advisor --title "v<version>" --notes "<release notes>"
   unset XUANFENG_GH_TOKEN
   ```

5. 发布 npm。授权方式为已登录的 npm 账号配合发布时生成的一次性网页 2FA，不在项目中保存 token 或 OTP。若返回 `EOTP`，打开终端本次输出的完整 `https://www.npmjs.com/auth/cli/<id>` 地址完成授权，然后重新执行发布；不要使用被脱敏或上一次生成的链接：

   ```bash
   npm publish --access public
   ```

6. 最终核验 GitHub、Release 和 npm 版本一致：

   ```bash
   git status --short
   git log -1 --oneline
   npm view dsh-openrouter-provider-advisor version dist-tags --json
   ```
