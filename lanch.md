# 服务启动与日志查看

服务器部署目录：

```bash
/opt/auto-paypal
```

服务由 systemd 管理，服务名：

```bash
auto-paypal.service
```

## 查看服务状态

```bash
systemctl status auto-paypal.service --no-pager
```

只看是否运行：

```bash
systemctl is-active auto-paypal.service
```

返回 `active` 表示服务正在运行。

## 启动服务

```bash
sudo systemctl start auto-paypal.service
```

## 重启服务

修改代码或 `.env` 后，使用：

```bash
sudo systemctl restart auto-paypal.service
```

## 停止服务

```bash
sudo systemctl stop auto-paypal.service
```

## 查看实时日志

```bash
journalctl -u auto-paypal.service -f
```

## 查看最近日志

最近 100 行：

```bash
journalctl -u auto-paypal.service -n 100 --no-pager
```

最近 300 行：

```bash
journalctl -u auto-paypal.service -n 300 --no-pager
```

## 确认端口监听

当前服务端口来自 `/opt/auto-paypal/.env`：

```env
PORT=61230
```

检查端口：

```bash
ss -ltnp | grep 61230
```

## 访问后台

```text
http://35.212.142.36:61230/admin-login
```

后台密码在：

```bash
/opt/auto-paypal/.env
```

查看：

```bash
cd /opt/auto-paypal
cat .env
```

## 不要重复手动启动

如果 systemd 服务已经运行，不要再执行：

```bash
node server.js
```

否则会启动第二份服务，和已有服务抢占同一个端口，常见错误：

```text
Error: listen EADDRINUSE: address already in use :::61230
node:events:502
```

如果确实要手动调试，先停掉 systemd 服务：

```bash
sudo systemctl stop auto-paypal.service
cd /opt/auto-paypal
node server.js
```

调试结束后，按 `Ctrl+C` 停止手动进程，再恢复 systemd：

```bash
sudo systemctl start auto-paypal.service
```

## 常见提示

### IMAP 启动预刷新失败

如果日志出现：

```text
[IMAP] 启动预刷新失败: getaddrinfo ENOTFOUND imap.chiyiyi.cloud
No IMAP credentials configured. IMAP features will be disabled.
```

含义是随机邮箱/远程 IMAP 相关功能不可用或域名无法解析。它通常不代表主服务启动失败。

当前部署已改为：只有配置了 `IMAP_ADMIN_PASSWORD` 时，才会在启动时自动请求远程 IMAP 管理 API；未配置时不会再主动请求 `imap.chiyiyi.cloud`。

当前服务器只使用邮箱池模式。邮箱池验证码读取使用后台系统配置中的：

```text
pool_email_imap_host=outlook.office365.com
```

注册和协议提取阶段都会使用同一套邮箱池凭证。邮箱池不可用时任务会直接失败，不再回退到 random 随机邮箱或源码默认服务器。

服务启动时也不会再初始化未配置凭证的远程 IMAP 管理功能，因此邮箱池模式下不应再出现 `No IMAP credentials configured. IMAP features will be disabled.`。

### 端口被占用

如果手动启动时报：

```text
EADDRINUSE
```

先检查 systemd 是否已运行：

```bash
systemctl status auto-paypal.service --no-pager
```

如果已经是 `active (running)`，直接用 systemd 管理，不要再手动 `node server.js`。

### Playwright 浏览器不存在

如果任务日志出现：

```text
browserType.launch: Executable doesn't exist at /home/seal/.cache/ms-playwright/...
Looks like Playwright was just installed or updated.
Please run the following command to download new browsers:
    npx playwright install
```

说明项目依赖里的 Playwright 版本和服务器缓存的浏览器版本不匹配，或浏览器缓存缺失。

处理方式：

```bash
cd /opt/auto-paypal
npx playwright install chromium
sudo systemctl restart auto-paypal.service
```

确认浏览器是否已安装：

```bash
ls -la /home/seal/.cache/ms-playwright
```

如果 Linux 系统依赖也缺失，再执行：

```bash
cd /opt/auto-paypal
npx playwright install --with-deps chromium
```
