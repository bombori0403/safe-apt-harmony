// 리스크로그 Supabase keep-alive. 매일 REST 한 번 찔러서 무료 프로젝트가
// 미사용으로 일시정지(pause) 되지 않게 한다. anon 키는 공개 키(클라이언트에도 있음).
const URL = "https://tcchzumelgqrwiyuppdo.supabase.co/rest/v1/complexes?select=id&limit=1";
const ANON = "sb_publishable_uzkMuxw2xOjSrQAEeu5HBQ_MX5ePdFm";
async function ping() {
  const r = await fetch(URL, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  console.log("keepalive", r.status);
}
export default {
  async scheduled(_event, _env, ctx) { ctx.waitUntil(ping()); },
  async fetch() { await ping(); return new Response("ok"); }, // 수동 확인용
};
