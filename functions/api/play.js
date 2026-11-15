// POST /api/play  … ゲームを1回遊び始めたことを記録する
// 送られてくるのは、ゲームのフォルダ名（例: "warabimochi"）だけ。
// 同じ人が同じゲームを短時間に何度も送ってきても、1回分しか数えない。
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SAME_PLAYER_GAP = 10; // 秒：同じ人・同じゲームはこの間隔より短いと数えない
const PRUNE_RATE = 0.02;   // 古い連打防止メモを消す確率（50回に1回）

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'no-db' }, 503);

  const game = (await request.text()).trim().slice(0, 40);
  if (!SLUG.test(game)) return json({ ok: false, error: 'bad-game' }, 400);

  const now = Math.floor(Date.now() / 1000);

  // 連打・水増し防止：IPアドレスそのものは保存せず、「IP＋ゲーム＋日付」をハッシュにした値だけを、ごく短い時間だけ使う
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const day = new Date().toISOString().slice(0, 10);
  const key = await sha256(`${ip}|${game}|${day}`);
  const last = await env.DB.prepare('SELECT t FROM recent WHERE k = ?').bind(key).first('t');
  if (last && now - last < SAME_PLAYER_GAP) return json({ ok: true, counted: false });

  // 実在するゲームだけ数える（サイトにそのフォルダがあるかを確認してから新しく行を作る）
  const upd = await env.DB.prepare('UPDATE plays SET count = count + 1 WHERE game = ?').bind(game).run();
  if (!upd.meta.changes) {
    const page = await env.ASSETS.fetch(new URL(`/${game}/`, request.url));
    if (!page.ok) return json({ ok: false, error: 'unknown-game' }, 404);
    await env.DB.prepare('INSERT INTO plays (game, count) VALUES (?, 1) ON CONFLICT(game) DO UPDATE SET count = count + 1').bind(game).run();
  }

  await env.DB.prepare('INSERT INTO recent (k, t) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET t = excluded.t').bind(key, now).run();
  // 1分以上前の連打防止メモ（recentテーブル）を消す。
  // 毎回やると表全体を読むのでD1の読み取りが多くなる。だいたい50回に1回だけ行う。
  // ※消すのは recent（短時間だけ使う連打防止メモ）だけ。プレイ回数（plays）には触らない。
  if (Math.random() < PRUNE_RATE) {
    await env.DB.prepare('DELETE FROM recent WHERE t < ?').bind(now - 60).run();
  }

  return json({ ok: true, counted: true });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
