// 3D 미리보기 뷰어 — FBX / OBJ(+MTL) / DAE / GLB·GLTF. 파일은 브라우저 안에서만 열리고 어디에도 올라가지 않음.
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
let T = null, L = {};
async function lib() {
  if (T) return;
  T = await import('three');
  const [oc, fbx, obj, mtl, dae, gltf] = await Promise.all([
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/loaders/FBXLoader.js'),
    import('three/addons/loaders/OBJLoader.js'),
    import('three/addons/loaders/MTLLoader.js'),
    import('three/addons/loaders/ColladaLoader.js'),
    import('three/addons/loaders/GLTFLoader.js'),
  ]);
  L = { Orbit: oc.OrbitControls, FBX: fbx.FBXLoader, OBJ: obj.OBJLoader, MTL: mtl.MTLLoader, DAE: dae.ColladaLoader, GLTF: gltf.GLTFLoader };
}

const css = `
.v3{position:fixed;inset:0;z-index:200;background:#15171c;color:#e8eaee;display:flex;flex-direction:column;font:14px/1.45 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.v3 header{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #2a2d35;flex-wrap:wrap}
.v3 header b{font-size:15px;margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.v3 button,.v3 label.b{background:#262931;color:#e8eaee;border:1px solid #363a44;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer}
.v3 button:hover,.v3 label.b:hover{background:#30343e}
.v3 label.b.pri{background:#3b6cf6;border-color:#3b6cf6}.v3 label.b.pri:hover{background:#2f5be0}
.v3 .stage{position:relative;flex:1;min-height:0}
.v3 canvas{display:block;width:100%;height:100%;touch-action:none}
.v3 .drop{position:absolute;inset:18px;border:2px dashed #3a3e48;border-radius:14px;display:grid;place-items:center;text-align:center;padding:24px;color:#a9aebb;pointer-events:none}
.v3 .drop.on{border-color:#3b6cf6;color:#fff;background:rgba(59,108,246,.08)}
.v3 .drop h3{margin:0 0 8px;color:#fff;font-size:18px}
.v3 .drop p{margin:4px 0;max-width:520px}
.v3 .msg{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#262931;border:1px solid #363a44;border-radius:10px;padding:10px 14px;max-width:min(560px,calc(100% - 32px));text-align:center}
.v3 .hint{font-size:12px;color:#8a90a0}
.v3 input{display:none}`;

let root, renderer, scene, camera, controls, current, raf, urls = [];
function el(h) { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; }
function msg(t, keep) {
  const m = root.querySelector('.msg'); m.textContent = t; m.hidden = !t;
  clearTimeout(msg.t); if (t && !keep) msg.t = setTimeout(() => (m.hidden = true), 6000);
}

export async function openViewer(title = '3D 미리보기', path = '') {
  if (!root) {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = el(`<div class="v3" role="dialog" aria-modal="true" aria-label="3D 미리보기">
      <header><b></b>
        <label class="b pri">파일 열기<input type="file" multiple data-f></label>
        <label class="b">폴더 열기<input type="file" webkitdirectory multiple data-f></label>
        <button type="button" data-reset>시점 초기화</button>
        <button type="button" data-close aria-label="닫기">닫기 ✕</button></header>
      <div class="stage"><canvas></canvas>
        <div class="drop"><div><h3>모델링 파일을 여기로 끌어다 놓으세요</h3>
          <p>FBX · OBJ · DAE · GLB 지원. 텍스처가 따로 있으면 <b>폴더 열기</b>로 폴더째 열거나 파일을 함께 선택하세요.</p>
          <p class="hint" data-path></p>
          <p class="hint">스케치업(.skp)은 브라우저에서 직접 열 수 없어요 → SketchUp에서 <b>파일 › 내보내기 › 3D 모델 › COLLADA(.dae) 또는 FBX</b>로 저장한 뒤 열어 주세요.</p>
          <p class="hint">파일은 이 컴퓨터 안에서만 열리고 어디에도 업로드되지 않아요.</p></div></div>
        <div class="msg" hidden></div></div></div>`);
    document.body.appendChild(root);
    root.querySelector('[data-close]').onclick = closeViewer;
    root.querySelector('[data-reset]').onclick = () => current && frame(current);
    root.querySelectorAll('[data-f]').forEach(i => i.onchange = () => { load([...i.files]); i.value = ''; });
    const stage = root.querySelector('.stage'), drop = root.querySelector('.drop');
    stage.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('on'); });
    stage.addEventListener('dragleave', () => drop.classList.remove('on'));
    stage.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('on'); load(await dropped(e.dataTransfer)); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && root && !root.hidden) { e.stopImmediatePropagation(); closeViewer(); } }, true);
  }
  root.querySelector('header b').textContent = title;
  root.querySelector('[data-path]').textContent = path ? `NAS 위치: ${path}` : '';
  root.hidden = false; document.body.style.overflow = 'hidden';
  msg('뷰어 준비 중…', true);
  try { await lib(); init(); msg(''); } catch (e) { msg('3D 엔진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', true); }
}

export function closeViewer() {
  if (!root) return; root.hidden = true; cancelAnimationFrame(raf); raf = 0;
  if (!document.querySelector('.ov:not([hidden])')) document.body.style.overflow = '';
}

function init() {
  const cv = root.querySelector('canvas');
  if (!renderer) {
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    scene = new T.Scene(); scene.background = new T.Color(0x1b1d23);
    scene.add(new T.HemisphereLight(0xffffff, 0x444450, 2.2));
    const d = new T.DirectionalLight(0xffffff, 1.6); d.position.set(3, 5, 4); scene.add(d);
    camera = new T.PerspectiveCamera(50, 1, 0.01, 1e6); camera.position.set(4, 3, 6);
    controls = new L.Orbit(camera, cv); controls.enableDamping = true; controls.screenSpacePanning = true;
    scene.add(new T.GridHelper(10, 20, 0x3a3e48, 0x2a2d35));
    new ResizeObserver(size).observe(cv);
  }
  size();
  const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
  if (!raf) loop();
}
function size() {
  const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

async function dropped(dt) {
  const out = [], walk = async en => {
    if (en.isFile) out.push(await new Promise(r => en.file(r, () => r(null))));
    else if (en.isDirectory) { const rd = en.createReader(); let b; do { b = await new Promise(r => rd.readEntries(r, () => r([]))); for (const x of b) await walk(x); } while (b.length); }
  };
  const ens = [...dt.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (ens.length) { for (const e of ens) await walk(e); return out.filter(Boolean); }
  return [...dt.files];
}

const ext = n => (n.split('.').pop() || '').toLowerCase();
const base = u => decodeURIComponent(String(u).split(/[?#]/)[0].split(/[\\/]/).pop()).toLowerCase();

async function load(files) {
  if (!files.length) return;
  const main = ['fbx', 'glb', 'gltf', 'dae', 'obj'].map(x => files.find(f => ext(f.name) === x)).find(Boolean);
  if (!main) {
    msg(files.some(f => ext(f.name) === 'skp')
      ? '스케치업(.skp)은 바로 열 수 없어요. SketchUp에서 COLLADA(.dae)나 FBX로 내보낸 뒤 열어 주세요.'
      : 'FBX · OBJ · DAE · GLB 파일을 찾지 못했어요.', true);
    return;
  }
  urls.forEach(URL.revokeObjectURL); urls = [];
  const map = {}; for (const f of files) { const u = URL.createObjectURL(f); urls.push(u); map[f.name.toLowerCase()] = u; }
  const mgr = new T.LoadingManager();
  let missing = new Set();
  mgr.setURLModifier(u => { if (/^(blob|data):/.test(u)) return u; const b = base(u); if (map[b]) return map[b]; missing.add(b); return u; });
  const big = main.size > 150 * 1024 * 1024;
  msg(`${main.name} 여는 중… ${big ? '(용량이 커서 시간이 걸려요)' : ''}`, true);
  root.querySelector('.drop').hidden = true;
  try {
    const url = map[main.name.toLowerCase()];
    let obj; const e = ext(main.name);
    if (e === 'fbx') obj = await new L.FBX(mgr).loadAsync(url);
    else if (e === 'dae') obj = (await new L.DAE(mgr).loadAsync(url)).scene;
    else if (e === 'glb' || e === 'gltf') obj = (await new L.GLTF(mgr).loadAsync(url)).scene;
    else {
      const ol = new L.OBJ(mgr), mtlF = files.find(f => ext(f.name) === 'mtl');
      if (mtlF) { const m = await new L.MTL(mgr).loadAsync(map[mtlF.name.toLowerCase()]); m.preload(); ol.setMaterials(m); }
      obj = await ol.loadAsync(url);
    }
    if (current) { scene.remove(current); dispose(current); }
    current = obj; scene.add(obj); frame(obj);
    root.querySelector('header b').textContent = main.name;
    let tris = 0; obj.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    setTimeout(() => msg(missing.size ? `열었어요 · 텍스처 ${missing.size}개를 찾지 못했어요 (폴더 열기로 다시 시도)` : `열었어요 · 삼각형 ${Math.round(tris).toLocaleString()}개 · 드래그로 회전, 휠로 확대, 우클릭으로 이동`), 300);
  } catch (err) {
    console.error(err); root.querySelector('.drop').hidden = !!current;
    msg('파일을 열지 못했어요. 형식이 맞는지, 파일이 손상되지 않았는지 확인해 주세요.', true);
  }
}

function frame(obj) {
  const box = new T.Box3().setFromObject(obj); if (box.isEmpty()) return;
  const s = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3()), r = Math.max(s.x, s.y, s.z) || 1;
  camera.near = r / 1000; camera.far = r * 100; camera.updateProjectionMatrix();
  camera.position.copy(c).add(new T.Vector3(r * 1.3, r * .9, r * 1.8));
  controls.target.copy(c); controls.update();
  const g = scene.children.find(o => o.isGridHelper); if (g) { g.scale.setScalar(r / 5); g.position.set(c.x, box.min.y, c.z); }
}
function dispose(o) {
  o.traverse(m => { m.geometry?.dispose?.(); [].concat(m.material || []).forEach(x => { Object.values(x).forEach(v => v?.isTexture && v.dispose()); x.dispose?.(); }); });
}
