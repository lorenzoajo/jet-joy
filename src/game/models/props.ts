import * as THREE from 'three'
import { mesh, toon } from './toon'

function starShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

const starGeo = new THREE.ExtrudeGeometry(starShape(3, 1.4), { depth: 1, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 2 })
starGeo.center()

export function createStar(): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(starGeo, toon('#ffd23f', { emissive: '#7a5200' })))
  const halo = mesh(new THREE.RingGeometry(4.2, 4.8, 32), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.6, side: THREE.DoubleSide }))
  g.add(halo)
  return g
}

/** Fuel canister hanging from a red balloon. */
export function createFuel(): THREE.Group {
  const g = new THREE.Group()
  const balloon = mesh(new THREE.SphereGeometry(2.4, 16, 12), toon('#ff4d6d'), 0, 3.4, 0)
  balloon.scale.y = 1.15
  g.add(balloon)
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), toon('#ffffff'), 0, 0.6, 0))
  g.add(mesh(new THREE.BoxGeometry(2, 2.4, 1.2), toon('#ffb000'), 0, -1.2, 0))
  g.add(mesh(new THREE.BoxGeometry(2.05, 0.4, 1.25), toon('#2b2b2b'), 0, -1.0, 0))
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), toon('#2b2b2b'), 0.55, 0.2, 0))
  return g
}

export function createRing(): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(new THREE.TorusGeometry(9, 0.9, 10, 32), toon('#36e0c8', { emissive: '#0b5a50' })))
  const inner = mesh(new THREE.CircleGeometry(8.2, 32), new THREE.MeshBasicMaterial({ color: '#b9fff3', transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }))
  g.add(inner)
  return g
}

/** Green double-chevron speed boost. */
export function createBoost(): THREE.Group {
  const g = new THREE.Group()
  const mat = toon('#7dff4f', { emissive: '#1f6a00' })
  const geo = new THREE.ConeGeometry(2.2, 2.6, 3)
  for (let i = 0; i < 2; i++) {
    const c = mesh(geo, mat, 0, 0, -i * 1.8 + 0.9)
    c.rotation.x = -Math.PI / 2
    c.scale.z = 0.35
    g.add(c)
  }
  const orb = mesh(new THREE.SphereGeometry(3.6, 16, 10), new THREE.MeshBasicMaterial({ color: '#d7ffc4', transparent: true, opacity: 0.2, depthWrite: false }))
  g.add(orb)
  return g
}

export interface BlimpModel {
  root: THREE.Group
  prop: THREE.Mesh
  flash: THREE.MeshToonMaterial
}

/** Grumpy blimp with angry eyes. Faces -Z. */
export function createBlimp(): BlimpModel {
  const root = new THREE.Group()
  const flash = new THREE.MeshToonMaterial({ color: '#b07cff', gradientMap: toon('#fff').gradientMap })
  const hull = mesh(new THREE.SphereGeometry(5, 20, 14), flash)
  hull.scale.set(1, 1, 2)
  root.add(hull)
  const finMat = toon('#ffd23f')
  for (let i = 0; i < 4; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.3, 3.2, 3), finMat)
    const a = (i / 4) * Math.PI * 2
    fin.position.set(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 8.2)
    fin.rotation.z = a - Math.PI / 2
    root.add(fin)
  }
  root.add(mesh(new THREE.BoxGeometry(2.6, 1.4, 4), toon('#4a3a6a'), 0, -5.4, 0))
  const prop = mesh(new THREE.BoxGeometry(4, 0.4, 0.2), toon('#2b2b2b'), 0, 0, 10.3)
  root.add(prop)
  const white = toon('#ffffff')
  const black = toon('#1a1a1a')
  for (const s of [1, -1]) {
    root.add(mesh(new THREE.SphereGeometry(1.2, 12, 8), white, s * 1.6, 1.4, -8.8))
    root.add(mesh(new THREE.SphereGeometry(0.55, 10, 6), black, s * 1.5, 1.2, -9.85))
    const brow = mesh(new THREE.BoxGeometry(2, 0.45, 0.4), black, s * 1.6, 2.7, -9.0)
    brow.rotation.z = s * 0.45
    root.add(brow)
  }
  return { root, prop, flash }
}

export function createBubble(): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(1.5, 14, 10), new THREE.MeshToonMaterial({ color: '#ff7ad9', emissive: '#5a0040', transparent: true, opacity: 0.85, gradientMap: toon('#fff').gradientMap }))
}

const bulletGeo = new THREE.CapsuleGeometry(0.25, 1.6, 2, 6)
bulletGeo.rotateX(Math.PI / 2)
const bulletMat = new THREE.MeshBasicMaterial({ color: '#fff27a' })
export function createBullet(): THREE.Mesh {
  return new THREE.Mesh(bulletGeo, bulletMat)
}

/** Flat chevron objective pointer lying in the XZ plane, pointing -Z. */
export function createArrow(): THREE.Group {
  const shape = new THREE.Shape()
  shape.moveTo(0, 2.2)
  shape.lineTo(1.9, -0.2)
  shape.lineTo(0.75, -0.2)
  shape.lineTo(0.75, -2)
  shape.lineTo(-0.75, -2)
  shape.lineTo(-0.75, -0.2)
  shape.lineTo(-1.9, -0.2)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 })
  geo.translate(0, 0, -0.22)
  const g = new THREE.Group()
  const m = mesh(geo, toon('#ffe14d', { emissive: '#806000' }))
  m.rotation.x = -Math.PI / 2
  g.add(m)
  return g
}

export function createLockReticle(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(11, 12.5, 4, 1),
    new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }),
  )
  m.renderOrder = 10
  return m
}
