import { Map, Marker } from "mapbox-gl"

import NHLayerGroup from "../NHLayerGroup"
import * as scratch from '../../scratch/scratch'
import { NHCustomLayerInterface } from "../util/interface"

export default class MapTriangleLayer implements NHCustomLayerInterface {

    id: string
    initialized: boolean
    z_order?: number
    parent!: NHLayerGroup

    // map
    map!: Map
    origin!: [number, number]

    // render params
    size!: scratch.F32
    meterToTile!: scratch.F32
    baseTilePos!: scratch.Vec2f
    tileMatrix!: scratch.Mat4f

    constructor(options: {
        id: string,
        origin: [number, number]
        z_order?: number
    }) {
        this.id = options.id
        this.origin = options.origin
        options.z_order && (this.z_order = options.z_order)
        this.initialized = false
    }

    /** Method to initialize gl resources and register event listeners. */
    async initialize(map: Map, gl: WebGL2RenderingContext) {

        this.map = map

        const marker = new Marker({
            color: 'red',
            draggable: true
        }).setLngLat(this.origin).addTo(map)

        this.size = scratch.f32()
        this.meterToTile = scratch.f32()
        this.baseTilePos = scratch.vec2f()
        this.tileMatrix = scratch.mat4f()

        const vertices = [0, 0, -1, -1, 1, 1]

        const templateBuffer = scratch.storageBuffer({
            name: 'templateBuffer',
            resource: { arrayRef: scratch.aRef(new Float32Array(vertices)) }
        })


        // Init resource
        const scratchShaderModule = scratch.shaderLoader.load('Shader (GawEarth land)', '/shader/mapTriangle.wgsl')

        // Triangle Binding
        const tBinding = scratch.binding({
            name: 'tBinding',
            range: () => [3],
            uniforms: [
                {
                    name: 'block',
                    dynamic: true,
                    map: {
                        'size': this.size,
                        'meter_to_tile': this.meterToTile,
                        'base_tile_pos': this.baseTilePos,
                        'tile_matrix': this.tileMatrix,
                    },
                }
            ],
            storages: [
                { buffer: templateBuffer }
            ]
        })

        // Triangle Pipeline
        const tPipeline = scratch.renderPipeline({
            name: 'tPipeline',
            shader: { module: scratchShaderModule },
        })

        this.parent.add2RenderPass(tPipeline, tBinding)

        this.initialized = true
    }

    /** Method called during a render frame */
    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        if (!this.initialized) return

        // Tick logic operation
        const info = this.parent.tileControl.getPointRenderInfo(this.origin)
        this.size.n = 100.0
        this.meterToTile.n = 1.0 / info.mapTile2Meter
        this.baseTilePos.x = info.mapTileCenter[0]
        this.baseTilePos.y = info.mapTileCenter[1]
        this.tileMatrix.data = info.mapTileMatrix

    }

    /** Method to clean up gl resources and event listeners. */
    remove(map: Map, gl: WebGL2RenderingContext) {

    }

    show() {

    }

    hide() {

    }

}