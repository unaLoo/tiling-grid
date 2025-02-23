
import Tile from './tile'
import BoundingBox2D from "../util/boundingBox2D"

///////////////////////////////////////////////////
//////////////////// Types ////////////////////////
///////////////////////////////////////////////////
type SubdivideLevelInfoItem = {
    level: number
    gridNum: [number, number]
    gridSize: [number, number]
}
type TileInfo = {
    level: number
    tiles: Array<Tile>
}
type TileManagerOption = {
    baseURL: string
    tileSize: [number, number]
    boundaryCondition: BoundingBox2D
    subdivideLevelInfo: Array<SubdivideLevelInfoItem>
}

///////////////////////////////////////////////////
//////////////////// Class ////////////////////////
///////////////////////////////////////////////////
export default class TileManager {

    baseURL: string
    tileSize: [number, number]
    tileInfoList: Array<TileInfo> = []
    boundaryCondition: BoundingBox2D
    subdivideLevelInfo: Array<SubdivideLevelInfoItem>

    constructor(options: TileManagerOption) {

        this.baseURL = options.baseURL
        this.tileSize = options.tileSize
        this.boundaryCondition = options.boundaryCondition
        this.subdivideLevelInfo = options.subdivideLevelInfo
        this.tileInfoList = new Array(this.subdivideLevelInfo.length)
        this.init()

    }

    init() {
        /// Initialize tile info list
        for (let i = 0; i < this.subdivideLevelInfo.length; i++) {

            const { gridNum, gridSize, level } = this.subdivideLevelInfo[i]
            const tilesInLevel = fillRegionByTile(this.boundaryCondition, gridNum, gridSize, this.tileSize, level)
            this.tileInfoList[i] = {
                level: level,
                tiles: tilesInLevel
            }
        }
    }

    getTileByID(id: string) {
        const [level, i, j] = id.split('-').map(x => parseInt(x))
        // return this.tileInfoList[level].tiles.find(t => t.id === id)
        const { gridNum } = this.subdivideLevelInfo[level]
        const rowNum = Math.ceil(gridNum[0] / this.tileSize[0])
        const targetTile = this.tileInfoList[level].tiles[i * rowNum + j]
        if (targetTile.id === id) return targetTile
        return null
    }

    getTilesByLevel(level: number) {
        return this.tileInfoList[level].tiles
    }


}

function fillRegionByTile(region: BoundingBox2D, gridNum: [number, number], gridSize: [number, number], tileSize: [number, number], level: number): Array<Tile> {

    const tileWidthInMeter = tileSize[0] * gridSize[0]
    const tileHeightInMeter = tileSize[1] * gridSize[1]

    // Fill the region by only one tile
    if (tileSize[0] >= gridNum[0] && tileSize[1] >= gridNum[1]) {
        const tile = new Tile({
            id: `${level}-0-0`,
            gridSize: gridSize,
            tileBBox: BoundingBox2D.create(region.xMin, region.yMin, region.xMin + tileWidthInMeter, region.yMin + tileHeightInMeter),
        })
        return [tile]
    }

    // Column-num and Row-num
    const rowNum = Math.ceil(gridNum[0] / tileSize[0])
    const colNum = Math.ceil(gridNum[1] / tileSize[1])
    const tilesForFill = new Array(colNum * rowNum)

    // LB --> RT
    for (let i = 0; i < colNum; i++) {
        let yMin = region.yMin + i * tileHeightInMeter
        for (let j = 0; j < rowNum; j++) {
            let xMin = region.xMin + j * tileWidthInMeter
            const tileBBox = BoundingBox2D.create(xMin, yMin, xMin + tileWidthInMeter, yMin + tileHeightInMeter)
            const tile = new Tile({
                id: `${level}-${i}-${j}`,
                gridSize: gridSize,
                tileBBox: tileBBox,
            })
            tilesForFill[i * rowNum + j] = tile
        }
    }

    return tilesForFill
}