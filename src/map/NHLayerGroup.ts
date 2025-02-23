import { mat4, vec3 } from 'gl-matrix'
import { Map, CustomLayerInterface, MercatorCoordinate } from "mapbox-gl"

import TileControl from '../control/tileControl'
import * as scratch from '../scratch/scratch'
import { NHCustomLayerInterface } from "./util/interface"

export default class NHLayerGroup implements CustomLayerInterface {

    /// base
    id: string = 'NH-LayerGroup'
    type: "custom" = "custom"
    renderingMode?: "2d" | "3d" = "3d";

    /// webgpu
    gpuCanvas: HTMLCanvasElement
    screen!: scratch.Screen
    depthTexture!: scratch.Texture
    preProcessStageName: string = 'PreRendering'
    renderStageName: string = 'Rendering'
    outputPass!: scratch.RenderPass


    /// map
    map!: Map
    gl!: WebGL2RenderingContext
    layers!: Array<NHCustomLayerInterface>
    tileControl: TileControl
    tickParams!: {
        centerLow: scratch.vec3f,
        centerHigh: scratch.vec3f,
        relativeEyeMatrix: scratch.mat4f,
    }

    /// state
    prepared!: boolean


    constructor(options: {
        canvas: HTMLCanvasElement,
        tileControl: TileControl
    }) {

        this.layers = []
        this.prepared = false
        this.gpuCanvas = options.canvas
        this.tileControl = options.tileControl

        this.tickParams = {
            centerHigh: scratch.vec3f(),
            centerLow: scratch.vec3f(),
            relativeEyeMatrix: scratch.mat4f()
        }

    }


    ///////////////////////////////////////////////////////////
    ////////////////// LayerGroup Hooks ///////////////////////
    ///////////////////////////////////////////////////////////
    /** To initialize gl resources and register event listeners.*/
    onAdd(map: Map, gl: WebGL2RenderingContext) {

        this.gl = gl
        this.map = map

        scratch.StartDash().then((device) => {

            this.screen = scratch.screen({ canvas: this.gpuCanvas, alphaMode: 'premultiplied' })
            this.depthTexture = this.screen.createScreenDependentTexture('Texture (LayerGroup Sharing Depth)', 'depth32float')

            // Pass
            this.outputPass = scratch.renderPass({
                name: 'Render Pass (Scratch map)',
                colorAttachments: [{ colorResource: this.screen as any }],
                depthStencilAttachment: { depthStencilResource: this.depthTexture }
            })

            // Make stages
            this.preProcessStageName = 'PreRendering'
            this.renderStageName = 'Rendering'
            scratch.director.addStage({
                name: this.preProcessStageName,
                items: [],
            })
            scratch.director.addStage({
                name: this.renderStageName,
                items: [this.outputPass],
            })


            this.layers.forEach(ly => {
                ly.parent = this // inject layerGroup here
                ly.initialize(map, gl) // start initialize here
            })
            this.prepared = true
        })
    }
    /** Called during each render frame.*/
    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        if (!this.prepared) { this.map.triggerRepaint(); return; }

        this.update()
        this.layers.forEach(ly => {
            ly.render(gl, matrix)
        })
        scratch.director.tick()
    }

    /** To clean up gl resources and event listeners.*/
    onRemove(map: Map, gl: WebGL2RenderingContext) {

        this.layers.forEach(layer => {
            if (layer.parent) layer.parent = undefined // eliminate ref to layergroup
            layer.remove(map, gl)
        })
        this.layers = []

    }


    ///////////////////////////////////////////////////////////
    ///////////////// Rendering ///////////////////////////////
    ///////////////////////////////////////////////////////////
    /** Calculate some data to avoid map jitter .*/
    private update() {

        const mercatorCenter = new MercatorCoordinate(...this.map.transform._computeCameraPosition().slice(0, 3) as [number, number, number])
        const mercatorCenterX = encodeFloatToDouble(mercatorCenter.x)
        const mercatorCenterY = encodeFloatToDouble(mercatorCenter.y)
        const mercatorCenterZ = encodeFloatToDouble(mercatorCenter.z)

        this.tickParams.centerHigh.x = mercatorCenterX[0]
        this.tickParams.centerHigh.y = mercatorCenterY[0]
        this.tickParams.centerHigh.z = mercatorCenterZ[0]
        this.tickParams.centerLow.x = mercatorCenterX[1]
        this.tickParams.centerLow.y = mercatorCenterY[1]
        this.tickParams.centerLow.z = mercatorCenterZ[1]

        this.tickParams.relativeEyeMatrix = mat4.translate(mat4.create(), this.map.transform.mercatorMatrix,
            vec3.fromValues(mercatorCenterX[0], mercatorCenterY[0], mercatorCenterZ[0]))

    }

    add2PreProcess(prePass: any) {

        scratch.director.addItem(this.preProcessStageName, prePass)
        return this
    }

    add2RenderPass(pipeline: scratch.RenderPipeline, binding: scratch.Binding) {

        this.outputPass.add(pipeline, binding)
        return this
    }


    ///////////////////////////////////////////////////////////
    ///////////////// LayerGroup Fucntion /////////////////////
    ///////////////////////////////////////////////////////////

    //////////////// Layers Control ///////////////////////////
    public getLayerInstance(layerID: string): null | NHCustomLayerInterface {

        const index = this.findLayerIndex(layerID)
        if (index === -1) {
            console.warn(`NHWARN: Layer <${layerID}> not found.`)
            return null
        }
        return this.layers[index]
    }

    public addLayer(layer: NHCustomLayerInterface) {

        this.layers.push(layer)
        this.prepared && layer.initialize(this.map, this.gl)
        this.sortLayer()
    }

    public removeLayer(layerID: string) {

        const index = this.findLayerIndex(layerID)
        if (index === -1) {
            console.warn(`NHWARN: Layer <${layerID}> not found.`)
            return false
        }
        this.layers.splice(index, 1)
        console.log(`NHINFO: Layer <${layerID}> removed.`)
        return true
    }

    public sortLayer() {
        this.layers.sort((a, b) => { return (b.z_order ?? 0) - (a.z_order ?? 0) })
    }

    showLayer(layerID: string) {
        this.getLayerInstance(layerID)?.show()
    }

    hideLayer(layerID: string) {
        this.getLayerInstance(layerID)?.hide()
    }

    private findLayerIndex(layerID: string): number {
        return this.layers.findIndex((ly) => ly.id === layerID)
    }

}



// Helpers //////////////////////////////////////////////////////////////////////////////////////////////////////

function encodeFloatToDouble(value: number) {

    const result = new Float32Array(2)
    result[0] = value

    const delta = value - result[0]
    result[1] = delta
    return result
}
