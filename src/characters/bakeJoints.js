import { Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Draw-call reduction for rigid-segment characters.
//
// Every joint carries many small static pieces (plates, straps, pouches). They
// never move relative to their joint, so after mount we merge them into one
// mesh per material per joint. Children that move or toggle independently
// (equipment groups, the deforming mantle, sub-joints) are left alone; groups
// flagged `userData.bake` are flattened into their joint.

const tmp = new Matrix4()
const KEEP = new Set(['position', 'normal', 'uv'])

function collect(node, parentMatrix, out) {
  for (const child of node.children) {
    if (child.userData.noBake) continue
    child.updateMatrix()
    const m = new Matrix4().multiplyMatrices(parentMatrix, child.matrix)
    if (child.isMesh && child.visible) out.push({ mesh: child, matrix: m, parent: node })
    else if (child.userData.bake) collect(child, m, out)
  }
}

/** Merge static meshes under each joint. Returns a disposer for the merged geometry. */
export function bakeJoints(joints) {
  const created = []
  const hidden = []
  for (const joint of joints) {
    const items = []
    collect(joint, tmp.identity(), items)
    const byMaterial = new Map()
    for (const it of items) {
      const list = byMaterial.get(it.mesh.material)
      if (list) list.push(it)
      else byMaterial.set(it.mesh.material, [it])
    }
    for (const [material, list] of byMaterial) {
      if (list.length < 2) continue
      // Primitives differ in indexing (RoundedBox is non-indexed); normalise to one layout.
      const geos = list.map(({ mesh, matrix }) => {
        const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
        for (const name of Object.keys(src.attributes)) if (!KEEP.has(name)) src.deleteAttribute(name)
        return src.applyMatrix4(matrix)
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) continue
      const baked = new Mesh(merged, material)
      baked.castShadow = list.some((it) => it.mesh.castShadow)
      baked.receiveShadow = list.some((it) => it.mesh.receiveShadow)
      baked.userData.noBake = true
      for (const { mesh } of list) {
        mesh.visible = false // React still owns the originals; hide rather than detach
        hidden.push(mesh)
      }
      joint.add(baked)
      created.push(baked)
    }
  }
  return () => {
    for (const m of hidden) m.visible = true
    for (const m of created) {
      m.parent?.remove(m)
      m.geometry.dispose()
    }
  }
}
