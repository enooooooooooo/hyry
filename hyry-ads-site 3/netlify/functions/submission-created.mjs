// Netlify event function: runs automatically for every verified Netlify Forms submission
// (contact, order, paid-order) and sends a text message to the owner's phone via SOLAPI.
// Environment variables (Netlify > Site configuration > Environment variables):
//   SOLAPI_API_KEY, SOLAPI_API_SECRET  - from the SOLAPI console
//   SMS_FROM  - sender number registered (발신번호 등록) in SOLAPI, digits only
//   SMS_TO    - where to send; defaults to the owner's phone
import crypto from "node:crypto";

const DEFAULT_TO = "01025750925";

const TITLES = { contact: "상담 문의", order: "견적 요청", "paid-order": "결제 완료 주문" };

function clip(s, n) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function buildText(form, d) {
  const lines = [`[HYRY ADS] 새 ${TITLES[form] || form}`];
  const add = (k, v, n = 120) => { if (v) lines.push(`${k}: ${clip(v, n)}`); };
  add("이름", d.name, 40);
  add("상호", d.company, 40);
  add("연락처", d.phone, 30);
  add("이메일", d.email, 60);
  if (form === "contact") {
    add("관심", d.plan, 40);
    add("내용", d.message, 300);
  } else if (form === "order") {
    add("주문", d.order_summary, 400);
    add("1회", d.estimate_once, 30);
    add("월", d.estimate_monthly, 30);
    add("시작일", d.start_date, 20);
    add("요청", d.message, 200);
  } else if (form === "paid-order") {
    add("주문번호", d.order_id, 40);
    add("결제금액", d.amount ? Number(d.amount).toLocaleString("ko-KR") + "원" : "", 30);
    add("주문", d.items, 400);
    add("시작일", d.start_date, 20);
    add("요청", d.message, 200);
  }
  return lines.join("\n");
}

function authHeader(key, secret) {
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", secret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

export const handler = async (event) => {
  let payload;
  try { payload = JSON.parse(event.body).payload; } catch { return { statusCode: 400, body: "bad payload" }; }
  const form = payload.form_name;
  const d = payload.data || {};
  const key = process.env.SOLAPI_API_KEY, secret = process.env.SOLAPI_API_SECRET;
  const from = (process.env.SMS_FROM || "").replace(/\D/g, "");
  const to = (process.env.SMS_TO || DEFAULT_TO).replace(/\D/g, "");
  if (!key || !secret || !from) {
    console.log("SMS not sent: SOLAPI_API_KEY / SOLAPI_API_SECRET / SMS_FROM not set");
    return { statusCode: 200, body: "sms not configured" };
  }
  const text = buildText(form, d);
  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { Authorization: authHeader(key, secret), "Content-Type": "application/json" },
    body: JSON.stringify({ message: { to, from, text } }),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
  const out = await res.text();
  console.log("SOLAPI", res.status, out.slice(0, 300));
  return { statusCode: 200, body: res.ok ? "sent" : "sms failed" };
};
