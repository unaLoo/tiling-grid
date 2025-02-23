import { Map, Marker } from "mapbox-gl";

import NHLayerGroup from "../NHLayerGroup";
import * as scratch from '../../scratch/scratch'
import { NHCustomLayerInterface } from "../util/interface";

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


        const tr = this.map.transform

        const { _nearZ, _farZ, _fov, width, height } = tr as any
        // console.log(_nearZ, _farZ, _fov, width, height)
        const wgpuProjMatrix = perspective(_fov, width / height, _nearZ, _farZ, new Float64Array(16))

        /** Target tile in specified point and zoom */
        const targetTile = point2Tile(this.origin[0], this.origin[1], Math.floor(tr.zoom));

        /** Transform from Local-Tile-Space to Clip-Space */
        const tileMatrix = calcTileMatrix(tr, targetTile, wgpuProjMatrix)

        /** Lnglat to Local-Tile-Space in specified tile  */
        const originInTileCoord = lnglat2TileLocalCoord(this.origin, targetTile);

        /** Tile unit per meter */
        const meterPerTileUnit = tileToMeter(targetTile, originInTileCoord[1]);
        const tileUnitPerMeter = 1.0 / meterPerTileUnit;

        // console.log(tileMatrix)

        this.size.n = 100.0
        this.meterToTile.n = tileUnitPerMeter
        this.baseTilePos.x = originInTileCoord[0]
        this.baseTilePos.y = originInTileCoord[1]
        this.tileMatrix.data = tileMatrix


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

import * as tilebelt from '@mapbox/tilebelt'
import { mat4 } from "gl-matrix";
function point2Tile(lng: number, lat: number, z: number) {
    const tile = tilebelt.pointToTile(lng, lat, z);
    return tile;
}

/** Transform from lnglat to tile local coord  */
function lnglat2TileLocalCoord([lng, lat]: [number, number], tileXYZ: [number, number, number]) {

    const EXTENT = 8192;
    const tileBBox = tilebelt.tileToBBOX(tileXYZ)

    return [
        Math.floor((lng - tileBBox[0]) / (tileBBox[2] - tileBBox[0]) * EXTENT),
        Math.floor((1.0 - (lat - tileBBox[1]) / (tileBBox[3] - tileBBox[1])) * EXTENT)
    ]
}


function tileToMeter(tileXYZ: [number, number, number], tileYCoordinate = 0) {

    const canonical = { x: tileXYZ[0], y: tileXYZ[1], z: tileXYZ[2] }
    let ycoord
    canonical.z > 10 ? ycoord = 0 : ycoord = tileYCoordinate
    const EXTENT = 8192;
    const circumferenceAtEquator = 40075017;
    const mercatorY = (canonical.y + ycoord / EXTENT) / (1 << canonical.z);
    const exp = Math.exp(Math.PI * (1 - 2 * mercatorY));
    // simplify cos(2 * atan(e) - PI/2) from mercator_coordinate.js, remove trigonometrics.
    return circumferenceAtEquator * 2 * exp / (exp * exp + 1) / EXTENT / (1 << canonical.z);
}

function calcTilePosMatrix(tr: any, tileXYZ: [number, number, number]) {

    const canonical = { x: tileXYZ[0], y: tileXYZ[1], z: tileXYZ[2] }
    let scale, scaledX, scaledY;
    // @ts-ignore
    const posMatrix = mat4.identity(new Float64Array(16));
    const EXTENT = 8192;

    // Note: Delete some operations about tile.wrap
    scale = tr.worldSize / Math.pow(2, canonical.z);
    scaledX = canonical.x * scale;
    scaledY = canonical.y * scale;

    mat4.translate(posMatrix, posMatrix, [scaledX, scaledY, 0]);
    mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);

    return posMatrix;
}

function calcTileMatrix(tr: any, tileXYZ: [number, number, number], projMatrix: number[]) {

    const finalTileMatrix = mat4.create();
    const posMatrix = calcTilePosMatrix(tr, tileXYZ);

    const world2camera = tr._camera.getWorldToCamera(tr.worldSize, tr.pixelsPerMeter)

    mat4.multiply(finalTileMatrix, world2camera as mat4, posMatrix);
    mat4.multiply(finalTileMatrix, projMatrix as mat4, finalTileMatrix);

    return new Float32Array(finalTileMatrix);
}


function perspective(fieldOfViewYInRadians: any, aspect: any, zNear: any, zFar: any, dst: any) {
    dst = dst;
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
    dst[0] = f / aspect;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = 0;
    dst[5] = f;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 0;
    dst[9] = 0;
    dst[11] = -1;
    dst[12] = 0;
    dst[13] = 0;
    dst[15] = 0;
    if (zFar === Infinity) {
        dst[10] = -1;
        dst[14] = -zNear;
    }
    else {
        const rangeInv = 1 / (zNear - zFar);
        dst[10] = zFar * rangeInv;
        dst[14] = zFar * zNear * rangeInv;
    }
    return dst;
}