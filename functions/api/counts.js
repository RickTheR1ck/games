// GET /api/counts  … ゲームごとのプレイ回数をまとめて返す（トップのゲーム一覧で使う）
// 例: {"warabimochi":120,"ichiman-lighter":8085}
// D1の読み取りを減らすため、結果をCloudflareのキャッシュに60秒だけ置く。
// 60秒以内に来た人には、D1に聞かずにキャッシュの結果を返す（表示が最大1分遅れるだけ）。
const CACHE_SECONDS = 60;

export async function onRequestGet({ request, env, waitUntil }) {
  if (!env.DB) return new Response('{}', { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } });

  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/counts', request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // ここから下は読み取りだけ（データは変更しない）
  const { results } = await env.DB.prepare('SELECT game, count FROM plays').all();
  const counts = {};
  for (const r of results) counts[r.game] = r.count;
  const res = new Response(JSON.stringify(counts), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
