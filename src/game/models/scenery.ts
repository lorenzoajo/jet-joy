import * as THREE from 'three'
import type { Island } from '../layout'
import { range, type Rng } from '../rng'
import { mesh, toon } from './toon'

export const SKY_TOP = '#3d8bff'
export const SKY_HORIZON = '#bfe8ff'

export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(2500, 24, 12)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_TOP) }, horizon: { value: new THREE.Color(SKY_HORIZON) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, h), 1.0); }',
  })
  return new THREE.Mesh(geo, mat)
}

export function createSea(): THREE.Group {
  const g = new THREE.Group()
  const sea = mesh(new THREE.CircleGeometry(2400, 48), toon('#2fb3e0'))
  sea.rotation.x = -Math.PI / 2
  g.add(sea)
  // Light ring "foam" around the play area shows the soft edge of the world.
  const edge = mesh(new THREE.RingGeometry(700, 712, 64), new THREE.MeshBasicMaterial({ color: '#e9fbff', transparent: true, opacity: 0.5 }), 0, 0.2, 0)
  edge.rotation.x = -Math.PI / 2
  g.add(edge)
  return g
}

const GRASS = ['#7ddc5a', '#8fe36b', '#6fcf5d']
const ROCK = ['#c9946a', '#b98560', '#d8a578']

export function createIsland(isl: Island, rng: Rng): THREE.Group {
  const g = new THREE.Group()
  g.position.set(isl.x, isl.top, isl.z)
  const grass = toon(GRASS[Math.floor(rng() * GRASS.length)] ?? '#7ddc5a', { flat: true })
  const rock = toon(ROCK[Math.floor(rng() * ROCK.length)] ?? '#c9946a', { flat: true })

  g.add(mesh(new THREE.CylinderGeometry(isl.radius, isl.radius * 0.96, 3, 18), grass, 0, -1.5, 0))
  const under = mesh(new THREE.ConeGeometry(isl.radius * 0.96, isl.depth, 9, 2), rock, 0, -3 - isl.depth / 2, 0)
  under.rotation.x = Math.PI
  g.add(under)

  const trunk = toon('#8a5a3b')
  const leaves = toon('#3fbf5f', { flat: true })
  const trees = Math.floor(isl.radius / 9)
  for (let i = 0; i < trees; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * isl.radius * 0.8
    const s = range(rng, 0.8, 1.5)
    const tree = new THREE.Group()
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
    tree.scale.setScalar(s)
    tree.add(mesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), trunk, 0, 1.5, 0))
    tree.add(mesh(new THREE.ConeGeometry(2.4, 5, 7), leaves, 0, 5, 0))
    g.add(tree)
  }
  return g
}

export function createCloud(rng: Rng): THREE.Group {
  const g = new THREE.Group()
  const mat = toon('#ffffff', { emissive: '#3a4a5a' })
  const puffs = 3 + Math.floor(rng() * 3)
  const geo = new THREE.IcosahedronGeometry(1, 1)
  for (let i = 0; i < puffs; i++) {
    const p = mesh(geo, mat, (i - puffs / 2) * range(rng, 5, 8), range(rng, -1, 2), range(rng, -3, 3))
    p.scale.setScalar(range(rng, 6, 10))
    g.add(p)
  }
  return g
}
