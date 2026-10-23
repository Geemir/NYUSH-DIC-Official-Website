/*
 * Sending email: the sign-in code is the only mail the platform sends.
 *
 * Providers (EMAIL_PROVIDER):
 *   console  print the message in the server log (development)
 *   none     send nothing (development with DEV_RETURN_CODE=1, tests, preview)
 *   aliyun   Alibaba Cloud DirectMail (邮件推送), with ALIYUN_ACCESS_KEY_ID /
 *            ALIYUN_ACCESS_KEY_SECRET; EMAIL_FROM must be a sender address
 *            set up in the DirectMail console
 *   resend   Resend's HTTP API (resend.com), with RESEND_API_KEY
 *   webhook  POST { to, subject, text, html, replyTo } as JSON to
 *            EMAIL_WEBHOOK_URL, for any other mail service
 */
import { fail } from "./util.js";

/* ------------------------------------------------- Alibaba Cloud DirectMail */
/* RFC 3986 encoding, as Alibaba Cloud's signatures expect. */
const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/*
 * Signs an Alibaba Cloud RPC-style request (signature version 1.0,
 * HMAC-SHA1) and returns the encoded query string, Signature included.
 * https://help.aliyun.com/zh/sdk/product-overview/rpc-mechanism
 */
export async function signAliyun(params, secret, method = "POST") {
  const canonical = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const toSign = `${method}&${pct("/")}&${pct(canonical)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${secret}&`), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign)));
  const signature = btoa(String.fromCharCode(...mac));
  return { signature, query: `${canonical}&Signature=${pct(signature)}` };
}

/* "NYUSH DIC <noreply@mail.nyushdic.com>" → { name, address } */
function parseFrom(from) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1], address: m[2] } : { name: "", address: from.trim() };
}

async function sendAliyun(email, message) {
  const sender = parseFrom(email.from);
  const params = {
    Action: "SingleSendMail",
    AccountName: sender.address,
    AddressType: "1", // send from the configured sender address
    ReplyToAddress: "false",
    ToAddress: message.to,
    Subject: message.subject,
    HtmlBody: message.html,
    TextBody: message.text,
    FromAlias: sender.name,
    Format: "JSON",
    Version: "2015-11-23",
    RegionId: email.aliyunRegion,
    AccessKeyId: email.aliyunKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  const { query } = await signAliyun(params, email.aliyunKeySecret);
  return fetch(`https://${email.aliyunEndpoint}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: query,
  });
}

export async function sendEmail(config, message) {
  const { provider, from, replyTo } = config.email;

  if (provider === "none" && config.dev) return;
  if (provider === "console") {
    console.log(`\n[email] to ${message.to}\n  ${message.subject}\n  ${message.text.replace(/\n/g, "\n  ")}\n`);
    return;
  }

  let res;
  if (provider === "aliyun") {
    res = await sendAliyun(config.email, message);
  } else if (provider === "resend") {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.email.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], reply_to: replyTo, subject: message.subject, text: message.text, html: message.html }),
    });
  } else if (provider === "webhook") {
    res = await fetch(config.email.webhookUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.email.webhookSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, from, replyTo }),
    });
  } else {
    console.error("EMAIL_PROVIDER is not set; cannot send sign-in codes.");
    fail(503, "email_off", "Email is not set up on the server yet.", "服务器尚未配置邮件发送。");
  }

  if (!res.ok) {
    console.error(`Email to ${message.to} failed: ${res.status} ${await res.text().catch(() => "")}`);
    fail(502, "email_failed", "We couldn't send the email. Please try again in a minute.", "邮件发送失败，请稍后再试。");
  }
}

/* The sign-in code, in both languages. */
export function codeEmail(to, code) {
  const subject = `${code} is your DIC 2026 sign-in code / 登录验证码`;
  const text = [
    `Your sign-in code for NYUSH Digital Innovation Challenge 2026 is: ${code}`,
    "It works for 10 minutes. If you didn't ask for it, you can ignore this email.",
    "",
    `你的 2026 上海纽约大学数字创新挑战赛登录验证码是：${code}`,
    "验证码 10 分钟内有效。如果这不是你本人的操作，请忽略此邮件。",
    "",
    "NYUSH Digital Innovation Community",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f1eefd;font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#032344">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #d8cbff">
<tr><td style="background:#032344;color:#70d5e8;padding:14px 20px;font:600 12px/1.4 Menlo,Consolas,monospace;letter-spacing:.14em">NYUSHDIC 2026 / SIGN IN</td></tr>
<tr><td style="padding:28px 24px 8px;font-size:15px;line-height:1.6">Your sign-in code<br><span style="color:#5b7896">你的登录验证码</span></td></tr>
<tr><td style="padding:0 24px"><div style="font:700 36px/1.2 Menlo,Consolas,monospace;letter-spacing:.24em;color:#032344;background:#f1eefd;padding:14px 0;text-align:center">${code}</div></td></tr>
<tr><td style="padding:20px 24px 28px;font-size:13px;line-height:1.7;color:#395672">It works for 10 minutes. If you didn't ask for it, ignore this email.<br>验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}
