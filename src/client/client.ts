import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { terrainShader } from './shaders/terrain-shader'
import { GUI } from 'dat.gui'
import { Mesh } from 'three'
import axios from 'axios'
import {
    init,
    sessionData,
    initVis,
    gameState,
    logMyState,
    getLocalCordinate,
    readstateFile,
} from './util'
import {
    terrainDimensions
} from './constants'
import './styles/style.css'
import * as tiff from "tiff"

let Developer = false
let overRideControl = false
var data: Float32Array
let _fetchData: any
let mesh: THREE.Mesh
var elevImage = new Image()
elevImage.src = 'img/elevation.png'
var elevateCanvas = document.getElementById('elevateCanvas') as HTMLCanvasElement
var ctx = elevateCanvas.getContext('2d')!
fetch("img/elevation.tiff").then((res) => res.arrayBuffer().then(function(arr) {
    var tif = tiff.decode(arr)
    data = tif[0].data as Float32Array;
}));
window.onload = init
const scene = new THREE.Scene()
// const blurs = [0, 1, 2];
// const zs = [100, 200, 300, 400, 500];
const blurs = [0]
const zs = [0, 500]
// const pers = [0.02, 0.04, 0.06, 0.08, 0.1]
const pers = [0.06]
var meshes: { [key: string]: Mesh } = {}
let eventFunction: any
let _readstateFile: () => {}
if (Developer) {
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'none'
    eventFunction = {
        BFS_Down: (x: number, y: number) => BFSHandler(x, y),
        BFS_Hill: (x: number, y: number) => BFS2Handler(x, y),
        brushClear: (x: number, y: number) => brushClearHandler(x, y),
        brushAnnotationred: (x: number, y: number) => brushAnnotationHandler('r', 'red', x, y),
        brushAnnotationblue: (x: number, y: number) => brushAnnotationHandler('t', 'blue', x, y),
        polygonSelector: (x: number, y: number) => polygonSelectionHandler(x, y),
        polygonFill: (x: number, y: number) => polygonFillHandler(),
        segmentationred: (x: number, y: number) => segAnnotationHandler('n', 'red', x, y),
        segmentationblue: (x: number, y: number) => segAnnotationHandler('b', 'blue', x, y),
        resetAll: (x: number, y: number) => clearAllHandler(),
    }
    _readstateFile = async () => {
        const array = await readstateFile()
        type eventKey = keyof typeof eventFunction
        let startUp = array[0].start
        let _cameraPosition = startUp.cameraPosition
        let _target = startUp.targetPosition
        camera.position.set(_cameraPosition.x, _cameraPosition.y, _cameraPosition.z)
        controls.target.set(_target.x, _target.y, _target.z)
        controls.update()
        for (let i = 1, _length = array.length; i < _length; i++) {
            let event = array[i].mouseEvent
            let _cameraPosition = event.cameraPosition
            let _target = event.targetPosition
            camera.position.set(_cameraPosition.x, _cameraPosition.y, _cameraPosition.z)
            controls.target.set(_target.x, _target.y, _target.z)
            controls.update()
            let x, y
            if (event.x == undefined) {
                x = 0
                y = 0
            } else {
                x = event.x
                y = event.y
            }
            let _action = event.label as eventKey
            eventFunction[_action](x, y)
        }
    }
}

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
            console.time("process")
            for (var i = 0; i < pers.length; i++) {
                persDatas[pers[i]] = response.data[pers[i]].array
                segsMax[pers[i]] = response.data[pers[i]].max
                var imageData = new Uint8Array(4 * persDatas[pers[i]].length)
                segsToPixels2[pers[i]] = {}
                for (var x = 0; x < persDatas[pers[i]].length; x++) {
                    var segID = persDatas[pers[i]][x]
                    // let tempString = segID.toString()
                    // let maskedNumber = tempString.padStart(4, '0')
                    // const realId = Array.from(maskedNumber).map(Number)
                    // imageData[x * 4] = +realId[0]
                    // imageData[x * 4 + 1] = +realId[1]
                    // imageData[x * 4 + 2] = +realId[2]
                    // imageData[x * 4 + 3] = +realId[3]
                    if (segsToPixels2[pers[i]][segID]) {
                        segsToPixels2[pers[i]][segID].push(x)
                    } else {
                        segsToPixels2[pers[i]][segID] = [x]
                    }
                }
                persTextures[pers[i]] = new THREE.DataTexture(imageData, 4104, 1856)
                persTextures[pers[i]].needsUpdate = true
                if (pers[i] == Math.round(params.pers * 100) / 100) {
                    uniforms.persTexture.value = persTextures[pers[i]]
                    uniforms.segsMax.value = segsMax[pers[i]]
                }
            }
            console.timeEnd("process")

            if (Developer) {
                _readstateFile()
            }
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

const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true })
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
    pers: 0.06,
    persShow: 0,
    guide: 0,
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
    hoverValue: { type: 'f', value: 0 },
    guide: { value: params.guide },
}
const meshFolder = gui.addFolder('Mesh Settings')
const viewFolder = gui.addFolder('View Settings')

// meshFolder.add(params, 'blur', 0, 2, 1).onFinishChange(() => {
//     scene.remove(scene.children[0])
//     scene.add(meshes[`z${params.z}blur${params.blur}`])
// })
viewFolder.add(params, 'z', 0, 500, 500).onFinishChange(() => {
    scene.remove(scene.children[0])
    uniforms.z.value = params.z
    scene.add(meshes[`z${params.z}blur${params.blur}`])
})
viewFolder.add(params, 'annotation', 0, 1, 1).onFinishChange(() => {
    uniforms.annotation.value = params.annotation
})
viewFolder.add(params, 'pers', 0.02, 0.1, 0.02).onFinishChange(() => {
    uniforms.persTexture.value = persTextures[Math.round(params.pers * 100) / 100]
    uniforms.segsMax.value = segsMax[Math.round(params.pers * 100) / 100]
})
viewFolder.add(params, 'persShow', 0, 3, 1).onFinishChange(() => {
    uniforms.persShow.value = params.persShow
})
viewFolder.add(params, 'brushSize', 1, 50, 1)

viewFolder.open()
// meshFolder.open()

var recentFills: Array<Array<number>> = []
var recentPolys: Array<Array<number>> = []

function segSelect(x: number, y: number) {
    recentPolys.push([])
    recentFills.push([])
    var value = persDatas[Math.round(params.pers * 100) / 100][x + y * 4104]
    var pixels = segsToPixels2[Math.round(params.pers * 100) / 100][value]
    for (var i = 0; i < pixels.length; i++) {
        var x = pixels[i] % 4104
        var y = 1855 - Math.floor(pixels[i] / 4104)
        recentFills[recentFills.length - 1].push(x, y)
        context!.fillRect(x, y, 1, 1)
    }
    sessionData.annotatedPixelCount = sessionData.annotatedPixelCount + pixels.length
    annotationTexture.needsUpdate = true
}

function connectedSegSelect(x: number, y: number, color: string) {
    recentFills.push([])
    recentPolys.push([])
    visited = new Map()
    BFS(x, y, "BFS_Segment", color)
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
    BFS_Segment: {
        E: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x + 1 + y * 4104] == value,
        W: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x - 1 + y * 4104] == value,
        N: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x + (y + 1) * 4104] == value,
        S: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x + (y - 1) * 4104] == value,
        EN: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x + 1 + (y + 1) * 4104] == value,
        WN: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x - 1 + (y + 1) * 4104] == value,
        SW: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x - 1 + (y - 1) * 4104] == value,
        SE: (x: number, y: number, value: number) => persDatas[Math.round(params.pers * 100) / 100][x + 1 + (y - 1) * 4104] == value,
    }
}

const valueFunction = {
    BFS_Down: (x: number, y: number) => data[x + y * 4104],
    BFS_Hill: (x: number, y: number) => data[x + y * 4104],
    BFS_Segment: (x: number, y: number) => persDatas[Math.round(params.pers * 100) / 100][x + y * 4104],
}

const fillFunction = {
    BFS_Down: (x: number, y: number) => [x, 1855 - y],
    BFS_Hill: (x: number, y: number) => [x, 1855 - y],
    BFS_Segment: (x: number, y: number) => [x, 1855 - y],
}

var visited = new Map()
function BFS(x: number, y: number, direction: string, color: string) {
    context!.fillStyle = color
    var stack = []
    visited.set(`${x}, ${y}`, 1)
    stack.push(x, y)
    type ObjectKey = keyof typeof searchFunction
    let _direction = direction as ObjectKey
    while (stack.length > 0) {
        y = stack.pop()!
        x = stack.pop()!
        let [fillX, fillY] = fillFunction[_direction](x, y)
        context!.fillRect(fillX, fillY, 1, 1)
        recentFills[recentFills.length - 1].push(fillX, fillY)
        var value = valueFunction[_direction](x, y)
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
    polygonSelection: true,
    segEnabled: true,
}

function performRayCasting() {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObjects(scene.children)
    var point = intersects[0].point
    var x = Math.trunc(point.x)
    var y = Math.ceil(point.y)
    return [x, y]
}

function hoverHandler() {
    let [x, y] = performRayCasting()
    let localId = persDatas[Math.round(params.pers * 100) / 100][x + y * 4104]
    console.log(localId)
    uniforms.hoverValue.value = localId
    params.guide = 1
    uniforms.guide.value = params.guide
}

function BFSHandler(x: number, y: number) {
    logMyState('f', 'BFS_Down', camera, pointer, x, y)
    visited = new Map()
    recentFills.push([])
    recentPolys.push([])
    BFS(x, y, 'BFS_Down', 'red')
}

function BFS2Handler(x: number, y: number) {
    logMyState('d', 'BFS_Hill', camera, pointer, x, y)
    visited = new Map()
    recentFills.push([])
    recentPolys.push([])
    BFS(x, y, 'BFS_Hill', 'blue')
}

function brushClearHandler(x: number, y: number) {
    context!.clearRect(
        x - Math.floor(params.brushSize / 2),
        y - Math.floor(params.brushSize / 2),
        params.brushSize,
        params.brushSize
    )

    sessionData.annotatedPixelCount -= params.brushSize * params.brushSize
    annotationTexture.needsUpdate = true
    uniforms.annotationTexture.value = annotationTexture
    logMyState('e', 'brushClear', camera, pointer, x, y, params.brushSize)
}

function brushAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color !!')
        return
    }

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
    logMyState(key, 'brushAnnotation' + color, camera, pointer, x, y, params.brushSize)
}

function polygonSelectionHandler(x: number, y: number) {
    polyPoints.push(x, y)
    context!.fillStyle = 'red'
    context!.fillRect(x - 2, 1855 - y - 2, 4, 4)
    logMyState('p', 'polygonSelector', camera, pointer, x, y, params.brushSize)
    sessionData.annotatedPixelCount += 16 //follow this with the line selection to minimize the double counting
    annotationTexture.needsUpdate = true
}

function polygonFillHandler() {
    context!.fillStyle = 'red'
    context!.beginPath()
    logMyState('l', 'polygonFill', camera, undefined, undefined, undefined, undefined, polyPoints)
    recentPolys.push(polyPoints)
    context!.moveTo(polyPoints[0], 1855 - polyPoints[1])
    for (var i = 2; i < polyPoints.length; i += 2) {
        context!.lineTo(polyPoints[i], 1855 - polyPoints[i + 1])
        context!.clearRect(polyPoints[i] - 2, 1855 - polyPoints[i + 1] - 2, 4, 4)
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
    recentFills.push([])
    visited = new Map()
    for (var i = 0; i < linePixels.length; i += 2) {
        BFS(linePixels[i], linePixels[i + 1], 'BFS_Down', 'red')
    }
    polyPoints = []
    annotationTexture.needsUpdate = true
}

function segAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color')
        return
    }
    context!.fillStyle = color
    logMyState(key, 'segmentation' + color, camera, pointer, x, y)
    segSelect(x, y)
}

function connectedSegAnnotationHandler(key: string, color: string, x: number, y: number) {
    if (!color) {
        console.error('no annotation without color, send color')
        return
    }
    logMyState(key, 'connectedsegmentation' + color, camera, pointer, x, y)
    connectedSegSelect(x, y, color)
}

function clearAllHandler() {
    var lastPixels = recentFills.pop()!
    for (var i = 0; i < lastPixels.length; i += 2) {
        context!.clearRect(lastPixels[i], lastPixels[i + 1], 1, 1)
    }
    var lastPoly = recentPolys.pop()!
    if (lastPoly[0]) {
        context!.moveTo(lastPoly[0], 1855 - lastPoly[1])
        for (var i = 2; i < lastPoly.length; i += 2) {
            context!.lineTo(lastPoly[i], 1855 - lastPoly[i + 1])
        }
        context!.closePath()
        context!.globalCompositeOperation = "destination-out"
        context!.fillStyle = 'blue'
        context!.fill()
        // second pass, the actual painting, with the desired color
        context!.globalCompositeOperation = "source-over"
        context!.fillStyle='rgba(0,0,0,0)'
        context!.fill()
    }
    annotationTexture.needsUpdate = true
    logMyState('z', 'resetAll', camera, undefined, undefined, undefined)
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
        let [x, y] = performRayCasting()
        // y = 1856 - y
        BFSHandler(x, y)
    } else if (event.key == 'd' && state.BFS) {
        let [x, y] = performRayCasting()
        // y = 1856 - y
        BFS2Handler(x, y)
    } else if (event.key == 'e' && state.brushSelection) {
        let [x, y] = performRayCasting()
        y = 1856 - y
        brushClearHandler(x, y)
    } else if (event.key == 'r' && state.brushSelection) {
        let [x, y] = performRayCasting()
        y = 1856 - y
        brushAnnotationHandler('r', 'red', x, y)
    } else if (event.key == 't' && state.brushSelection) {
        let [x, y] = performRayCasting()
        y = 1856 - y
        brushAnnotationHandler('t', 'blue', x, y)
    } else if (event.key == 'p' && state.polygonSelection) {
        let [x, y] = performRayCasting()
        // y = 1856 - y
        polygonSelectionHandler(x, y)
    } else if (event.key == 'l' && state.polygonSelection) {
        polygonFillHandler()
    } else if (event.key == 'n' && state.segEnabled) {
        let [x, y] = performRayCasting()
        segAnnotationHandler('n', 'red', x, y)
    } else if (event.key == 'b' && state.segEnabled) {
        let [x, y] = performRayCasting()
        segAnnotationHandler('b', 'blue', x, y)
    } else if (event.key == 'o' && state.segEnabled) {
        let [x, y] = performRayCasting()
        connectedSegAnnotationHandler('o', 'red', x, y)
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
    './img/Region_1_RGB.png',
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

                        mesh = new THREE.Mesh(geometry, meshMaterial)
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
                ;(document.getElementById('loader') as HTMLElement).style.display = 'none'
                if (!Developer) {
                    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display =
                        'block'
                }
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
    if (!Developer || overRideControl) {
        controls.update()
    }
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
        targetPosition: controls.target.clone(),
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

export { canvas, startUp, controls, mesh, pointer }
