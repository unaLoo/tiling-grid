import BoundingBox2D from "../util/boundingBox2D"

///////////////////////////////////////////////////
//////////////////// Types ////////////////////////
///////////////////////////////////////////////////
type TileData = unknown
type TileStatus = 'idle' | 'loading' | 'loaded' | 'error'
type TileLoadCallback = (error?: string, data?: TileData) => void

type TileOptions = {
    id: string
    gridSize: [number, number]
    tileBBox: BoundingBox2D
    callback?: TileLoadCallback
}

///////////////////////////////////////////////////
//////////////////// Class ////////////////////////
///////////////////////////////////////////////////
export default class Tile {

    id: string = ''
    url: string = ''
    tileBBox: BoundingBox2D
    gridSize: [number, number]

    data: TileData

    status: TileStatus = 'idle'
    error?: string

    callback: TileLoadCallback

    constructor(options: TileOptions) {
        this.id = options.id
        this.callback = options.callback || (() => { })
        this.data = null
        this.gridSize = options.gridSize
        this.tileBBox = options.tileBBox

    }

    //////////// Life ////////////
    load() {



    }

    cancel() {



    }

    destroy() {



    }

    //////////// function ////////////
    /** `tileCenter` in Meter */
    get tileCenter() {
        return this.tileBBox.center
    }

} 