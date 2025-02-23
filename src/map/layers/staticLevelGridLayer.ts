import { Map } from "mapbox-gl"

import NHLayerGroup from "../NHLayerGroup"
import * as scratch from '../../scratch/scratch'
import { NHCustomLayerInterface } from "../util/interface"
import Tile from "../../control/tile"


export default class StaticGridLayer implements NHCustomLayerInterface {

    id: string
    initialized: boolean
    z_order?: number
    parent!: NHLayerGroup

    // map 
    map!: Map


    // Grid-Tile
    tileLevel: number

    tileSize!: [number, number]
    tiles!: Array<Tile>
    gridRowColNum!: scratch.Vec2f
    meterToTile!: scratch.F32
    gridSize!: scratch.Vec2f
    baseTilePos!: scratch.Vec2f
    tileMatrix!: scratch.Mat4f


    constructor(options: {
        id: string,
        z_order?: number,
        level: number
    }) {
        this.id = options.id
        this.initialized = false
        options.z_order && (this.z_order = options.z_order)
        this.tileLevel = options.level

        this.meterToTile = scratch.f32()
        this.gridSize = scratch.vec2f()
        this.baseTilePos = scratch.vec2f()
        this.tileMatrix = scratch.mat4f()
        this.gridRowColNum = scratch.vec2f()
    }

    async initialize(map: Map, gl: WebGL2RenderingContext) {

        const tileSize = this.parent.tileControl.tileSize
        const templateGridVertex = genTemplate(tileSize)
        this.gridRowColNum.x = tileSize[1] // row -- y
        this.gridRowColNum.y = tileSize[0] // col -- x

        this.tiles = this.parent.tileControl.getTilesByLevel(this.tileLevel)

        const templateBuffer = scratch.storageBuffer({
            name: 'templateBuffer',
            resource: { arrayRef: scratch.aRef(new Float32Array(templateGridVertex)) }
        })

        // Init resource
        const gridShaderModule = scratch.shaderLoader.load('Shader', '/shader/staticGrid.wgsl')

        // Binding
        const gridBinding = scratch.binding({
            name: 'gridBinding',
            // range: () => [4, tileSize[0] * tileSize[1], 0, 0],
            range: () => [5, tileSize[0] * tileSize[1], 0, 0],
            uniforms: [
                {
                    name: 'block',
                    dynamic: true,
                    map: {
                        'meter_to_tile': this.meterToTile,
                        'grid_row_col': this.gridRowColNum,
                        'grid_size': this.gridSize,
                        'base_tile_pos': this.baseTilePos,
                        'tile_matrix': this.tileMatrix,
                    },
                }
            ],
            storages: [
                { buffer: templateBuffer }
            ]
        })

        // Pipeline
        const gridPipeline = scratch.renderPipeline({
            name: 'Pipeline',
            shader: { module: gridShaderModule },
            primitive: {
                // topology: 'triangle-strip',
                topology: 'line-strip',
            },
        })

        this.parent.add2RenderPass(gridPipeline, gridBinding)

        this.initialized = true
    }


    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        if (!this.initialized) return

        // Tick logic operation
        const info = this.parent.tileControl.getTileRenderInfo(this.tile)

        this.gridSize.x = this.tile.gridSize[0]
        this.gridSize.y = this.tile.gridSize[1]

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



//// Helper Functions ///////////////////////////////////
function genTemplate(tileSize: [number, number]) {

    const rows = tileSize[0] + 1
    const cols = tileSize[1] + 1
    const vertices = []
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const y = i - tileSize[0] / 2
            const x = j - tileSize[1] / 2
            vertices.push(x, y)
        }
    }
    return vertices
}