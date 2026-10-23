/*
 * Email providers, with the network stubbed out.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { signAliyun, sendEmail, codeEmail } from "../src/email.js";
import { configFromEnv } from "../src/config.js";

test("Alibaba Cloud signature matches the documented example", async () => {
  // The DescribeRegions example from Alibaba Cloud's RPC signature docs.
  const { signature, query } = await signAliyun({
    Timestamp: "2016-02-23T12:46:24Z",
    Format: "XML",
    AccessKeyId: "testid",
    Action: "DescribeRegions",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: "3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf",
    Version: "2014-05-26",
    SignatureVersion: "1.0",
  }, "testsecret", "GET");
  assert.equal(signature, "OLeaidS1JvxuMvnyHOwuJ+uX5qY=");
  assert.match(query, /&Signature=OLeaidS1JvxuMvnyHOwuJ%2BuX5qY%3D$/);
  assert.match(query, /Timestamp=2016-02-23T12%3A46%3A24Z/);
});

test("DirectMail request carries the sender, recipient and both bodies", async () => {
  const config = configFromEnv({
    AUTH_SECRET: "s", ALLOWED_ORIGINS: "https://www.nyushdic.com",
    EMAIL_PROVIDER: "aliyun", EMAIL_FROM: "NYUSH DIC <noreply@mail.nyushdic.com>",
    ALIYUN_ACCESS_KEY_ID: "id", ALIYUN_ACCESS_KEY_SECRET: "secret", ALIYUN_DM_REGION: "ap-southeast-1",
  });
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, body: new URLSearchParams(init.body), type: init.headers["Content-Type"] };
    return new Response(JSON.stringify({ EnvId: "1", RequestId: "r" }), { status: 200 });
  };
  try {
    await sendEmail(config, codeEmail("student@qq.com", "123456"));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(sent.url, "https://dm.ap-southeast-1.aliyuncs.com/");
  assert.equal(sent.type, "application/x-www-form-urlencoded");
  const p = sent.body;
  assert.equal(p.get("Action"), "SingleSendMail");
  assert.equal(p.get("AccountName"), "noreply@mail.nyushdic.com");
  assert.equal(p.get("FromAlias"), "NYUSH DIC");
  assert.equal(p.get("AddressType"), "1");
  assert.equal(p.get("ToAddress"), "student@qq.com");
  assert.match(p.get("Subject"), /^123456 is your DIC 2026 sign-in code/);
  assert.match(p.get("HtmlBody"), /123456/);
  assert.match(p.get("TextBody"), /登录验证码是：123456/);
  assert.equal(p.get("RegionId"), "ap-southeast-1");
  assert.match(p.get("Timestamp"), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.ok(p.get("Signature"));

  // The signature covers everything else that was sent.
  const params = Object.fromEntries([...p].filter(([k]) => k !== "Signature"));
  assert.equal((await signAliyun(params, "secret")).signature, p.get("Signature"));
});

test("a DirectMail error becomes a friendly message", async () => {
  const config = configFromEnv({
    AUTH_SECRET: "s", ALLOWED_ORIGINS: "https://www.nyushdic.com",
    EMAIL_PROVIDER: "aliyun", EMAIL_FROM: "noreply@mail.nyushdic.com",
    ALIYUN_ACCESS_KEY_ID: "id", ALIYUN_ACCESS_KEY_SECRET: "wrong",
  });
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = async () => new Response(JSON.stringify({ Code: "SignatureDoesNotMatch" }), { status: 400 });
  console.error = () => {};
  try {
    await assert.rejects(sendEmail(config, codeEmail("a@b.com", "000000")), (err) => err.code === "email_failed");
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert.equal(config.email.aliyunEndpoint, "dm.aliyuncs.com");
});
