import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from './shaders/terrain-shader'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import axios from 'axios'
import { startSession, endSession, init } from './util'
import './styles/style.css'
// import * as fs from 'fs'

var data: number[] = []
var elevImage = new Image()
elevImage.src = 'img/elevation.png'
var elevateCanvas = document.getElementById('elevateCanvas') as HTMLCanvasElement
var ctx = elevateCanvas.getContext('2d')!
elevImage.onload = function () {
    ctx.drawImage(elevImage, 0, 0)
    var tempData = Array.from(ctx.getImageData(0, 0, elevImage.width, elevImage.height).data)
    for (var i = 0; i < tempData.length; i += 4) {
        data.push(tempData[i])
    }
}
window.onload = init
const scene = new THREE.Scene()
// const blurs = [0, 1, 2];
// const zs = [100, 200, 300, 400, 500];
const blurs = [0]
const zs = [500]
const pers = [20, 30, 40, 50]
var meshes: { [key: string]: Mesh } = {}

// var persToSegs : {[key: number]: number} = {
//     20: 242,
//     30: 116,
//     40: 56,
//     50: 34
// };
// var persToIndex : {[key: number]: number} = {
//     20: 0,
//     30: 1,
//     40: 2,
//     50: 3
// };
// var segsToPixels = Array(pers.length);
// var segDatas = Array(pers.length);

const persLoader = new THREE.TextureLoader()
// var persTextures : {[key: number]: THREE.Texture} = { };
// var persCanvas = document.getElementById("streamCanvas") as HTMLCanvasElement;
// var persctx = persCanvas.getContext('2d')!;
// pers.forEach((thresh, i) => {
//    persLoader.load(
//         `./img/pers${thresh}.png`,
//         function (texture) {
//           persTextures[thresh] = texture;
//           if (thresh == 50) {
//             uniforms.persTexture.value = texture;
//           }
//         },
//         undefined,
//         function (err) {
//           console.error("An error happened.");
//         }
//     );
//     segDatas[i] = [];
//     segsToPixels[i] = {};
//     var persImage = new Image();
//     persImage.src = `img/pers${pers[i]}.png`;
//     persImage.onload = function(){
//         try {
//             persctx.drawImage(persImage, 0, 0);
//             var tempData = Array.from(persctx.getImageData(0, 0, persImage.width, persImage.height).data);
//             for (var x = 0; x < tempData.length; x+=4) {
//                 segDatas[i].push(tempData[x]);
//                 if (segsToPixels[i][tempData[x]]) {
//                     segsToPixels[i][tempData[x]].push(x / 4);
//                 } else {
//                     segsToPixels[i][tempData[x]] = [x / 4];
//                 }
//             }
//         } catch (error) {
//             console.log(error);
//         }
//     }
// });
var segsToPixels2: {
    [key: number]: {
        [key: number]: Array<number>
    }
} = {}
var persDatas: {
    [key: number]: Array<number>
} = {}
var persTextures: { [key: number]: THREE.Texture } = {}
async function getPersistence(threshold: number) {
    axios
        .get(`http://localhost:5000/test?threshold=${threshold}`)
        .then((response) => {
            console.log(response.data)
            persDatas[threshold] = response.data.array
            var imageData = new Uint8Array(4 * persDatas[threshold].length)
            segsToPixels2[threshold] = {}
            for (var x = 0; x < persDatas[threshold].length; x++) {
                var segID = Math.floor((255 * persDatas[threshold][x]) / response.data.max)
                imageData[x * 4] = segID
                imageData[x * 4 + 1] = segID
                imageData[x * 4 + 2] = segID
                imageData[x * 4 + 3] = 255
                if (segsToPixels2[threshold][persDatas[threshold][x]]) {
                    segsToPixels2[threshold][persDatas[threshold][x]].push(x)
                } else {
                    segsToPixels2[threshold][persDatas[threshold][x]] = [x]
                }
            }
            console.log(imageData)
            var texture = new THREE.DataTexture(imageData, 4104, 1856)
            texture.needsUpdate = true
            persTextures[threshold] = texture
            uniforms.persTexture.value = texture
        })
        .catch((error) => {
            console.log(error)
        })
}
getPersistence(50)
persLoader.load(
    './img/rainbow.png',
    function (texture) {
        uniforms.colormap.value = texture
    },
    undefined,
    function (err) {
        console.error('An error happened.')
    }
)
// const light = new THREE.SpotLight()
// light.position.set(4000, 4000, 20)
// scene.add(light)
// const ambient = new THREE.AmbientLight( 0x404040 ); // soft white light
// scene.add( ambient );

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000)
camera.position.set(2000, 1000, 1000)

const renderer = new THREE.WebGLRenderer()
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

let controls = new OrbitControls(camera, renderer.domElement)
controls.target = new THREE.Vector3(2000, 1000, -2000)

var canvas = document.createElement('canvas')
canvas.width = 4104
canvas.height = 1856
var annotationTexture = new THREE.Texture(canvas)
var context = canvas.getContext('2d')

const gui = new GUI()
var params = { blur: 0, z: 500, annotation: 1, brushSize: 5, pers: 50, persShow: 0 }
// var persIndex = persToIndex[params.pers];
var uniforms = {
    z: { value: params.z },
    diffuseTexture: { type: 't', value: new THREE.Texture() },
    annotationTexture: { type: 't', value: annotationTexture },
    persTexture: { type: 't', value: new THREE.Texture() },
    colormap: { type: 't', value: new THREE.Texture() },
    pers: { value: params.pers },
    annotation: { value: params.annotation },
    persShow: { value: params.persShow },
}
const meshFolder = gui.addFolder('Mesh Settings')
const viewFolder = gui.addFolder('View Settings')
meshFolder.add(params, 'blur', 0, 2, 1).onFinishChange(() => {
    scene.remove(scene.children[0])
    scene.add(meshes[`z${params.z}blur${params.blur}`])
})
meshFolder.add(params, 'z', 100, 500, 100).onFinishChange(() => {
    scene.remove(scene.children[0])
    uniforms.z.value = params.z
    scene.add(meshes[`z${params.z}blur${params.blur}`])
})
viewFolder.add(params, 'annotation', 0, 1, 1).onFinishChange(() => {
    uniforms.annotation.value = params.annotation
})
viewFolder.add(params, 'pers', 20, 50, 10).onFinishChange(() => {
    if (persTextures[params.pers]) {
        uniforms.persTexture.value = persTextures[params.pers]
    } else {
        getPersistence(params.pers)
    }
})
viewFolder.add(params, 'persShow', 0, 3, 1).onFinishChange(() => {
    uniforms.persShow.value = params.persShow
})
viewFolder.add(params, 'brushSize', 1, 50, 1)

viewFolder.open()
meshFolder.open()

var recentFills: Array<number> = []
var visitedFlood = new Map()
function BFS(x: number, y: number) {
    recentFills = []
    context!.fillStyle = 'red'
    // var visited = new Map();
    var stack = []
    visitedFlood.set(`${x}, ${y}`, 1)
    stack.push(x, y)
    while (stack.length > 0) {
        y = stack.pop()!
        x = stack.pop()!
        recentFills.push(x, y)
        context!.fillRect(x, y, 1, 1)
        var value = data[x + y * 4104]
        if (data[x + 1 + y * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y}`)) {
                visitedFlood.set(`${x + 1}, ${y}`, 1)
                stack.push(x + 1, y)
            }
        }
        if (data[x - 1 + y * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y}`)) {
                visitedFlood.set(`${x - 1}, ${y}`, 1)
                stack.push(x - 1, y)
            }
        }
        if (data[x + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x}, ${y + 1}`)) {
                visitedFlood.set(`${x}, ${y + 1}`, 1)
                stack.push(x, y + 1)
            }
        }
        if (data[x + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x}, ${y - 1}`)) {
                visitedFlood.set(`${x}, ${y - 1}`, 1)
                stack.push(x, y - 1)
            }
        }
        if (data[x + 1 + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y + 1}`)) {
                visitedFlood.set(`${x + 1}, ${y + 1}`, 1)
                stack.push(x + 1, y + 1)
            }
        }
        if (data[x - 1 + (y + 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y + 1}`)) {
                visitedFlood.set(`${x - 1}, ${y + 1}`, 1)
                stack.push(x - 1, y + 1)
            }
        }
        if (data[x - 1 + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x - 1}, ${y - 1}`)) {
                visitedFlood.set(`${x - 1}, ${y - 1}`, 1)
                stack.push(x - 1, y - 1)
            }
        }
        if (data[x + 1 + (y - 1) * 4104] <= value) {
            if (!visitedFlood.get(`${x + 1}, ${y - 1}`)) {
                visitedFlood.set(`${x + 1}, ${y - 1}`, 1)
                stack.push(x + 1, y - 1)
            }
        }
    }
    annotationTexture.needsUpdate = true
    // uniforms.annotationTexture.value = annotationTexture;
}

function segSelect(x: number, y: number) {
    recentFills = []
    var value = persDatas[params.pers][x + y * 4104]
    console.log(params.pers, value)
    var pixels = segsToPixels2[params.pers][value]
    for (var i = 0; i < pixels.length; i++) {
        var x = pixels[i] % 4104
        var y = 1855 - Math.floor(pixels[i] / 4104)
        recentFills.push(x, y)
        context!.fillRect(x, y, 1, 1)
    }
    annotationTexture.needsUpdate = true
    // uniforms.annotationTexture.value = annotationTexture;
}
function BFS2(x: number, y: number) {
    context!.fillStyle = 'blue'
    var visited = new Map()
    var stack = []
    visited.set(`${x}, ${y}`, 1)
    stack.push(x, y)
    while (stack.length > 0) {
        y = stack.pop()!
        x = stack.pop()!
        context!.fillRect(x, y, 1, 1)
        var value = data[x + y * 4104]
        if (data[x + 1 + y * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y}`)) {
                visited.set(`${x + 1}, ${y}`, 1)
                stack.push(x + 1, y)
            }
        }
        if (data[x - 1 + y * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y}`)) {
                visited.set(`${x - 1}, ${y}`, 1)
                stack.push(x - 1, y)
            }
        }
        if (data[x + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x}, ${y + 1}`)) {
                visited.set(`${x}, ${y + 1}`, 1)
                stack.push(x, y + 1)
            }
        }
        if (data[x + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x}, ${y - 1}`)) {
                visited.set(`${x}, ${y - 1}`, 1)
                stack.push(x, y - 1)
            }
        }
        if (data[x + 1 + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y + 1}`)) {
                visited.set(`${x + 1}, ${y + 1}`, 1)
                stack.push(x + 1, y + 1)
            }
        }
        if (data[x - 1 + (y + 1) * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y + 1}`)) {
                visited.set(`${x - 1}, ${y + 1}`, 1)
                stack.push(x - 1, y + 1)
            }
        }
        if (data[x - 1 + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x - 1}, ${y - 1}`)) {
                visited.set(`${x - 1}, ${y - 1}`, 1)
                stack.push(x - 1, y - 1)
            }
        }
        if (data[x + 1 + (y - 1) * 4104] >= value) {
            if (!visited.get(`${x + 1}, ${y - 1}`)) {
                visited.set(`${x + 1}, ${y - 1}`, 1)
                stack.push(x + 1, y - 1)
            }
        }
    }
    annotationTexture.needsUpdate = true
    // uniforms.annotationTexture.value = annotationTexture;
}

function fpart(x: number) {
    return x - Math.floor(x)
}
function rfpart(x: number) {
    return 1 - fpart(x)
}

var erase = false
const pointer = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const onMouseMove = (event: MouseEvent) => {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    if (erase) {
        // raycaster.setFromCamera(pointer, camera);
        // const intersects = raycaster.intersectObjects(scene.children);
        // var point = intersects[0].point;
        // var x = Math.trunc(point.x);
        // var y = 1856 - Math.ceil(point.y);
        // console.log(x, y);
        // context!.clearRect(x - 2, y - 2, 5, 5);
        // annotationTexture.needsUpdate = true;
        // uniforms.annotationTexture.value = annotationTexture;
    }
}
var polyPoints: Array<number> = []
const onKeyPress = (event: KeyboardEvent) => {
    if (event.key == 'Escape') {
        camera.position.set(2000, 1000, 1000)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.target = new THREE.Vector3(2000, 1000, -2000)
    } else if (event.key == 'f') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var x = Math.trunc(intersects[0].point.x)
        var y = 1856 - Math.ceil(intersects[0].point.y)
        BFS(x, y)
    } else if (event.key == 'd') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var x = Math.trunc(intersects[0].point.x)
        var y = 1856 - Math.ceil(intersects[0].point.y)
        BFS2(x, y)
    } else if (event.key == 'e') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var point = intersects[0].point
        var x = Math.trunc(point.x)
        var y = 1856 - Math.ceil(point.y)
        context!.clearRect(
            x - Math.floor(params.brushSize / 2),
            y - Math.floor(params.brushSize / 2),
            params.brushSize,
            params.brushSize
        )
        annotationTexture.needsUpdate = true
        uniforms.annotationTexture.value = annotationTexture
    } else if (event.key == 'r') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var point = intersects[0].point
        var x = Math.trunc(point.x)
        var y = 1856 - Math.ceil(point.y)
        context!.fillStyle = 'red'
        context!.fillRect(
            x - Math.floor(params.brushSize / 2),
            y - Math.floor(params.brushSize / 2),
            params.brushSize,
            params.brushSize
        )
        annotationTexture.needsUpdate = true
        uniforms.annotationTexture.value = annotationTexture
    } else if (event.key == 't') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var point = intersects[0].point
        var x = Math.trunc(point.x)
        var y = 1856 - Math.ceil(point.y)
        context!.fillStyle = 'blue'
        context!.fillRect(
            x - Math.floor(params.brushSize / 2),
            y - Math.floor(params.brushSize / 2),
            params.brushSize,
            params.brushSize
        )
        annotationTexture.needsUpdate = true
        uniforms.annotationTexture.value = annotationTexture
    } else if (event.key == 'p') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var point = intersects[0].point
        var x = Math.trunc(point.x)
        var y = 1856 - Math.ceil(point.y)
        polyPoints.push(x, y)
        context!.fillStyle = 'red'
        context!.fillRect(x - 2, y - 2, 4, 4)
        annotationTexture.needsUpdate = true
    } else if (event.key == 'l') {
        context!.fillStyle = 'red'
        context!.beginPath()
        context!.moveTo(polyPoints[0], polyPoints[1])
        for (var i = 2; i < polyPoints.length; i += 2) {
            context!.lineTo(polyPoints[i], polyPoints[i + 1])
        }
        context!.closePath()
        context!.fill()
        var linePixels: Array<number> = []
        for (var i = 0; i < polyPoints.length; i += 2) {
            var x0 = polyPoints[i]
            var y0 = polyPoints[i + 1]
            var x1, y1
            if (i + 2 == polyPoints.length) {
                x1 = polyPoints[0]
                y1 = polyPoints[1]
            } else {
                x1 = polyPoints[i + 2]
                y1 = polyPoints[i + 3]
            }
            var steep: boolean = Math.abs(y1 - y0) > Math.abs(x1 - x0)
            if (steep) {
                ;[x0, y0] = [y0, x0]
                ;[x1, y1] = [y1, x1]
            }
            if (x0 > x1) {
                ;[x0, x1] = [x1, x0]
                ;[y0, y1] = [y1, y0]
            }
            var dx = x1 - x0
            var dy = y1 - y0
            var gradient
            if (dx == 0) {
                gradient = 1
            } else {
                gradient = dy / dx
            }
            var xend = x0
            var yend = y0
            var xpxl1 = xend
            var ypxl1 = yend
            if (steep) {
                linePixels.push(ypxl1, xpxl1)
                linePixels.push(ypxl1 + 1, xpxl1)
            } else {
                linePixels.push(xpxl1, ypxl1)
                linePixels.push(xpxl1, ypxl1 + 1)
            }
            var intery = yend + gradient
            xend = x1
            yend = y1
            var xpxl2 = xend
            var ypxl2 = yend
            if (steep) {
                linePixels.push(ypxl2, xpxl2)
                linePixels.push(ypxl2 + 1, xpxl2)
            } else {
                linePixels.push(xpxl2, ypxl2)
                linePixels.push(xpxl2, ypxl2 + 1)
            }
            if (steep) {
                for (var x = xpxl1 + 1; x < xpxl2; x++) {
                    linePixels.push(Math.floor(intery), x)
                    linePixels.push(Math.floor(intery) + 1, x)
                    intery = intery + gradient
                }
            } else {
                for (var x = xpxl1 + 1; x < xpxl2; x++) {
                    linePixels.push(x, Math.floor(intery))
                    linePixels.push(x, Math.floor(intery) + 1)
                    intery = intery + gradient
                }
            }
        }
        for (var i = 0; i < linePixels.length; i += 2) {
            BFS(linePixels[i], linePixels[i + 1])
        }
        polyPoints = []
        annotationTexture.needsUpdate = true
    } else if (event.key == 'n') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var x = Math.trunc(intersects[0].point.x)
        var y = Math.floor(intersects[0].point.y)
        context!.fillStyle = 'red'
        segSelect(x, y)
    } else if (event.key == 'b') {
        raycaster.setFromCamera(pointer, camera)
        const intersects = raycaster.intersectObjects(scene.children)
        var x = Math.trunc(intersects[0].point.x)
        var y = Math.floor(intersects[0].point.y)
        context!.fillStyle = 'blue'
        segSelect(x, y)
    } else if (event.key == 'z') {
        for (var i = 0; i < recentFills.length; i += 2) {
            context!.clearRect(recentFills[i], recentFills[i + 1], 1, 1)
        }
        annotationTexture.needsUpdate = true
    }
}
const onKeyUp = (event: KeyboardEvent) => {
    if (event.key == 'e') {
        erase = false
    }
}
window.addEventListener('mousemove', onMouseMove)
window.addEventListener('keydown', onKeyPress)
window.addEventListener('keyup', onKeyUp)

const satelliteLoader = new THREE.TextureLoader()
satelliteLoader.load(
    './img/satelliteblur0.png',
    function (texture) {
        uniforms.diffuseTexture.value = texture
        const meshMaterial = new THREE.RawShaderMaterial({
            uniforms: uniforms,
            vertexShader: terrainShader._VS,
            fragmentShader: terrainShader._FS,
        })
        const terrainLoader = new STLLoader()
        blurs.forEach((blur) => {
            zs.forEach((z) => {
                terrainLoader.load(
                    `stl/elev${z}blur${blur}.stl`,
                    function (geometry) {
                        geometry.computeBoundingBox()
                        geometry.computeVertexNormals()

                        const mesh = new THREE.Mesh(geometry, meshMaterial)
                        mesh.receiveShadow = true
                        mesh.castShadow = true
                        mesh.position.set(0, 0, -100)
                        meshes[`z${z}blur${blur}`] = mesh
                        if (blur == 0 && z == 500) {
                            scene.add(mesh)
                            console.log(scene)
                        }
                    },
                    (xhr) => {
                        // console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
                    },
                    (error) => {
                        console.log(error)
                    }
                )
            })
        })
    },
    undefined,
    function (err) {
        console.error('An error happened.')
    }
)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    requestAnimationFrame(animate)

    controls.update()

    render()
}

function render() {
    renderer.render(scene, camera)
}

animate()
