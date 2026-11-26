import * as THREE from 'three'

let gradient: THREE.DataTexture | null = null
const cache = new Map<string, THREE.MeshToonMaterial>()

function gradientMap(): THREE.DataTexture {
  if (gradient) return gradient
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255])
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.needsUpdate = true
  return gradient
}

export interface ToonOpts {
  emissive?: THREE.ColorRepresentation
  transparent?: boolean
  opacity?: number
  flat?: boolean
}

/** Shared toon material per colour/options so draw calls can batch state. */
export function toon(color: THREE.ColorRepresentation, opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const key = `${String(color)}|${String(opts.emissive ?? '')}|${opts.opacity ?? 1}|${opts.flat ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    emissive: opts.emissive ?? 0x000000,
    transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
  })
  cache.set(key, m)
  return m
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}
