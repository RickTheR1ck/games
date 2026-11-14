/* プレイ回数を数える小さなスクリプト（各ゲームから読み込む）
   使い方：ゲームを遊び始めるところで  rickPlay('フォルダ名')  を呼ぶだけ。
   ・送るのはゲームのフォルダ名だけ（名前やメールアドレスなどは送らない）
   ・同じゲームは15秒に1回まで（すぐリトライしても数えすぎない）
   ・パソコンでファイルを直接開いたときや、通信できないときは何もしない（ゲームには影響しない） */
(function () {
  var last = {};
  window.rickPlay = function (game) {
    try {
      if (location.protocol !== 'https:' || !/(^|\.)rickther1ck\.com$/.test(location.hostname)) return;
      // 撮影・デモ・テスト用のURL（#demo、?rec=1 など）で開いているときは数えない
      if (/demo|debug|test|rec/.test(location.hash) || /[?&](rec|debug|test|demo)(=|&|$)/.test(location.search)) return;
      var now = Date.now();
      if (last[game] && now - last[game] < 15000) return;
      last[game] = now;
      fetch('/api/play', { method: 'POST', body: game, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(function () {});
    } catch (e) {}
  };
})();
