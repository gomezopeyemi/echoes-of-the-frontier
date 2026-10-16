// Asset preparation script (not part of the game build).
//
// Extracts one prop group from the Godot TPS demo's level file
// (level/geometry/models/props.glb) into a standalone GLB, baked to the
// first node's origin, with its albedo / normal / ORM maps embedded.
// Used to produce public/assets/env/tps-demo/container_*.glb (see ASSETS.md).
//
// Requires @gltf-transform/core and sharp, which are deliberately NOT project
// dependencies; run it with a temporary install, e.g. in a scratch folder:
//   npm i @gltf-transform/core@4 sharp three
//   SRC=props.glb node extract-tps-prop.mjs out.glb prop_container2.010 \
//     prop_container2door1.010,prop_container2door2.010 '<material map JSON>'
// Material map JSON: { "<material>": { "albedo", "normal", "orm", "size"?,
//   "metallic"?, "alpha"?, "alphaCutoff"?, "ormSwizzle"? } }
import { NodeIO, Document } from '@gltf-transform/core'
import { Matrix4, Matrix3, Vector3 } from 'three'
import sharp from 'sharp'
import fs from 'fs'

const SRC = process.env.SRC
const [out, rootName, others, mapJson] = process.argv.slice(2)
const io = new NodeIO()
const doc = await io.read(SRC)
const root = doc.getRoot()
const names = [rootName, ...(others ? others.split(',') : [])]
const nodes = names.map((n) => { const x = root.listNodes().find((k) => k.getName() === n); if (!x) throw new Error('missing ' + n); return x })
const worlds = nodes.map((n) => new Matrix4().fromArray(n.getWorldMatrix()))
const inv = worlds[0].clone().invert()
// Fresh document holding only the chosen primitives, baked into the group's space.
const out$ = new Document()
const buffer = out$.createBuffer()
const outScene = out$.createScene('Scene')
const group = out$.createNode(rootName.replace(/\.\d+$/, ''))
outScene.addChild(group)
out$.getRoot().setDefaultScene(outScene)
const matCache = new Map()
const v = new Vector3(), nm = new Matrix3()
nodes.forEach((n, i) => {
  const rel = inv.clone().multiply(worlds[i])
  nm.getNormalMatrix(rel)
  const mesh = out$.createMesh(n.getName())
  for (const p of n.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION').getArray(), nor = p.getAttribute('NORMAL').getArray(), uv = p.getAttribute('TEXCOORD_0')?.getArray()
    const P = new Float32Array(pos.length), N = new Float32Array(nor.length)
    for (let k = 0; k < pos.length; k += 3) {
      v.set(pos[k], pos[k + 1], pos[k + 2]).applyMatrix4(rel); P.set([v.x, v.y, v.z], k)
      v.set(nor[k], nor[k + 1], nor[k + 2]).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], k)
    }
    const acc = (arr, type) => out$.createAccessor().setArray(arr).setType(type).setBuffer(buffer)
    const mname = p.getMaterial().getName()
    if (!matCache.has(mname)) matCache.set(mname, out$.createMaterial(mname))
    const q = out$.createPrimitive().setMaterial(matCache.get(mname))
      .setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3'))
      .setIndices(acc(p.getIndices().getArray().slice(), 'SCALAR'))
    if (uv) q.setAttribute('TEXCOORD_0', acc(uv.slice(), 'VEC2'))
    mesh.addPrimitive(q)
  }
  group.addChild(out$.createNode(n.getName()).setMesh(mesh))
})
const doc$ = out$
const maps = JSON.parse(mapJson)
const enc = async (file, { size, kind, swizzle }) => {
  let img = sharp(file)
  if (swizzle) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
    const ch = info.channels, o = Buffer.alloc(info.width * info.height * 3)
    for (let i = 0, j = 0; i < data.length; i += ch, j += 3) { o[j] = data[i + swizzle[0]]; o[j + 1] = data[i + swizzle[1]]; o[j + 2] = data[i + swizzle[2]] }
    img = sharp(o, { raw: { width: info.width, height: info.height, channels: 3 } })
  }
  if (size) img = img.resize(size, size, { kernel: 'lanczos3' })
  if (kind === 'alpha') return { buf: await img.png({ compressionLevel: 9, palette: false }).toBuffer(), mime: 'image/png' }
  if (kind === 'albedo') img = img.removeAlpha()
  return { buf: await img.jpeg({ quality: kind === 'normal' ? 95 : 90, chromaSubsampling: kind === 'albedo' ? '4:2:0' : '4:4:4', mozjpeg: true }).toBuffer(), mime: 'image/jpeg' }
}
for (const mat of doc$.getRoot().listMaterials()) {
  const spec = maps[mat.getName()]
  if (!spec) { console.log('no maps for', mat.getName()); continue }
  const tex = async (f, o, name) => { const { buf, mime } = await enc(f, o); return doc$.createTexture(name).setImage(buf).setMimeType(mime) }
  mat.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(spec.metallic ?? 0.5).setRoughnessFactor(spec.roughness ?? 1)
  mat.setBaseColorTexture(await tex(spec.albedo, { size: spec.size, kind: spec.alpha ? 'alpha' : 'albedo' }, mat.getName() + '_albedo'))
  mat.setNormalTexture(await tex(spec.normal, { size: spec.size, kind: 'normal' }, mat.getName() + '_normal'))
  const orm = await tex(spec.orm, { size: spec.size, kind: 'data', swizzle: spec.ormSwizzle }, mat.getName() + '_orm')
  mat.setMetallicRoughnessTexture(orm).setOcclusionTexture(orm)
  if (spec.alpha) mat.setAlphaMode('MASK').setAlphaCutoff(spec.alphaCutoff ?? 0.5)
  mat.setDoubleSided(false)
}
await io.write(out, doc$)
const tris = doc$.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((a, p) => a + p.getIndices().getCount() / 3, 0)
console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', 'tris', tris, 'materials', doc$.getRoot().listMaterials().map((m) => m.getName()).join(','))
