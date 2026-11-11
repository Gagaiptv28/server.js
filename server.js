// დაყენება: apt install -y ffmpeg nodejs npm && npm i express
// გაშვება:  PASSWORD=შენი_პაროლი VIDEO_DIR=/root/videos pm2 start server.js
// გახსნა:   http://სერვერის_IP:3000

const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.PASSWORD || "";
const DIR = process.env.VIDEO_DIR || path.join(__dirname, "videos");
const DATA = path.join(__dirname, "data.json");
fs.mkdirSync(DIR, { recursive: true });

const PAGE = "<!doctype html><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Video Loop</title>\n<link rel=\"manifest\" href=\"/manifest.json\">\n<link rel=\"apple-touch-icon\" href=\"/icon.png\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-title\" content=\"Video Loop\">\n<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n<meta name=\"theme-color\" content=\"#111111\">\n<style>\nbody{font-family:sans-serif;max-width:600px;margin:14px auto;padding:0 12px;background:#111;color:#eee}\nh3{margin:22px 0 8px;border-bottom:1px solid #333;padding-bottom:4px}\nbutton{padding:7px 11px;margin:2px;border:0;border-radius:6px;background:#2d6cdf;color:#fff;font-size:15px}\nbutton.r{background:#c0392b} button.g{background:#444}\ninput[type=text]{width:100%;padding:9px;box-sizing:border-box;border-radius:6px;border:1px solid #444;background:#222;color:#fff}\n.row{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #222;word-break:break-all}\n.row span{flex:1} small{color:#999;white-space:nowrap}\n.big{display:block;text-align:center;padding:18px;border-radius:10px;background:#2d6cdf;font-size:17px;margin:8px 0}\n.box{background:#1b1b1b;border-radius:8px;padding:10px;margin:10px 0}\nprogress{width:100%}\n</style>\n<h2>🎬 Video Loop Panel</h2>\n<div><b id=\"st\"></b></div>\n\n<h3>1. ატვირთვა</h3>\n<label class=\"big\">📤 აირჩიე ვიდეოები<input type=\"file\" id=\"f\" accept=\"video/*,.mp4,.mkv,.mov\" multiple hidden onchange=\"up()\"></label>\n<small>არჩევისთანავე ავტომატურად იტვირთება. ზომის ლიმიტი არ არის. წყვეტისას იგივე ფაილი აირჩიე და გააგრძელებს.</small>\n<div id=\"pt\"></div>\n<div id=\"ul\"></div>\n\n<h3>2. ვიდეოები</h3>\n<div id=\"vl\"></div>\n<input type=\"text\" id=\"pn\" placeholder=\"პლეილისტის სახელი\" style=\"margin-top:8px\">\n<button onclick=\"mkPl()\">➕ პლეილისტის შექმნა მონიშნულებიდან</button>\n\n<h3>3. პლეილისტები</h3>\n<div id=\"pl\"></div>\n\n<h3>4. სტრიმი</h3>\n<input type=\"text\" id=\"rt\" placeholder=\"rtmp://live.restream.io/live/შენი_გასაღები\">\n<p><button class=\"r\" onclick=\"stop()\">■ გაჩერება</button>\n<button class=\"g\" onclick=\"start(-1)\">▶ ყველა ვიდეო ლუპში</button></p>\n\n<script>\nvar $=function(id){return document.getElementById(id)},enc=encodeURIComponent;\nvar sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};\nvar S={videos:[],playlists:{},stream:{}},sel={},P=[],CH=16*1024*1024;\nfunction esc(s){return String(s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}\nfunction mb(n){return (n/1048576).toFixed(0)+' MB'}\nasync function api(url,method,body){\n  var r=await fetch(url,{method:method||'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});\n  return r.json();\n}\nasync function load(){S=await api('/api/state');render()}\nfunction render(){\n  $('st').textContent=S.stream.running?'🔴 სტრიმი მიდის: '+(S.stream.playlist||'ყველა ვიდეო'):'⚪ სტრიმი გაჩერებულია';\n  if(!$('rt').value&&S.stream.rtmp)$('rt').value=S.stream.rtmp;\n  $('pt').innerHTML=(S.partials||[]).map(function(p){return '<div class=\"box\">⏸ გაუსრულებელი: '+esc(p.name)+' ('+mb(p.size)+') — აირჩიე იგივე ფაილი გასაგრძელებლად</div>'}).join('');\n  $('vl').innerHTML=S.videos.map(function(v,i){\n    return '<label class=\"row\"><input type=\"checkbox\" '+(sel[v.name]?'checked':'')+' onchange=\"tog('+i+')\"><span>'+esc(v.name)+'</span><small>'+mb(v.size)+'</small><button class=\"r\" onclick=\"delV('+i+');return false\">🗑</button></label>';\n  }).join('')||'ცარიელია';\n  P=Object.keys(S.playlists);\n  $('pl').innerHTML=P.map(function(n,pi){\n    var items=S.playlists[n].map(function(f,j){\n      return '<div class=\"row\"><small>'+(j+1)+'</small><span>'+esc(f)+'</span><button class=\"g\" onclick=\"mv('+pi+','+j+',-1)\">↑</button><button class=\"g\" onclick=\"mv('+pi+','+j+',1)\">↓</button><button class=\"r\" onclick=\"rm('+pi+','+j+')\">✕</button></div>';\n    }).join('');\n    return '<div class=\"box\"><b>'+esc(n)+'</b> ('+S.playlists[n].length+') <button onclick=\"start('+pi+')\">▶ სტრიმი</button><button class=\"r\" onclick=\"delP('+pi+')\">🗑</button>'+items+'</div>';\n  }).join('')||'ჯერ არ არის';\n}\nfunction tog(i){var n=S.videos[i].name;if(sel[n])delete sel[n];else sel[n]=1}\nasync function delV(i){if(confirm('წავშალო ვიდეო?')){await api('/api/video?name='+enc(S.videos[i].name),'DELETE');load()}}\nasync function mkPl(){\n  var name=$('pn').value.trim();\n  var files=S.videos.map(function(v){return v.name}).filter(function(n){return sel[n]});\n  if(!name||!files.length){alert('ჩაწერე სახელი და მონიშნე ვიდეოები');return}\n  await api('/api/playlist','POST',{name:name,files:files});sel={};$('pn').value='';load();\n}\nasync function savePl(n){await api('/api/playlist','POST',{name:n,files:S.playlists[n]});load()}\nfunction mv(pi,j,d){var n=P[pi],a=S.playlists[n],k=j+d;if(k<0||k>=a.length)return;var t=a[j];a[j]=a[k];a[k]=t;savePl(n)}\nfunction rm(pi,j){var n=P[pi];S.playlists[n].splice(j,1);savePl(n)}\nasync function delP(pi){if(confirm('წავშალო პლეილისტი?')){await api('/api/playlist?name='+enc(P[pi]),'DELETE');load()}}\nasync function start(pi){\n  var r=await api('/api/start','POST',{rtmp:$('rt').value.trim(),playlist:pi<0?'':P[pi]});\n  if(r.error)alert(r.error);setTimeout(load,2000);\n}\nasync function stop(){await api('/api/stop','POST',{});setTimeout(load,2000)}\n\n// ატვირთვა ნაწილ-ნაწილ (16 MB), წყვეტის შემთხვევაში აგრძელებს\nasync function upOne(f,el){\n  var off=(await api('/api/offset?name='+enc(f.name))).size;if(off>f.size)off=0;\n  var t0=Date.now(),start=off;\n  while(off<f.size){\n    var end=Math.min(off+CH,f.size),ok=false;\n    for(var t=0;t<8&&!ok;t++){\n      try{\n        var r=await fetch('/api/chunk?name='+enc(f.name)+'&offset='+off,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f.slice(off,end)});\n        if(!r.ok)throw 0;ok=true;\n      }catch(e){el.textContent=f.name+': კავშირი გაწყდა, ვცდი თავიდან...';await sleep(3000)}\n    }\n    if(!ok){el.textContent=f.name+': ❌ ვერ აიტვირთა';return}\n    off=end;\n    var sp=(off-start)/Math.max((Date.now()-t0)/1000,1)/1048576;\n    el.textContent=f.name+': '+Math.floor(off*100/f.size)+'%  '+sp.toFixed(1)+' MB/s';\n  }\n  await api('/api/finish?name='+enc(f.name),'POST',{});\n  el.textContent=f.name+': ✔ დასრულდა';\n}\nvar wl=null;\nasync function lock(){try{if(navigator.wakeLock)wl=await navigator.wakeLock.request('screen')}catch(e){}}\ndocument.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&busy)lock()});\nvar busy=false;\nasync function up(){\n  var fs=Array.prototype.slice.call($('f').files);\n  if(!fs.length||busy)return;\n  busy=true;await lock();\n  for(var i=0;i<fs.length;i++){\n    var el=document.createElement('div');el.className='row';$('ul').appendChild(el);\n    await upOne(fs[i],el);\n  }\n  busy=false;try{if(wl)wl.release()}catch(e){}\n  $('f').value='';load();\n}\nload();setInterval(load,15000);\n</script>\n";
const ICON = Buffer.from("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AACiBAAgSgAAogQAIEoAHvj89efVjwBs5Py+TQAAogQAIEoAAKIEACBKAB7zHQlW5OQ+JAAAUQIAECUAT3GXhLU4s88QAIAoAXiWHxSwCqf1SQIAECUAL/CzAubnnD5PAACiBOA1flzAzJzQlwjAy7xhMCdn81UCsIX3DGbjVG4gAABRArCRnxswD+dxGwHYzjsHM3ASNxOAXbx5cC1ncA8B2Mv7B1dx+nYSgAG8hXA+526/95++/Lj6Ge7j+7ePVz8C3J/pH8UNYCTvJRzNKRtIAAbzdsJxnK+x/AnoKP4cBAOZ/iMIwLFkAHYy/ccRgDPIAGxg+o8mAKdSAnjI7p9GAK6kB/DO4l9HAACi/BsoQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARAkAQJQAAEQJAECUAABECQBAlAAARP0NvvqGEFzUCE4AAAAASUVORK5CYII=", "base64");

let db = { playlists: {}, stream: { want: false, rtmp: "", playlist: "" } };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, "utf8"))); } catch {}
const save = () => fs.writeFileSync(DATA, JSON.stringify(db, null, 1));
const safe = (n) => path.basename(String(n || "")).replace(/[^\w.\-]+/g, "_");
const videoFiles = () => fs.readdirSync(DIR).filter((f) => !f.startsWith(".") && !f.endsWith(".part")).sort();

const app = express();
app.use("/v", express.static(DIR)); // პირდაპირი ლინკები (პაროლის გარეშე)

// აპის ხატულა და manifest (საჯაროა, რომ ტელეფონმა "აპად დამატებისას" ხატულა აიღოს)
app.get("/icon.png", (req, res) => res.type("png").send(ICON));
app.get("/manifest.json", (req, res) => res.json({
  name: "Video Loop", short_name: "Video Loop", start_url: "/", display: "standalone",
  background_color: "#111111", theme_color: "#111111",
  icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
}));

app.use((req, res, next) => {
  if (!PASSWORD) return next();
  const b64 = (req.headers.authorization || "").split(" ")[1] || "";
  const pass = Buffer.from(b64, "base64").toString().split(":").slice(1).join(":");
  if (pass === PASSWORD) return next();
  res.set("WWW-Authenticate", 'Basic realm="panel"').status(401).send("პაროლი საჭიროა");
});
app.use(express.json());

app.get("/", (req, res) => res.type("html").send(PAGE));

// ---- ატვირთვა ნაწილ-ნაწილ ----
app.get("/api/offset", (req, res) => {
  try { res.json({ size: fs.statSync(path.join(DIR, safe(req.query.name) + ".part")).size }); }
  catch { res.json({ size: 0 }); }
});

app.post("/api/chunk", express.raw({ type: () => true, limit: "64mb" }), (req, res) => {
  try {
    const p = path.join(DIR, safe(req.query.name) + ".part");
    const off = Number(req.query.offset) || 0;
    const fd = fs.openSync(p, off === 0 ? "w" : "r+");
    fs.writeSync(fd, req.body, 0, req.body.length, off);
    fs.closeSync(fd);
    res.json({ size: off + req.body.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/finish", (req, res) => {
  const n = safe(req.query.name), p = path.join(DIR, n + ".part");
  if (!fs.existsSync(p)) return res.status(404).json({ error: "ფაილი ვერ მოიძებნა" });
  let final = n;
  if (fs.existsSync(path.join(DIR, final))) final = Date.now() + "-" + n;
  fs.renameSync(p, path.join(DIR, final));
  res.json({ name: final });
});

// ---- ვიდეოები და პლეილისტები ----
app.get("/api/state", (req, res) => {
  const videos = videoFiles().map((name) => ({ name, size: fs.statSync(path.join(DIR, name)).size }));
  const partials = fs.readdirSync(DIR).filter((f) => f.endsWith(".part"))
    .map((f) => ({ name: f.slice(0, -5), size: fs.statSync(path.join(DIR, f)).size }));
  res.json({ videos, partials, playlists: db.playlists, stream: { ...db.stream, running: !!ff } });
});

app.delete("/api/video", (req, res) => {
  const n = safe(req.query.name);
  fs.rmSync(path.join(DIR, n), { force: true });
  for (const k in db.playlists) db.playlists[k] = db.playlists[k].filter((f) => f !== n);
  save(); res.json({ ok: true });
});

app.post("/api/playlist", (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "სახელი საჭიროა" });
  db.playlists[name] = (req.body.files || []).map(safe);
  save(); res.json({ ok: true });
});

app.delete("/api/playlist", (req, res) => {
  delete db.playlists[req.query.name];
  if (db.stream.playlist === req.query.name) db.stream.playlist = "";
  save(); res.json({ ok: true });
});

// ---- სტრიმი (ffmpeg, ლუპი, ხელახალი კოდირების გარეშე) ----
let ff = null;

function run() {
  if (!db.stream.want) return;
  const pl = db.stream.playlist;
  const names = (pl && db.playlists[pl] ? db.playlists[pl] : videoFiles()).filter((f) => fs.existsSync(path.join(DIR, f)));
  if (!names.length) { db.stream.want = false; save(); return; }
  const list = path.join(__dirname, "list.txt");
  fs.writeFileSync(list, names.map((f) => "file '" + path.join(DIR, f).replace(/'/g, "'\\''") + "'").join("\n"));
  ff = spawn("ffmpeg", ["-re", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy",
    "-flvflags", "no_duration_filesize", "-f", "flv", db.stream.rtmp], { stdio: "ignore" });
  ff.on("exit", () => { ff = null; if (db.stream.want) setTimeout(run, 2000); });
}

app.post("/api/start", (req, res) => {
  const rtmp = String(req.body.rtmp || "");
  if (!/^rtmps?:\/\//.test(rtmp)) return res.status(400).json({ error: "RTMP ლინკი არასწორია" });
  db.stream = { want: true, rtmp, playlist: req.body.playlist || "" };
  save();
  if (ff) ff.kill("SIGINT"); else run(); // გადატვირთვისას exit-ზე თავისით ახლიდან ჩაირთვება
  res.json({ ok: true });
});

app.post("/api/stop", (req, res) => {
  db.stream.want = false; save();
  if (ff) ff.kill("SIGINT");
  res.json({ ok: true });
});

app.listen(PORT, () => { console.log("მუშაობს, პორტი " + PORT); run(); });
