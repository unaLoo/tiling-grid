import { IControl, Map } from "mapbox-gl";

import Tile from "./tile";
import TileManager from "./tileManager";
import BoundingBox2D from "../util/boundingBox2D";
import { bbox2DsToGeojson } from "../util/debug";
import { projConverter, bboxVec4Transform, coordTransform, lnglat2Tile, lnglat2TileLCS, calcTileMatrix, tile2Meter } from "../util/spaceTransform"

///////////////////////////////////////////////////
//////////////////// Types ////////////////////////
///////////////////////////////////////////////////
type TileXYZ = { x: number, y: number, z: number }
type TileControlOption = {
    baseURL: string
    tileSize?: [number, number]
    coordTransformRule?: [string, string]
    boundaryCondition: [number, number, number, number]
    firstLevelSize: [number, number],
    subdivideRules: [number, number][]
}
type SubdivideLevelInfoItem = {
    level: number
    gridNum: [number, number]
    gridSize: [number, number]
}


///////////////////////////////////////////////////
//////////////////// Class ////////////////////////
///////////////////////////////////////////////////
export default class NHTileControl implements IControl {

    map!: Map
    baseURL: string
    tileSize: [number, number]
    tileManager: TileManager
    boundaryCondition: BoundingBox2D
    subdivideLevelInfo: Array<SubdivideLevelInfoItem> = []

    constructor(options: TileControlOption) {

        // Store basic properties
        this.baseURL = options.baseURL
        this.tileSize = options.tileSize ? options.tileSize : [512, 512]

        // Init the proj converter
        options.coordTransformRule && projConverter(...options.coordTransformRule)

        // Boundary condition correction
        let firstLevelSize = options.firstLevelSize
        let bound = options.boundaryCondition
        bound[2] = bound[0] + Math.ceil((bound[2] - bound[0]) / firstLevelSize[0]) * firstLevelSize[0]
        bound[3] = bound[1] + Math.ceil((bound[3] - bound[1]) / firstLevelSize[1]) * firstLevelSize[1]
        this.boundaryCondition = BoundingBox2D.create(bound[0], bound[1], bound[2], bound[3])

        // Calculate subdivide level info
        this.subdivideLevelInfo.push({
            level: 0,
            gridNum: [(bound[2] - bound[0]) / firstLevelSize[0], (bound[3] - bound[1]) / firstLevelSize[1],],
            gridSize: firstLevelSize,
        })
        options.subdivideRules.forEach((value, level) => {
            const lastInfo = this.subdivideLevelInfo[level]
            const gridNum = [lastInfo.gridNum[0] * value[0], lastInfo.gridNum[1] * value[1]] as [number, number]
            const gridSize = [lastInfo.gridSize[0] / value[0], lastInfo.gridSize[1] / value[1]] as [number, number]
            this.subdivideLevelInfo.push({
                level: level + 1, gridNum, gridSize,

            })
        })

        // Create Tile-Manager
        this.tileManager = new TileManager({
            baseURL: this.baseURL,
            tileSize: this.tileSize,
            subdivideLevelInfo: this.subdivideLevelInfo,
            boundaryCondition: this.boundaryCondition,
        })

    }

    onAdd(map: Map) {

        this.map = map

        // Display bounding box polygon on map
        // this.debugShowBBox(this.boundaryCondition);
        // this.map.fitBounds(bboxVec4Transform(this.boundaryCondition.vec4), { "duration": 1000, "padding": 100 })

        // Debug 
        // const tilesInfo = this.tileManager.tileInfoList
        // const levelTile = tilesInfo[6]
        // const bboxes = levelTile.tiles.map((tile) => {
        //     return tile.tileBBox
        // })
        // this.debugShowBBoxes(bboxes)

        // Bind update event on 'render' for real time tile control 
        // this.update = this.update.bind(this)
        // map.on('render', this.update)


        return document.createElement('div')
    }
    onRemove(map: Map) {

        console.log('remove nh tile control')

    }

    /** trigger tile update */
    update() {
        // console.log(Date.now().toString() + " tile control trigger render!")

        const tr = this.map.transform
        const mapviewBounds = tr.getBounds().toArray().flat()
        // const pixelsPerMeter = tr.pixelsPerMeter //以当前视口中心和zoom计算的，先以此为pixelsPermeter

    }


    /////////////////// Functions ////////////////////
    visibleTiles() {

        // const vTiles = []


        // return vTiles;
    }

    getTileByID(id: string) {
        return this.tileManager.getTileByID(id)
    }

    getTileRenderInfo(tile: Tile) {

        const centerInMeter = tile.tileCenter
        const centerInLngLat = coordTransform(centerInMeter[0], centerInMeter[1])
        const targetMapTile = lnglat2Tile(centerInLngLat[0], centerInLngLat[1], this.map.transform.zoom)

        const centerInMapTileCoord = lnglat2TileLCS(centerInLngLat[0], centerInLngLat[1], targetMapTile)
        const tileMatrix = calcTileMatrix(this.map, targetMapTile)
        const tileToMeter = tile2Meter(targetMapTile, centerInMapTileCoord[1])

        return {
            mapTileCenter: centerInMapTileCoord,
            mapTile2Meter: tileToMeter,
            mapTileMatrix: tileMatrix
        }
    }

    getPointRenderInfo(lnglat: [number, number]) {

        const targetMapTile = lnglat2Tile(lnglat[0], lnglat[1], this.map.transform.zoom)

        const centerInMapTileCoord = lnglat2TileLCS(lnglat[0], lnglat[1], targetMapTile)
        const tileToMeter = tile2Meter(targetMapTile, centerInMapTileCoord[1])
        const tileMatrix = calcTileMatrix(this.map, targetMapTile)

        return {
            mapTileCenter: centerInMapTileCoord,
            mapTile2Meter: tileToMeter,
            mapTileMatrix: tileMatrix
        }
    }



    debugShowBBox(box: BoundingBox2D) {
        const sourceID = Math.random().toString()
        this.map.addSource(sourceID, {
            type: 'geojson',
            data: bbox2DsToGeojson([box]) as any
        })
        this.map.addLayer({
            id: Math.random().toString(),
            type: 'line',
            source: sourceID,
            layout: {},
            paint: {
                'line-color': '#ff0000',
                'line-width': 5,
                'line-opacity': 1.0,
            }
        })
    }

    debugShowBBoxes(boxes: Array<BoundingBox2D>) {

        const geojson = bbox2DsToGeojson(boxes)
        this.map.addSource('bound', {
            type: 'geojson',
            data: geojson as any
        })
        this.map.addLayer({
            id: Math.random().toString(),
            type: 'line',
            source: 'bound',
            layout: {},
            paint: {
                'line-color': '#00FF00',
                'line-width': 1,
                'line-opacity': 1.0,
                "line-dasharray": [2, 5]
            }
        })
    }

}
