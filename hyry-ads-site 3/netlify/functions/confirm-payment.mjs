// Netlify Function: confirms a Toss Payments 결제위젯 payment.
// The amount is recomputed here from the price table, so a changed amount in the browser is rejected.
// Secret key: Netlify environment variable TOSS_SECRET_KEY. Without it, the public docs test key is used (test mode only).
const PRICES = {
  "hp-basic": {
    "name": "홈페이지 기본형",
    "price": 390000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "hp-standard": {
    "name": "홈페이지 일반형",
    "price": 790000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "hp-plus": {
    "name": "홈페이지 확장형",
    "price": 1290000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "shop-basic": {
    "name": "쇼핑몰 기본형",
    "price": 490000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "shop-standard": {
    "name": "쇼핑몰 일반형",
    "price": 990000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "shop-plus": {
    "name": "쇼핑몰 확장형",
    "price": 1590000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "pkg-starter": {
    "name": "STARTER",
    "price": 590000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "pkg-brand": {
    "name": "BRAND GROWTH",
    "price": 1490000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "pkg-ecom": {
    "name": "E-COMMERCE GROWTH",
    "price": 1990000,
    "kind": "once",
    "unit": false,
    "quote": false
  },
  "m-hp": {
    "name": "홈페이지 관리",
    "price": 150000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "m-shop": {
    "name": "쇼핑몰 관리",
    "price": 390000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "u-long": {
    "name": "유튜브 롱폼 편집",
    "price": 250000,
    "kind": "once",
    "unit": true,
    "quote": false
  },
  "u-shorts": {
    "name": "유튜브 쇼츠 단건",
    "price": 70000,
    "kind": "once",
    "unit": true,
    "quote": false
  },
  "s-15": {
    "name": "쇼츠 월 15편",
    "price": 750000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "s-30": {
    "name": "쇼츠 월 30편",
    "price": 1350000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "m-yt": {
    "name": "유튜브 채널 관리",
    "price": 800000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "u-blog": {
    "name": "블로그 포스팅 단건",
    "price": 60000,
    "kind": "once",
    "unit": true,
    "quote": false
  },
  "m-blog": {
    "name": "블로그 월 관리",
    "price": 600000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "sns-basic": {
    "name": "SNS BASIC",
    "price": 390000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "sns-growth": {
    "name": "SNS GROWTH",
    "price": 790000,
    "kind": "monthly",
    "unit": false,
    "quote": false
  },
  "ads": {
    "name": "ADS MANAGEMENT",
    "price": 0,
    "kind": "monthly",
    "unit": false,
    "quote": true
  }
};

const DOCS_TEST_SECRET = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export function priceOf(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) return null;
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = PRICES[it && it.id];
    const qty = Number(it && it.qty);
    if (!p || p.quote || !Number.isInteger(qty) || qty < 1 || qty > 30 || (!p.unit && qty !== 1)) return null;
    total += p.price * qty;
    lines.push(`${p.name}${p.unit ? ` × ${qty}` : ""}${p.kind === "monthly" ? " (월)" : ""} ${(p.price * qty).toLocaleString("ko-KR")}원`);
  }
  return { total, lines };
}

export default async (req) => {
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED", message: "POST only" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ code: "INVALID_REQUEST", message: "잘못된 요청입니다." }, 400); }
  const { paymentKey, orderId, amount, items } = body || {};
  if (typeof paymentKey !== "string" || typeof orderId !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(orderId)) {
    return json({ code: "INVALID_REQUEST", message: "결제 정보가 올바르지 않습니다." }, 400);
  }
  const priced = priceOf(items);
  if (!priced) return json({ code: "INVALID_ITEMS", message: "주문 내용이 올바르지 않습니다." }, 400);
  if (priced.total !== Number(amount)) {
    return json({ code: "AMOUNT_MISMATCH", message: "결제 금액이 주문 내용과 일치하지 않습니다." }, 400);
  }

  const secret = process.env.TOSS_SECRET_KEY || DOCS_TEST_SECRET;
  let res;
  try {
    res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(secret + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount: priced.total }),
    });
  } catch {
    return json({ code: "NETWORK_ERROR", message: "결제사와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ code: result.code || "CONFIRM_FAILED", message: result.message || "결제 승인에 실패했습니다." }, res.status);
  }
  return json({
    items: priced.lines.join(" / "),
    payment: {
      orderId: result.orderId, totalAmount: result.totalAmount, method: result.method,
      approvedAt: result.approvedAt, receipt: result.receipt ? { url: result.receipt.url } : null,
    },
  });
};

export const config = { path: "/api/confirm-payment" };
