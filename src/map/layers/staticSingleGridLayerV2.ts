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
    tileSize!: [number, number]
    tile!: Tile
    gridSize!: scratch.Vec2f
    baseTilePos!: scratch.Vec2f
    gridRowColNum!: scratch.Vec2f
    meterToTile!: scratch.F32
    tileMatrix!: scratch.Mat4f
    tileLB: scratch.Vec2f
    tileRB: scratch.Vec2f
    tileLT: scratch.Vec2f
    tileRT: scratch.Vec2f

    constructor(options: {
        id: string,
        z_order?: number,
        tile: Tile
    }) {
        this.id = options.id
        this.initialized = false
        options.z_order && (this.z_order = options.z_order)
        this.tile = options.tile

        this.meterToTile = scratch.f32()
        this.gridSize = scratch.vec2f()
        this.baseTilePos = scratch.vec2f()
        this.tileMatrix = scratch.mat4f()
        this.gridRowColNum = scratch.vec2f()

        this.tileLB = scratch.vec2f()
        this.tileRB = scratch.vec2f()
        this.tileLT = scratch.vec2f()
        this.tileRT = scratch.vec2f()
    }

    async initialize(map: Map, gl: WebGL2RenderingContext) {

        console.log(this.tile.tilePointsIn4326)

        const tileSize = this.parent.tileControl.tileSize
        // const tileSize = [1,4] as [number, number]
        const templateGridVertex = genTemplate(tileSize)
        // console.log(templateGridVertex)
        this.gridRowColNum.x = tileSize[1] // row -- y
        this.gridRowColNum.y = tileSize[0] // col -- x

        const templateBuffer = scratch.storageBuffer({
            name: this.id + 'templateBuffer',
            resource: { arrayRef: scratch.aRef(new Float32Array(templateGridVertex)) }
        })

        // Init resource
        const gridShaderModule = scratch.shaderLoader.load('Shader', '/shader/staticGridV2.wgsl')

        // Binding
        const gridBinding = scratch.binding({
            name: this.id + 'gridBinding',
            // range: () => [4, tileSize[0] * tileSize[1], 0, 0],
            range: () => [5, tileSize[0] * tileSize[1], 0, 0],
            uniforms: [
                {
                    name: this.id + 'block',
                    dynamic: true,
                    map: {
                        'meter_to_tile': this.meterToTile,
                        'grid_row_col': this.gridRowColNum,
                        'grid_size': this.gridSize,
                        'base_tile_pos': this.baseTilePos,
                        'tile_matrix': this.tileMatrix,
                        'tile_lb': this.tileLB,
                        'tile_rb': this.tileRB,
                        'tile_lt': this.tileLT,
                        'tile_rt': this.tileRT,
                    },
                }
            ],
            storages: [
                { buffer: templateBuffer }
            ]
        })

        // Pipeline
        const gridPipeline = scratch.renderPipeline({
            name: this.id + 'Pipeline',
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

        this.tileLB.x = info.mapTileCornerPoints[0][0]
        this.tileLB.y = info.mapTileCornerPoints[0][1]
        this.tileRB.x = info.mapTileCornerPoints[1][0]
        this.tileRB.y = info.mapTileCornerPoints[1][1]
        this.tileLT.x = info.mapTileCornerPoints[2][0]
        this.tileLT.y = info.mapTileCornerPoints[2][1]
        this.tileRT.x = info.mapTileCornerPoints[3][0]
        this.tileRT.y = info.mapTileCornerPoints[3][1]

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
            // const y = i - tileSize[0] / 2
            // const x = j - tileSize[1] / 2
            // vertices.push(x, y)
            vertices.push(j / tileSize[0], i / tileSize[1])
        }
    }
    return vertices
}