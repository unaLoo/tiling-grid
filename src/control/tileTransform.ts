import { mat4 } from "gl-matrix";
import * as tilebelt from '@mapbox/tilebelt'

export function point2Tile(lng: number, lat: number, z: number) {
    const tile = tilebelt.pointToTile(lng, lat, Math.floor(z));
    return tile;
}

/** Transform from lnglat to tile local coord  */
export function lnglat2TileLocalCoord([lng, lat]: [number, number], tileXYZ: [number, number, number]) {

    const EXTENT = 8192;
    const tileBBox = tilebelt.tileToBBOX(tileXYZ)

    return [
        Math.floor((lng - tileBBox[0]) / (tileBBox[2] - tileBBox[0]) * EXTENT),
        Math.floor((1.0 - (lat - tileBBox[1]) / (tileBBox[3] - tileBBox[1])) * EXTENT)
    ]
}


export function tileToMeter(tileXYZ: [number, number, number], tileYCoordinate = 0) {

    const canonical = { x: tileXYZ[0], y: tileXYZ[1], z: tileXYZ[2] }
    // let ycoord
    // canonical.z > 10 ? ycoord = 0 : ycoord = tileYCoordinate
    let ycoord = tileYCoordinate
    const EXTENT = 8192;
    const circumferenceAtEquator = 40075017;
    const mercatorY = (canonical.y + ycoord / EXTENT) / (1 << canonical.z);
    const exp = Math.exp(Math.PI * (1 - 2 * mercatorY));
    // simplify cos(2 * atan(e) - PI/2) from mercator_coordinate.js, remove trigonometrics.
    return circumferenceAtEquator * 2 * exp / (exp * exp + 1) / EXTENT / (1 << canonical.z);
}

export function calcTilePosMatrix(tr: any, tileXYZ: [number, number, number]) {

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

export function calcTileMatrix(tr: any, tileXYZ: [number, number, number]) {

    const finalTileMatrix = mat4.create();
    const { _nearZ, _farZ, _fov, width, height } = tr as any

    const posMatrix = calcTilePosMatrix(tr, tileXYZ)// tile —> world
    console.log()
    const world2camera = tr._camera.getWorldToCamera(tr.worldSize, tr.pixelsPerMeter) // world —> camera
    const wgpuProjMatrix = perspective(_fov, width / height, _nearZ, _farZ, new Float64Array(16)) // camera —> clip

    mat4.multiply(finalTileMatrix, world2camera as mat4, posMatrix);
    mat4.multiply(finalTileMatrix, wgpuProjMatrix as mat4, finalTileMatrix);

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