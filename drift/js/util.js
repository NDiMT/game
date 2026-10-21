// Merge every mesh under `root` into one mesh per material (transforms baked relative to root).
// Cuts draw calls (and shadow-pass calls) for static assemblies: car shells, wheels, stadium structure.
import * as THREE from 'three';

export function mergeByMaterial(root, opts = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.keep) meshes.push(o); });
  for (const m of meshes) {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.length > 1) continue; // multi-material meshes stay as they are
    const mat = mats[0];
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat).push(m);
  }
  const out = new THREE.Group();
  const mtx = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const [mat, list] of groups) {
    if (list.length < 2 && !opts.all) continue;
    const useUv = !!(mat.map || mat.normalMap || mat.emissiveMap || mat.roughnessMap);
    let count = 0;
    const geos = list.map((m) => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; count += g.attributes.position.count; return g; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = useUv ? new Float32Array(count * 2) : null;
    let off = 0, cast = false, recv = false;
    list.forEach((m, k) => {
      const g = geos[k];
      mtx.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mtx);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mtx); pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z;
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(off + i) * 3] = v.x; nor[(off + i) * 3 + 1] = v.y; nor[(off + i) * 3 + 2] = v.z; }
        if (uv && U) { uv[(off + i) * 2] = U.getX(i); uv[(off + i) * 2 + 1] = U.getY(i); }
      }
      off += P.count; cast = cast || m.castShadow; recv = recv || m.receiveShadow;
      m.parent.remove(m);
      if (g !== m.geometry) g.dispose();
      m.geometry.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    const mm = new THREE.Mesh(g, mat); mm.castShadow = cast; mm.receiveShadow = recv;
    out.add(mm);
  }
  root.add(out);
  return root;
}
