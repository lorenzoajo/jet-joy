import * as THREE from 'three'
import { mesh, toon } from './toon'

export interface JetModel {
  root: THREE.Group
  /** Inner group that banks/pitches; root only carries position + heading. */
  body: THREE.Group
  flame: THREE.Mesh
}

const BODY = '#9cc3e6'
const ACCENT = '#ff8a3d'
const DARK = '#38485c'
const GLASS = '#3fe0ff'

function plate(points: readonly [number, number][], depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Chunky toy-style F-16 facing -Z, roughly 6 units long. */
export function createJet(): JetModel {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const fuselage = mesh(new THREE.CapsuleGeometry(0.6, 3.4, 6, 14), toon(BODY))
  fuselage.rotation.x = Math.PI / 2
  fuselage.scale.set(1, 1, 0.85)
  body.add(fuselage)

  const nose = mesh(new THREE.ConeGeometry(0.42, 1.3, 14), toon(ACCENT), 0, -0.05, -2.75)
  nose.rotation.x = -Math.PI / 2
  body.add(nose)

  const canopy = mesh(new THREE.SphereGeometry(0.45, 16, 10), toon(GLASS, { emissive: '#0a3a55' }), 0, 0.45, -1.0)
  canopy.scale.set(0.95, 0.85, 2.0)
  body.add(canopy)

  const intake = mesh(new THREE.BoxGeometry(0.75, 0.45, 1.6), toon(DARK), 0, -0.55, -0.1)
  body.add(intake)

  const wingGeo = plate([[0.35, -0.7], [3.0, 1.1], [3.0, 1.6], [0.35, 1.9]], 0.12)
  const rightWing = mesh(wingGeo, toon(BODY))
  rightWing.rotation.x = Math.PI / 2
  body.add(rightWing)
  const leftWing = rightWing.clone()
  leftWing.scale.x = -1
  body.add(leftWing)

  const stripeGeo = new THREE.BoxGeometry(0.9, 0.16, 0.22)
  for (const s of [1, -1]) {
    body.add(mesh(stripeGeo, toon(ACCENT), s * 2.3, 0.02, 1.15))
    const missile = mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8), toon('#ffffff'), s * 3.08, 0, 0.9)
    missile.rotation.x = Math.PI / 2
    body.add(missile)
    const tip = mesh(new THREE.ConeGeometry(0.09, 0.3, 8), toon('#ff4d6d'), s * 3.08, 0, 0.0)
    tip.rotation.x = -Math.PI / 2
    body.add(tip)
  }

  const stabGeo = plate([[0.3, 1.8], [1.5, 2.6], [1.5, 2.95], [0.3, 2.95]], 0.1)
  const rightStab = mesh(stabGeo, toon(BODY))
  rightStab.rotation.x = Math.PI / 2
  body.add(rightStab)
  const leftStab = rightStab.clone()
  leftStab.scale.x = -1
  body.add(leftStab)

  const fin = mesh(plate([[0.9, 0.3], [2.3, 2.0], [2.8, 2.0], [2.75, 0.3]], 0.12), toon(BODY))
  fin.rotation.y = -Math.PI / 2
  body.add(fin)
  const finTip = mesh(new THREE.BoxGeometry(0.16, 0.25, 0.6), toon(ACCENT), 0, 1.95, 2.55)
  body.add(finTip)

  const nozzle = mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.6, 14, 1, true), toon(DARK), 0, 0, 2.55)
  nozzle.rotation.x = Math.PI / 2
  body.add(nozzle)

  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb340', transparent: true, opacity: 0.9 })
  const flame = mesh(new THREE.ConeGeometry(0.36, 1.6, 12), flameMat, 0, 0, 3.6)
  flame.rotation.x = Math.PI / 2
  body.add(flame)

  return { root, body, flame }
}
