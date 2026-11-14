// GET /api/counts  … ゲームごとのプレイ回数をまとめて返す（トップのゲーム一覧で使う）
// 例: {"warabimochi":120,"ichiman-lighter":8085}
export async function onRequestGet({ env }) {
  if (!env.DB) return new Response('{}', { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const { results } = await env.DB.prepare('SELECT game, count FROM plays').all();
  const counts = {};
  for (const r of results) counts[r.game] = r.count;
  return new Response(JSON.stringify(counts), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60', // 1分ごとに更新されれば十分
    },
  });
}
