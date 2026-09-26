import sharp from "sharp";
const { CLOUDFLARE_ACCOUNT_ID: acct, CLOUDFLARE_API_TOKEN: tok } = process.env;
const base = `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/`;
const prompt = "cinematic poster of a rainy Kolkata street at night, neon reflections, no text";
const models = ["@cf/black-forest-labs/flux-2-klein-4b","@cf/lykon/dreamshaper-8-lcm","@cf/bytedance/stable-diffusion-xl-lightning","@cf/stabilityai/stable-diffusion-xl-base-1.0"];
for (const [w,h] of [[1024,1280],[864,1536]]) for (const m of models) {
  const t = Date.now();
  let body, headers = { Authorization: `Bearer ${tok}` };
  if (m.includes("flux-2")) { const f = new FormData(); for (const [k,v] of Object.entries({prompt,width:w,height:h,seed:42,steps:4})) f.append(k,String(v)); body = f; }
  else { headers["Content-Type"]="application/json"; body = JSON.stringify({prompt,width:w,height:h,seed:42,num_steps: m.includes("base-1.0")?20:(m.includes("lightning")?4:6)}); }
  try {
    const r = await fetch(base+m,{method:"POST",headers,body,signal:AbortSignal.timeout(120000)});
    const ct = r.headers.get("content-type")||"";
    let bytes;
    if (ct.startsWith("image/")) bytes = Buffer.from(await r.arrayBuffer());
    else { const j = await r.json(); if (!r.ok || !j.result?.image) { console.log(m,w,h,"HTTP",r.status,JSON.stringify(j).slice(0,200)); continue; } bytes = Buffer.from(j.result.image,"base64"); }
    const md = await sharp(bytes).metadata();
    console.log(m, `req ${w}x${h}`, `got ${md.width}x${md.height} ${md.format}`, `${Date.now()-t}ms`, `resp=${ct.split(";")[0]}`);
  } catch(e){ console.log(m,w,h,"ERR",e.message); }
}
