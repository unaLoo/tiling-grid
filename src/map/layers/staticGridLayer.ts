import { Map } from "mapbox-gl"

import NHLayerGroup from "../NHLayerGroup"
import * as scratch from '../../scratch/scratch'
import { NHCustomLayerInterface } from "../util/interface"


export default class StaticGridLayer implements NHCustomLayerInterface {

    id: string
    initialized: boolean
    z_order?: number
    parent!: NHLayerGroup

    // map 
    map!: Map

    constructor(options: {
        id: string,
        z_order?: number
    }) {
        this.id = options.id
        this.initialized = false
        options.z_order && (this.z_order = options.z_order)
    }

    async initialize(map: Map, gl: WebGL2RenderingContext) {


    }


    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        if (!this.initialized) return

        // Tick logic operation
        // const info = this.parent.tileControl.getPointRenderInfo(this.origin)
        // this.size.n = 100.0
        // this.meterToTile.n = 1.0 / info.mapTile2Meter
        // this.baseTilePos.x = info.mapTileCenter[0]
        // this.baseTilePos.y = info.mapTileCenter[1]
        // this.tileMatrix.data = info.mapTileMatrix

    }

    /** Method to clean up gl resources and event listeners. */
    remove(map: Map, gl: WebGL2RenderingContext) {

    }

    show() {

    }

    hide() {

    }

}