import { Map } from "mapbox-gl";

import NHLayerGroup from "../NHLayerGroup";
import * as scratch from '../../scratch/scratch'
import { NHCustomLayerInterface } from "../util/interface";

export default class ScreenTriangleLayer implements NHCustomLayerInterface {

    id: string
    initialized: boolean
    z_order?: number

    parent!: NHLayerGroup

    constructor(options: {
        id: string,
        z_order?: number
    }) {
        this.id = options.id
        options.z_order && (this.z_order = options.z_order)
        this.initialized = false

    }

    /** Method to initialize gl resources and register event listeners. */
    async initialize(map: Map, gl: WebGL2RenderingContext) {

        // Init resource
        const scratchShaderModule = scratch.shaderLoader.load('Shader (GawEarth land)', '/shader/screenTriangle.wgsl')

        // Triangle Binding
        const tBinding = scratch.binding({
            range: () => [3] // Draw 3 points of a triangle (1 instance as default)
        })

        // Triangle Pipeline
        const tPipeline = scratch.renderPipeline({
            shader: {
                module: scratchShaderModule
            },
        })

        this.parent.add2RenderPass(tPipeline, tBinding)

        this.initialized = true
    }

    /** Method called during a render frame */
    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        if (!this.initialized) return

        // No tick logic operation

    }

    /** Method to clean up gl resources and event listeners. */
    remove(map: Map, gl: WebGL2RenderingContext) {

    }

    show() {

    }
    hide() {

    }


}