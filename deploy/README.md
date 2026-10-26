# Deploying to an Alibaba Cloud server

This guide takes the DIC website and its API (Registration, Team-up, the
organisers' page) from nothing to live on **www.nyushdic.com**, on a server
rented from Alibaba Cloud. Most steps are clicks in the Alibaba Cloud console
(its Chinese menu names are given in brackets); a few are commands.

Time needed: about half a day of work, plus 1–3 days of waiting for
Alibaba's identity checks if anyone involved hasn't done them before.

```
visitors ──► www.nyushdic.com ─┐
             api.nyushdic.com ─┴──► Alibaba Cloud server, Hong Kong
                                     Caddy (HTTPS) ──► the website's files
                                                   └─► the DIC API (Node + SQLite)

push to main on GitHub ──► GitHub Actions builds the site and copies it,
                           with the API, to the server, then restarts it
sign-in codes ──► Alibaba Cloud DirectMail (邮件推送) ──► participants' inboxes
```

The files this guide uses are in this folder:

| File | What it is |
|---|---|
| `setup.sh` | One-time setup of the server: Docker, a `deploy` user, folders, settings, swap, nightly backup. |
| `compose.yaml` | The two programs that run on the server: **web** (Caddy) and **api**. |
| `Caddyfile` | Caddy's settings: the website, the redirect from `nyushdic.com` to `www`, and `api.`. |
| `backup.sh` | Copies the database every night; also explains how to restore. |
| `../.github/workflows/deploy-server.yml` | Builds and deploys on every push to `main`. |

---

## 0. Two things to know first

### nyushdic.com already exists, and it has expired

`nyushdic.com` was registered at Alibaba Cloud (万网) on **12 Oct 2023** by an
account based in Shanghai, most likely a DIC organiser at the time. It
**expired on 12 Oct 2026**, and Alibaba has switched it to its "expired"
holding servers, so the old address doesn't load any more.

Only the account that holds it can renew it. After expiry, Alibaba lets that
account renew at the normal price for a limited time (about 30 days, so until
around **11 Nov 2026**; the exact date is shown in that account's domain
console). After that comes a redemption period with a large fee, and then the
domain is deleted and anyone can register it, including domain resellers.

**What to do now:**

1. Find who registered it. Ask the 2023–24 organisers, and search the
   shanghai.dic@nyu.edu inbox for emails from Alibaba Cloud (阿里云) such as
   "域名到期提醒".
2. They sign in to aliyun.com → Domain console (域名控制台) → find
   nyushdic.com → Renew (续费), for 3 years or more → turn on auto-renew
   (自动续费).
3. Move the domain into the club's own account (step 1 below), so it no longer
   depends on one person: Domain console → Domain transfer (域名转移) →
   transfer between Alibaba Cloud accounts (阿里云账号间转移), entering the club
   account's ID. It's free. If the registered holder should change too, use
   Change of holder (过户).

**If nobody can be found in time,** register another name now. These were free
on 23 Oct 2026: `nyush-dic.com`, `dicnyush.com`, `nyushdic.net`,
`nyushdic.org`. Everything below works with any domain: just replace
`nyushdic.com` (and see "Using a different domain" at the end).

### Use Hong Kong, not mainland China

A server in mainland China can't serve a website on its domain until the
domain has an **ICP filing (ICP备案)**. That takes 1–4 weeks, needs an eligible
applicant, then a public-security filing (公安备案) within 30 days, and
filings for individuals restrict interactive features such as Team-up's
channels. It cannot be finished before Kick-off Day (9 Nov).

A **Hong Kong** server needs no ICP filing, is close to Shanghai, and can reach
GitHub and Docker Hub without mirrors. This guide uses Hong Kong. Moving to the
mainland later is covered in step 12.

---

## 1. An Alibaba Cloud account for the club

1. Sign up at **aliyun.com** (the Chinese site, where nyushdic.com is
   registered). Use contact details the club keeps from year to year, not a
   personal account that leaves when its owner graduates.
2. Complete identity verification (实名认证). It's required before buying
   anything. Individual verification (个人认证) through Alipay is quickest.
3. Add a payment method (Alipay) and turn on two-step verification (MFA) under
   Security settings (安全设置).
4. Record who owns the account and where its sign-in details are kept in the
   club's handover notes.

## 2. The domain

**If you renewed nyushdic.com** (step 0): once it's in the club account, open
Domain console → nyushdic.com → DNS servers (DNS 修改), and make sure it
uses Alibaba Cloud DNS (`dns*.hichina.com`, not `expirens*`).

**If you're registering a new domain:**

1. Go to Domain registration (域名注册), search for the name and buy it for 3–5
   years with auto-renew on.
2. Create a holder profile (信息模板) and get it verified (实名认证): an ID
   photo of the holder. Approval takes 1–3 working days. Until then the
   domain won't resolve.
3. The domain uses Alibaba Cloud DNS (云解析 DNS) by default.

## 3. Rent the server

1. Open **Simple Application Server (轻量应用服务器)** → Create (创建服务器).
   It's simpler and cheaper than ECS, with a fixed monthly price that includes
   traffic.
2. **Region:** China (Hong Kong) (中国香港).
3. **Image:** OS image (系统镜像) → **Ubuntu 24.04**.
4. **Plan:** 2 vCPU / 2 GB RAM is plenty for the site, the API and the
   database. Hong Kong plans cost a few dozen yuan a month; check the console
   for current prices.
5. **Duration:** until at least April 2027 (Innovation Day), with auto-renew
   on.
6. After it's created, open the server's page and note its **public IP
   address (公网 IP)**. Under Remote connection (远程连接), set a root password
   (重置密码) or bind an SSH key.
7. **Firewall (防火墙)** tab → add rules for **TCP 80**, **TCP 443** and **UDP
   443**. TCP 22 (SSH) is open by default.

## 4. Point the domain at the server

Open **Cloud DNS (云解析 DNS)** → nyushdic.com → Add record (添加记录), three
times:

| Host (主机记录) | Type (记录类型) | Value (记录值) |
|---|---|---|
| `@` | A | the server's IP |
| `www` | A | the server's IP |
| `api` | A | the server's IP |

Within a few minutes, `nslookup www.nyushdic.com` (in PowerShell or a
terminal) should show the server's IP.

## 5. Make a deploy key (on your computer)

GitHub signs in to the server with this key to copy updates. In PowerShell or
a terminal:

```bash
ssh-keygen -t ed25519 -f dic-deploy -N "" -C dic-deploy
```

This makes two files: **`dic-deploy`** (private: goes into GitHub, step 8) and
**`dic-deploy.pub`** (public: goes onto the server, step 6). Keep them out
of the repository.

## 6. Set up the server (once)

From a terminal in this repository's folder (PowerShell works; `ssh` and
`scp` are built into Windows):

```bash
scp deploy/setup.sh root@SERVER_IP:
ssh root@SERVER_IP
```

Now you're on the server. Run the script with your domain, an email for
certificate notices, and the **contents** of `dic-deploy.pub` (open it in a
text editor and copy the single line):

```bash
bash setup.sh nyushdic.com shanghai.dic@nyu.edu "ssh-ed25519 AAAA…  dic-deploy"
```

It installs Docker, creates a `deploy` user that accepts the key, makes
`/opt/nyushdic` with starting settings (`api.env`, with a fresh secret, and
`site.env`), adds swap, and schedules the nightly backup. It's safe to run
again.

(No terminal? The console's Remote connection (远程连接) opens one in the
browser; paste the contents of `setup.sh` into a file there. If bash
complains about `$'\r'`, the file got Windows line endings on the way; fix it
with `sed -i 's/\r$//' setup.sh`.)

Then, **back on your computer**, record the server's identity for GitHub:

```bash
ssh-keyscan -t ed25519 SERVER_IP
```

Copy the line it prints (starting with the IP) for step 8.

## 7. Sign-in emails: DirectMail (邮件推送)

Participants sign in with a code sent by email. Alibaba Cloud DirectMail
delivers well to Chinese mailboxes (QQ, 163) as well as to nyu.edu.

1. Open **DirectMail (邮件推送)** and choose the region **China East 1
   (Hangzhou) (华东1 杭州)**. It must match `ALIYUN_DM_REGION=cn-hangzhou` in
   `api.env`.
2. **Sending domains (发信域名)** → Create → `mail.nyushdic.com`. A subdomain
   keeps email separate from the website. The console lists DNS records:
   ownership (TXT), SPF (TXT), MX and DKIM (TXT); add DMARC (TXT) too if
   offered. Add each one in **Cloud DNS** exactly as shown, then click Verify
   (验证) until every row passes.
3. **Sender addresses (发信地址)** → Create → `noreply@mail.nyushdic.com`,
   type **Triggered emails (触发邮件)**, which is what sign-in codes are.
4. Make a key that can **only send mail**: **RAM (访问控制)** → Users (用户) →
   Create user (创建用户) named `dic-mail`, with **OpenAPI access (OpenAPI 调用访问)**
   ticked. Copy the AccessKey ID and Secret (the Secret is shown only once).
   Then Add permissions (添加权限) → **AliyunDirectMailFullAccess**.
5. Put the key on the server:

   ```bash
   ssh root@SERVER_IP
   nano /opt/nyushdic/api.env
   ```

   Fill in `ALIYUN_ACCESS_KEY_ID` and `ALIYUN_ACCESS_KEY_SECRET`. Check that
   `EMAIL_FROM` matches the sender address, and list the organisers in
   `ADMIN_EMAILS` (comma-separated): these addresses get the admin page.
   Save with Ctrl+O, Enter, Ctrl+X.

DirectMail has a free daily allowance and costs very little beyond it (see its
pricing page). (Alternatively, `EMAIL_PROVIDER=resend` works too; see
`server/.env.example`.)

## 8. Connect GitHub and deploy

In the GitHub repository: **Settings → Secrets and variables → Actions**.

| Kind | Name | Value |
|---|---|---|
| Variable | `DEPLOY_HOST` | the server's IP |
| Variable | `DEPLOY_USER` | `deploy` |
| Secret | `DEPLOY_SSH_KEY` | the whole contents of `dic-deploy` (including the BEGIN and END lines) |
| Secret | `DEPLOY_KNOWN_HOSTS` | the line from `ssh-keyscan` (step 6) |

Then **Actions → Deploy to the DIC server → Run workflow** (branch `main`).
It takes a few minutes: it builds the website, copies it and the API to the
server, and starts both. On first start, Caddy fetches HTTPS certificates
(this needs the DNS records from step 4).

Check:

- https://www.nyushdic.com shows the site, and https://nyushdic.com
  redirects to it;
- https://api.nyushdic.com/api/health shows `{"ok":true,…}`.

From now on, **every merge to `main` deploys automatically**, to the server and
to GitHub Pages as before.

## 9. Switch on Registration and Team-up

In `_data/dic2026.yml`, set:

```yaml
platform:
  api_url: "https://api.nyushdic.com"
```

Merge that to `main`. The Registration and Team-up tabs go live, and the DIC
2026 page's sign-up section points to them.

## 10. Test before announcing

Do these on a phone **without a VPN**, on mobile data and on campus Wi-Fi:

- [ ] Register with your own email; the code arrives within a minute (check
      spam). Try a QQ or 163 address too.
- [ ] Create a team; a second person joins with the invite link; both submit.
- [ ] Post a Team-up card, reply to one, send a channel message.
- [ ] Open the site from WeChat (paste the link in a chat) on iOS and Android.
- [ ] Sign in at `/DIC2026/admin/` with an `ADMIN_EMAILS` address, and
      download the Excel file.

## 11. Running it

| Task | How |
|---|---|
| Update the site or API | Merge to `main`. The workflow deploys. |
| Change a setting | `ssh root@SERVER_IP`, edit `/opt/nyushdic/api.env`, then `cd /opt/nyushdic/deploy && docker compose up -d` |
| Change the domains | Edit `/opt/nyushdic/site.env`, then `cd /opt/nyushdic/deploy && docker compose up -d --force-recreate web` |
| See what's happening | `cd /opt/nyushdic/deploy && docker compose logs -f api` (or `web`) |
| Restart | `cd /opt/nyushdic/deploy && docker compose restart` |
| Backups | Every night at 04:00, into `/opt/nyushdic/backups` (kept 14 days). Copy one off the server now and then: `scp root@SERVER_IP:/opt/nyushdic/backups/dic-….sqlite .` Restoring is described in `backup.sh`. |
| Renewals | Server and domain renew automatically if auto-renew is on and the payment method works. Note the dates in the handover notes. |
| System updates | Ubuntu installs security updates by itself. Reboot from the console every few months. |

**Troubleshooting**

- **A domain isn't served after changing `site.env` or the Caddyfile** (no
  certificate, or the browser can't connect): Caddy is still on its old
  settings. Run `docker compose up -d --force-recreate web`, then
  `docker compose logs web` to watch it get the certificates.
- **No HTTPS / certificate errors:** the DNS records don't point to the server
  yet, or ports 80/443 aren't open in the Firewall tab. Run
  `docker compose logs web` to see why.
- **"Can't reach the server" on the site:** `platform.api_url` is wrong, or
  `api.nyushdic.com` doesn't resolve. Check https://api.nyushdic.com/api/health.
- **API refuses the website ("not allowed"):** add the site's exact address to
  `ALLOWED_ORIGINS` in `api.env`, then `docker compose up -d`.
- **Codes don't arrive:** check the domain still verifies in DirectMail, then
  DirectMail → Sending data (发送数据). The API logs show the error
  (`docker compose logs api`).
- **The workflow fails at "Copy":** check the four GitHub settings. Test with
  `ssh -i dic-deploy deploy@SERVER_IP` from your computer.

## 12. Later

- **The GitHub Pages copy** (geemir.github.io/NYUSH-DIC-Official-Website)
  keeps working and uses the same API, which makes it a handy second copy. It's
  already in `ALLOWED_ORIGINS`.
- **A mainland server.** Buy a mainland server (at least 3 months), file for ICP
  through Alibaba Cloud's filing system (ICP备案), add the public-security
  filing within 30 days, and show the ICP number in the site footer. Then run
  `setup.sh` there (with Docker's `--mirror Aliyun`, see the comment in it,
  plus a Docker Hub mirror), and change the DNS records to the new IP.
- **The assistant** uses DeepSeek. Get an API key at platform.deepseek.com
  (and top up the balance), then add to `/opt/nyushdic/api.env`:

  ```
  BOT_PROVIDER=deepseek
  DEEPSEEK_API_KEY=sk-…
  BOT_KNOWLEDGE_URL=https://www.nyushdic.com/assets/dic2026/knowledge.txt
  ```

  and run `docker compose up -d`. The "Ask DIC" button appears by itself
  (`platform.chatbot` is already `true`). Public generative AI services hosted
  in the mainland would need their own filing; this server is in Hong Kong.

### Two domains (nyushdic.com and nyushdic.club)

One domain is the main one; the other just forwards to it. With
`nyushdic.com` as the main domain:

1. **DNS:** both domains get the same three A records (`@`, `www`, `api`)
   pointing to the server.
2. **`/opt/nyushdic/site.env`:**

   ```
   DOMAIN=nyushdic.com
   ACME_EMAIL=shanghai.dic@nyu.edu
   EXTRA_HOSTS=nyushdic.club www.nyushdic.club
   EXTRA_API_HOSTS=api.nyushdic.club
   ```

   Every page on nyushdic.club then redirects to the same page on
   www.nyushdic.com, and api.nyushdic.club keeps working as a second address
   for the API.
3. **`/opt/nyushdic/api.env`:** `ALLOWED_ORIGINS` lists the main domain
   (`https://www.nyushdic.com,https://nyushdic.com,https://geemir.github.io`),
   and `BOT_KNOWLEDGE_URL` uses it too.
4. Apply: `cd /opt/nyushdic/deploy && docker compose up -d --force-recreate web api`.
5. **The site:** `platform.api_url` in `_data/dic2026.yml` is
   `https://api.nyushdic.com`, and `url` in `_config.yml` is
   `https://www.nyushdic.com`.

Sign-in emails can keep coming from `mail.nyushdic.club`; to send from
`mail.nyushdic.com` instead, add that domain in DirectMail (step 7) and change
`EMAIL_FROM`.

### Using a different domain

Replace `nyushdic.com` everywhere above, and also:

- in `_config.yml`, set `url` to `https://www.<domain>`;
- run `setup.sh` with the new domain (it writes `site.env` and the
  `ALLOWED_ORIGINS` in a new `api.env`);
- set `platform.api_url` to `https://api.<domain>`.
