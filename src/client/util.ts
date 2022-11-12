import { update } from '@tweenjs/tween.js'
import { Camera, Raycaster, Scene } from 'three'
import { MapControls } from 'three/examples/jsm/controls/OrbitControls'
import {
    canvas,
    startUp,
    controls,
    mesh,
    pointer,
    renderer,
    camera,
    TWEEN,
    raycaster,
    scene,
    params,
    uniforms,
    gui,
} from './client'
import { terrainDimensions } from './constants'
import * as JSZip from 'jszip'
// import * as fs from 'fs'

var zip: JSZip = new JSZip()
const pixelCount = 7617024
let button1: HTMLButtonElement, button2: HTMLButtonElement
let button3: HTMLButtonElement, button4: HTMLButtonElement
type ObjectKeyParams = keyof typeof params
type ObjectKeyUniforms = keyof typeof uniforms

interface sessionDataType {
    name: string
    sessionStart: Date | null
    sessionEnd: Date | null
    'totalSessionTime_M:S:MS': string
    wasCompleted: boolean
    annotatedPixelCount: number
    numberofClick: number
    numberofUndo: number
    numberofRedo: number
    metaState: Object
}

interface gameEventType {
    label: string
    flood: boolean
    clear: boolean
    clickPosition?: THREE.Vector2
    keyPressed?: string
    brushSize?: number
    x?: number
    y?: number
    linePoints?: Array<number>
    undone?: boolean
    redone?: boolean
    persistanceThreshold?: number
    aspectRatio: number
    cameraPosition: THREE.Vector3
    targetPosition: THREE.Vector3
    time: Date
}

interface gameStateType {
    [key: string]: gameEventType
}

let metaState = {
    BFS: true,
    brushSelection: true,
    polygonSelection: true,
    segEnabled: true,
    region: '1',
    quadrant: 0,
    flat: 0,
}
if (window.location.hash) {
    if (window.location.hash.search('region') != -1) {
        metaState.region = window.location.hash[window.location.hash.search('region') + 7]
        if (metaState.region == '4') {
            alert('Region 4 not supported!')
        }
    }
    if (window.location.hash.search('BFS') != -1) {
        var bfs = window.location.hash[window.location.hash.search('BFS') + 4]
        if (bfs == '0') {
            document.getElementById('BFS')!.style.display = 'none'
            document.getElementById('polygonSelection')!.style.display = 'none'
            document.getElementById('polygonSelection2')!.style.display = 'none'
            document.getElementById('menuBFS')!.style.display = 'none'
            metaState.BFS = false
            metaState.polygonSelection = false
        }
    }
    if (window.location.hash.search('segmentation') != -1) {
        var seg = window.location.hash[window.location.hash.search('segmentation') + 13]
        if (seg == '0') {
            document.getElementById('segEnabled')!.style.display = 'none'
            document.getElementById('menuSegmentation')!.style.display = 'none'
            metaState.segEnabled = false
        }
    }
    if (window.location.hash.search('quadrant') != -1) {
        metaState.quadrant = parseInt(
            window.location.hash[window.location.hash.search('quadrant') + 9]
        )
    }
    if (window.location.hash.search('flat') != -1) {
        metaState.flat = parseInt(window.location.hash[window.location.hash.search('flat') + 5])
    }
}
const regionDimensions = terrainDimensions[metaState.region]
let regionBounds = [0, regionDimensions[0], 0, regionDimensions[1]]
if (metaState.quadrant == 1) {
    regionBounds[1] = Math.floor(regionDimensions[0] / 2)
    regionBounds[2] = Math.ceil(regionDimensions[1] / 2)
} else if (metaState.quadrant == 2) {
    regionBounds[0] = Math.ceil(regionDimensions[0] / 2)
    regionBounds[2] = Math.ceil(regionDimensions[1] / 2)
} else if (metaState.quadrant == 3) {
    regionBounds[1] = Math.floor(regionDimensions[0] / 2)
    regionBounds[3] = Math.floor(regionDimensions[1] / 2)
} else if (metaState.quadrant == 4) {
    regionBounds[0] = Math.ceil(regionDimensions[0] / 2)
    regionBounds[3] = Math.floor(regionDimensions[1] / 2)
}

const sessionData: sessionDataType = {
    name: 'anonymous',
    sessionStart: null,
    sessionEnd: null,
    'totalSessionTime_M:S:MS': '0:0:0',
    wasCompleted: false,
    annotatedPixelCount: 0,
    numberofClick: 0,
    numberofUndo: 0,
    numberofRedo: 0,
    metaState: metaState,
}

// vector.applyMatrix(camera.matrixWorld)

const gameState: Array<gameStateType> = []

async function readstateFile() {
    let _fetchData: any
    const response = await fetch('./data/test2.json')
    _fetchData = await response.json()
    return _fetchData
}

function logMyState(
    key: string,
    event: string,
    flood: boolean,
    clear: boolean,
    camera: THREE.PerspectiveCamera,
    pointer?: THREE.Vector2,
    x?: number,
    y?: number,
    brushSize?: number,
    linePoints?: Array<number>
) {
    let tempS: string = event

    let stateData
    if (brushSize != undefined) {
        stateData = {
            label: tempS,
            flood: flood,
            clear: clear,
            clickPosition: pointer,
            keyPressed: key,
            x: x,
            y: y,
            aspectRatio: camera.aspect,
            cameraPosition: camera.position.clone(),
            targetPosition: controls.target.clone(),
            time: new Date(),
        }
    }

    if (linePoints != undefined) {
        stateData = {
            label: tempS,
            flood: flood,
            clear: clear,
            aspectRatio: camera.aspect,
            keyPressed: key,
            cameraPosition: camera.position.clone(),
            targetPosition: controls.target.clone(),
            time: new Date(),
            linePoints: linePoints,
        }
    } else {
        stateData = {
            label: tempS,
            flood: flood,
            clear: clear,
            clickPosition: pointer,
            keyPressed: key,
            x: x,
            y: y,
            aspectRatio: camera.aspect,
            cameraPosition: camera.position.clone(),
            targetPosition: controls.target.clone(),
            time: new Date(),
            brushSize: brushSize,
            persistanceThreshold: params.pers,
        }
    }
    gameState.push({ mouseEvent: stateData })
}

function download(filename: string, text: string) {
    var element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
    element.setAttribute('download', filename)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
}

function convertToSecMins(millisecond: number) {
    const minutes = Math.floor(millisecond / 60000)
    const seconds = ((millisecond % 60000) / 1000).toFixed(0)
    const milliseconds = (millisecond % 1000).toFixed(0)
    return minutes + ':' + (+seconds < 10 ? '0' : '') + seconds + ':' + milliseconds
}

function resetCamera(controls: any) {
    controls.reset()
    return controls
}

function startSession() {
    // event.preventDefault()
    // ;(event.target as HTMLButtonElement).style.display = 'none'
    sessionData.sessionStart = new Date()
    new TWEEN.Tween(controls.target)
        .to(
            {
                x: (regionBounds[1] + regionBounds[0]) / 2,
                y: (regionBounds[2] + regionBounds[3]) / 2,
                z: 0,
            },
            1000
        )
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            controls.update()
        })
        .start()

    new TWEEN.Tween(camera.position)
        .to(
            {
                x: (regionBounds[1] + regionBounds[0]) / 2,
                y: (regionBounds[2] + regionBounds[3]) / 2,
                z: 1000,
            },
            1000
        )
        .easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            camera.updateProjectionMatrix()
        })
        .start()
    startUp()
}

function endSession(event: Event) {
    event.preventDefault()
    ;(event.target as HTMLButtonElement).style.display = 'none'
    sessionData.sessionEnd = new Date()
    sessionData.wasCompleted = false
    let totalSessionTime = Math.abs(
        sessionData.sessionStart!.valueOf() - sessionData.sessionEnd!.valueOf()
    )
    sessionData['totalSessionTime_M:S:MS'] = convertToSecMins(totalSessionTime)
    if (sessionData.annotatedPixelCount > 0.9 * pixelCount) {
        sessionData.wasCompleted = true
    }
}

function downloadSession(event: Event) {
    const _data = JSON.stringify(gameState)
    const _fileName = 'session_' + sessionData.name + '.json'
    zip.file(_fileName, _data)
    // download(_fileName, _data)
    const _metadata = JSON.stringify(sessionData)
    const _metaFileName = 'meta_session_' + sessionData.name + '.json'
    // download(_metaFileName, _metadata)
    zip.file(_metaFileName, _metadata)
    let imageName = 'annotatedImg.png'
    if (sessionData.name) {
        imageName = 'annotatedImg_' + sessionData.name + '.png'
    }

    var url = canvas.toDataURL()
    var index = url.indexOf(',')
    if (index !== -1) {
        url = url.substring(index + 1, url.length)
    }
    zip.file(imageName, url, { base64: true })
    zip.generateAsync({
        type: 'base64',
    }).then(function (content) {
        var link = document.createElement('a')
        link.href = 'data:application/zip;base64,' + content
        if (sessionData.name == null || sessionData.name == '') {
            sessionData.name = 'anonymous'
        }
        link.download = sessionData.name + '-annotation'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    })
    var link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('target', '_blank')
    link.setAttribute('download', imageName)
    // link.click()
    ;(document.getElementById('uploadForm') as HTMLFormElement).style.display = 'block'
}

function hideModal() {
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'none'
    ;(document.getElementById('ui-menu') as HTMLElement).style.display = 'block'
    let userId = (document.getElementById('studentId') as HTMLInputElement).value
    sessionData.name = userId
    startSession()
}

function getLocalCordinate(_cordiante: THREE.Vector3) {
    mesh.updateMatrixWorld()
    const localPoint = mesh.worldToLocal(_cordiante)
    return localPoint
}

function doubleClickHandler(event: MouseEvent) {
    event.preventDefault()
    let ndcX = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
    let ndcY = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)
    const intersection = raycaster.intersectObjects(scene.children, true)
    if (intersection.length > 0) {
        const point = intersection[0].point //this is not local cordinate point rather world cordinate
        new TWEEN.Tween(controls.target)
            .to(
                {
                    x: point.x,
                    y: point.y,
                    z: point.z,
                },
                1000
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .onUpdate(() => {
                controls.update()
            })
            .start()

        new TWEEN.Tween(camera.position)
            .to(
                {
                    x: point.x,
                    y: point.y,
                    z: point.z + 600,
                },
                1000
            )
            .easing(TWEEN.Easing.Cubic.Out)
            .onUpdate(() => {
                camera.updateProjectionMatrix()
            })
            .start()
    }
}

function toggleAnnoation() {
    var ul_button = document.createElement('ul')
    var li = document.createElement('li')
    li.classList.add('customList', 'outList')
    // let span = document.createElement('span')
    // span.classList.add('property-name')
    // span.innerHTML = 'Annotate'
    // li.appendChild(span)
    let div = document.createElement('div')
    div.classList.add('btn-group', 'btn-group-toggle')
    button1 = document.createElement('button')
    button1.classList.add('ci', 'btn', 'active')
    button1.setAttribute('data-myid', 'flood')
    button1.innerHTML = 'FLOOD'
    button2 = document.createElement('button')
    button2.classList.add('ci', 'btn')
    button2.setAttribute('data-myid', 'dry')
    button2.innerHTML = 'DRY'
    div.appendChild(button1)
    div.appendChild(button2)
    li.appendChild(div)
    button1.addEventListener('click', setActiveButton)
    button2.addEventListener('click', setActiveButton)
    ul_button.appendChild(li)
    // document.body.appendChild(li)
    var li2 = document.createElement('li')
    li2.classList.add('customList', 'outList2')
    let div2 = document.createElement('div')
    div2.classList.add('btn-group', 'btn-group-toggle')
    button3 = document.createElement('button')
    button3.classList.add('ci', 'btn', 'active')
    button3.setAttribute('data-myid', 'fill')
    button3.innerHTML = 'FILL'
    button4 = document.createElement('button')
    button4.classList.add('ci', 'btn')
    button4.setAttribute('data-myid', 'clear')
    button4.innerHTML = 'ERASE'
    div2.appendChild(button3)
    div2.appendChild(button4)
    li2.appendChild(div2)
    button3.addEventListener('click', setActiveButton2)
    button4.addEventListener('click', setActiveButton2)
    ul_button.appendChild(li2)
    document.body.appendChild(ul_button)
}

function updateUniform(input: any) {
    input.forEach((element: any, index: number) => {
        uniforms[element as ObjectKeyUniforms].value = params[element as ObjectKeyParams] as any
    })
}

function setActiveButton(event: MouseEvent) {
    event.preventDefault()
    button1.classList.remove('active')
    button2.classList.remove('active')
    ;(event.target as HTMLButtonElement).classList.add('active')
    type ObjectKeyParams = keyof typeof params
    let myId = (event.target as HTMLButtonElement).dataset.myid as ObjectKeyParams
    params['dry'] = false
    params['flood'] = false
    // params[myId] = true
    if (myId == 'flood') {
        params['flood'] = true
    } else {
        params['dry'] = true
    }
    updateUniform(['dry', 'flood'])
}

function setActiveButton2(event: MouseEvent) {
    event.preventDefault()
    button3.classList.remove('active')
    button4.classList.remove('active')
    ;(event.target as HTMLButtonElement).classList.add('active')
    type ObjectKeyParams = keyof typeof params
    let myId = (event.target as HTMLButtonElement).dataset.myid as ObjectKeyParams
    if (myId == 'clear') {
        params['clear'] = true
    } else {
        params['clear'] = false
    }
}

function init() {
    // document.getElementById('start')?.addEventListener('click', startSession)
    document.getElementById('end')?.addEventListener('click', endSession)
    document.getElementById('download')?.addEventListener('click', downloadSession)
    document.getElementById('exploration')?.addEventListener('click', hideModal)
    toggleAnnoation()
    renderer.domElement.addEventListener('dblclick', doubleClickHandler, true)
    // renderer.domElement.addEventListener('click', hideSetting, false)
}

function hideSetting() {
    // const dgDiv = document.querySelector('div.main div') as HTMLElement
    // dgDiv.style.height = '101px'
    // const dgUl = document.querySelector('li.folder div.dg ul') as HTMLUListElement
    // dgUl.classList.add('closed')
    gui.close()
}

function initVis() {
    ;(document.getElementById('loader') as HTMLElement).style.display = 'none'
    ;(document.getElementById('modal-wrapper') as HTMLElement).style.display = 'block'
}

export {
    metaState,
    regionBounds,
    regionDimensions,
    resetCamera,
    startSession,
    endSession,
    init,
    initVis,
    sessionData,
    gameState,
    logMyState,
    getLocalCordinate,
    readstateFile,
    toggleAnnoation,
}
