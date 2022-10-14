import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from './shaders/terrain-shader'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import axios from 'axios'
import { init, sessionData, initVis, gameState, logMyState } from './util'
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
const pers = [0.05, 0.1, 0.15, 0.2, 0.25]
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
var segsMax: { [key: number]: number } = {}
async function getPersistence() {
    axios
        .get(`http://localhost:5000/test`)
        .then((response) => {
            console.log(response.data)
            pers.forEach((threshold) => {
                persDatas[threshold] = response.data[threshold].array
                segsMax[threshold] = response.data[threshold].max
                var imageData = new Uint8Array(4 * persDatas[threshold].length)
                segsToPixels2[threshold] = {}
                for (var x = 0; x < persDatas[threshold].length; x++) {
                    var segID = persDatas[threshold][x]
                    let tempString = segID.toString()
                    let maskedNumber = tempString.padStart(4, '0')
                    const realId = Array.from(maskedNumber).map(Number)
                    imageData[x * 4] = +realId[0]
                    imageData[x * 4 + 1] = +realId[1]
                    imageData[x * 4 + 2] = +realId[2]
                    imageData[x * 4 + 3] = +realId[3]
                    if (segsToPixels2[threshold][segID]) {
                        segsToPixels2[threshold][segID].push(x)
                    } else {
                        segsToPixels2[threshold][segID] = [x]
                    }
                }
                persTextures[threshold] = new THREE.DataTexture(imageData, 4104, 1856)
                persTextures[threshold].needsUpdate = true
                if (threshold == Math.round(params.pers * 100) / 100) {
                    uniforms.persTexture.value = persTextures[threshold]
                    uniforms.segsMax.value = segsMax[threshold]
                }
            })
        })
        .catch((error) => {
            console.log(error)
        })
}
getPersistence()
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
var params = {
    blur: 0,
    z: 500,
    annotation: 1,
    brushSize: 5,
    pers: 0.1,
    persShow: 0,
    mappedMaxValue: 255,
    guide: 0,
    max: 255,
}
// var persIndex = persToIndex[params.pers];
var uniforms = {
    z: { value: params.z },
    diffuseTexture: { type: 't', value: new THREE.Texture() },
    annotationTexture: { type: 't', value: annotationTexture },
    persTexture: { type: 't', value: new THREE.Texture() },
    colormap: { type: 't', value: new THREE.Texture() },
    annotation: { value: params.annotation },
    segsMax: { type: 'f', value: 0 },
    persShow: { value: params.persShow },
    mappedMaxValue: { type: 'f', value: params.mappedMaxValue },
    hoverValue: { type: 'f', value: 0 },
    guide: { value: params.guide },
}
const meshFolder = gui.addFolder('Mesh Settings')
const viewFolder = gui.addFolder('View Settings')

meshFolder.add(params, 'blur', 0, 2, 1).onFinishChange(() => {
    scene.remove(scene.children[0])
    scene.add(meshes[`z${params.z}blur${params.blur}`])
})
meshFolder.add(params, 'z', 0, 500, 100).onFinishChange(() => {
    scene.remove(scene.children[0])
    uniforms.z.value = params.z
    scene.add(meshes[`z${params.z}blur${params.blur}`])
})
viewFolder.add(params, 'annotation', 0, 1, 1).onFinishChange(() => {
    uniforms.annotation.value = params.annotation
})
viewFolder.add(params, 'pers', 0.05, 0.25, 0.05).onFinishChange(() => {
    uniforms.persTexture.value = persTextures[Math.round(params.pers * 100) / 100]
    uniforms.segsMax.value = segsMax[Math.round(params.pers * 100) / 100]
})
viewFolder.add(params, 'persShow', 0, 3, 1).onFinishChange(() => {
    uniforms.persShow.value = params.persShow
})
viewFolder.add(params, 'brushSize', 1, 50, 1)

viewFolder.open()
// meshFolder.open()

var recentFills: Array<number> = []

function segSelect(x: number, y: number) {
    recentFills = []
    var value = persDatas[Math.round(params.pers * 100) / 100][x + y * 4104]
    var pixels = segsToPixels2[Math.round(params.pers * 100) / 100][value]
    for (var i = 0; i < pixels.length; i++) {
        var x = pixels[i] % 4104
        var y = 1855 - Math.floor(pixels[i] / 4104)
        recentFills.push(x, y)
        context!.fillRect(x, y, 1, 1)
    }
    sessionData.annotatedPixelCount = sessionData.annotatedPixelCount + pixels.length
    annotationTexture.needsUpdate = true
    // uniforms.annotationTexture.value = annotationTexture;
}

const searchFunction = {
    BFS_Down: {
        E: (x: number, y: number, value: number) => data[x + 1 + y * 4104] <= value,
        W: (x: number, y: number, value: number) => data[x - 1 + y * 4104] <= value,
        N: (x: number, y: number, value: number) => data[x + (y + 1) * 4104] <= value,
        S: (x: number, y: number, value: number) => data[x + (y - 1) * 4104] <= value,
        EN: (x: number, y: number, value: number) => data[x + 1 + (y + 1) * 4104] <= value,
        WN: (x: number, y: number, value: number) => data[x - 1 + (y + 1) * 4104] <= value,
        SW: (x: number, y: number, value: number) => data[x - 1 + (y - 1) * 4104] <= value,
        SE: (x: number, y: number, value: number) => data[x + 1 + (y - 1) * 4104] <= value,
    },
    BFS_Hill: {
        E: (x: number, y: number, value: number) => data[x + 1 + y * 4104] >= value,
        W: (x: number, y: number, value: number) => data[x - 1 + y * 4104] >= value,
        N: (x: number, y: number, value: number) => data[x + (y + 1) * 4104] >= value,
        S: (x: number, y: number, value: number) => data[x + (y - 1) * 4104] >= value,
        EN: (x: number, y: number, value: number) => data[x + 1 + (y + 1) * 4104] >= value,
        WN: (x: number, y: number, value: number) => data[x - 1 + (y + 1) * 4104] >= value,
        SW: (x: number, y: number, value: number) => data[x - 1 + (y - 1) * 4104] >= value,
        SE: (x: number, y: number, value: number) => data[x + 1 + (y - 1) * 4104] >= value,
    },
}

function BFS(x: number, y: number, direction: string, color: string) {
    context!.fillStyle = color
    var visited = new Map()
    var stack = []
    visited.set(`${x}, ${y}`, 1)
    stack.push(x, y)
    type ObjectKey = keyof typeof searchFunction
    let _direction = direction as ObjectKey
    while (stack.length > 0) {
        y = stack.pop()!
        x = stack.pop()!
        context!.fillRect(x, y, 1, 1)
        var value = data[x + y * 4104]
        if (searchFunction[_direction].E(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x + 1}, ${y}`, 1)
                stack.push(x + 1, y)
            }
        }
        if (searchFunction[_direction].W(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y}`, 1)
                stack.push(x - 1, y)
            }
        }
        if (searchFunction[_direction].N(x, y, value)) {
            if (!visited.get(`${x}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x}, ${y + 1}`, 1)
                stack.push(x, y + 1)
            }
        }
        if (searchFunction[_direction].S(x, y, value)) {
            if (!visited.get(`${x}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x}, ${y - 1}`, 1)
                stack.push(x, y - 1)
            }
        }
        if (searchFunction[_direction].EN(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x + 1}, ${y + 1}`, 1)
                stack.push(x + 1, y + 1)
            }
        }
        if (searchFunction[_direction].WN(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y + 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y + 1}`, 1)
                stack.push(x - 1, y + 1)
            }
        }
        if (searchFunction[_direction].SW(x, y, value)) {
            if (!visited.get(`${x - 1}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
                visited.set(`${x - 1}, ${y - 1}`, 1)
                stack.push(x - 1, y - 1)
            }
        }
        if (searchFunction[_direction].SE(x, y, value)) {
            if (!visited.get(`${x + 1}, ${y - 1}`)) {
                sessionData.annotatedPixelCount++
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

var guide = false
const pointer = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const onMouseMove = (event: MouseEvent) => {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
}
var polyPoints: Array<number> = []
const state = {
    BFS: true,
    segmentation: true,
    semi: false,
    brushSelection: false,
    polygonSelection: false,
    segEnabled: true,
}

function hoverHandler() {
    console.log(Math.round(params.pers * 100) / 100)
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var point = intersects[0].point
    var x = Math.trunc(point.x)
    var y = Math.ceil(point.y)
    let localId = persDatas[Math.round(params.pers * 100) / 100][x + y * 4104]
    console.log(localId)
    uniforms.hoverValue.value = localId
    params.guide = 1
    uniforms.guide.value = params.guide
}

function BFSHandler() {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var x = Math.trunc(intersects[0].point.x)
    var y = 1856 - Math.ceil(intersects[0].point.y)
    logMyState('f', 'BFS', camera, pointer, x, y)
    BFS(x, y, 'BFS_Down', 'red')
}

function BFS2Handler() {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var x = Math.trunc(intersects[0].point.x)
    var y = 1856 - Math.ceil(intersects[0].point.y)
    logMyState('d', 'BFS2', camera, pointer, x, y)
    BFS(x, y, 'BFS_Hill', 'blue')
}

function brushClearHandler() {
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

    sessionData.annotatedPixelCount -= params.brushSize * params.brushSize
    annotationTexture.needsUpdate = true
    uniforms.annotationTexture.value = annotationTexture
    logMyState('e', 'clear by brush', camera, pointer, x, y, params.brushSize)
}

function brushAnnotationHandler(key: string, color: string) {
    if (!color) {
        console.error('no annotation without color, send color !!')
        return
    }
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var point = intersects[0].point
    var x = Math.trunc(point.x)
    var y = 1856 - Math.ceil(point.y)

    context!.fillStyle = color
    context!.fillRect(
        x - Math.floor(params.brushSize / 2),
        y - Math.floor(params.brushSize / 2),
        params.brushSize,
        params.brushSize
    )
    sessionData.annotatedPixelCount += params.brushSize * params.brushSize
    annotationTexture.needsUpdate = true
    uniforms.annotationTexture.value = annotationTexture
    logMyState(key, 'annotation by brush', camera, pointer, x, y, params.brushSize)
}

function polygonSelectionHandler() {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var point = intersects[0].point
    var x = Math.trunc(point.x)
    var y = 1856 - Math.ceil(point.y)
    polyPoints.push(x, y)
    context!.fillStyle = 'red'
    context!.fillRect(x - 2, y - 2, 4, 4)
    logMyState(
        'p',
        'annotation by Polygon (polypoint added)',
        camera,
        pointer,
        x,
        y,
        params.brushSize
    )
    sessionData.annotatedPixelCount += 16 //follow this with the line selection to minimize the double counting
    annotationTexture.needsUpdate = true
}

function polygonFillHandler() {
    context!.fillStyle = 'red'
    context!.beginPath()
    logMyState('l', 'polygon fill', camera, undefined, undefined, undefined, undefined, polyPoints)
    context!.moveTo(polyPoints[0], polyPoints[1])
    for (var i = 2; i < polyPoints.length; i += 2) {
        context!.lineTo(polyPoints[i], polyPoints[i + 1])
    }
    context!.closePath()
    context!.fill()
    sessionData.numberofClick++
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
        BFS(linePixels[i], linePixels[i + 1], 'BFS_Down', 'red')
    }
    polyPoints = []
    annotationTexture.needsUpdate = true
}

function segAnnoationHandler(key: string, color: string) {
    if (!color) {
        console.error('no annotation without color, send color')
        return
    }
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var x = Math.trunc(intersects[0].point.x)
    var y = Math.floor(intersects[0].point.y)
    context!.fillStyle = color
    logMyState(key, 'segmentation', camera, pointer, x, y)
    segSelect(x, y)
}

function clearAllHandler() {
    for (var i = 0; i < recentFills.length; i += 2) {
        context!.clearRect(recentFills[i], recentFills[i + 1], 1, 1)
    }
    annotationTexture.needsUpdate = true
    logMyState('z', 'reset all', camera, undefined, undefined, undefined)
}

const onKeyPress = (event: KeyboardEvent) => {
    if (event.repeat) {
        return
    }
    if (event.key == 'Escape') {
        camera.position.set(2000, 1000, 1000)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.target = new THREE.Vector3(2000, 1000, -2000)
    } else if (event.key == 'm') {
        ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'block'
    } else if (event.key == 'g') {
        hoverHandler()
    } else if (event.key == 'f' && state.BFS) {
        BFSHandler()
    } else if (event.key == 'd' && state.BFS) {
        BFS2Handler()
    } else if (event.key == 'e' && state.brushSelection) {
        brushClearHandler()
    } else if (event.key == 'r' && state.brushSelection) {
        brushAnnotationHandler('r', 'red')
    } else if (event.key == 't' && state.brushSelection) {
        brushAnnotationHandler('t', 'blue')
    } else if (event.key == 'p' && state.polygonSelection) {
        polygonSelectionHandler()
    } else if (event.key == 'l' && state.polygonSelection) {
        polygonFillHandler()
    } else if (event.key == 'n' && state.segEnabled) {
        segAnnoationHandler('n', 'red')
    } else if (event.key == 'b' && state.segEnabled) {
        segAnnoationHandler('b', 'blue')
    } else if (event.key == 'z') {
        clearAllHandler()
    }
}
const onKeyUp = (event: KeyboardEvent) => {
    if (event.key == 'g') {
        params.guide = 0
        uniforms.guide.value = params.guide
    }
}

function startUp() {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyPress)
    window.addEventListener('keyup', onKeyUp)
}

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
            setTimeout(function () {
                initVis()
            }, 2000)
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
    // let position = new THREE.Vector3()
    // camera.getWorldPosition(position)
    render()
}

function render() {
    renderer.render(scene, camera)
}

function startState() {
    let startStateData = {
        label: 'start',
        aspectRatio: camera.aspect,
        cameraPosition: camera.position.clone(),
        time: new Date(),
    }
    gameState.push({ start: startStateData })
}

function getCameraLastStage() {
    return {
        position: camera.position.clone(),
        lookAt: controls.target,
    }
}

function addMouseEvent() {}

startState()
animate()

export { startUp }
