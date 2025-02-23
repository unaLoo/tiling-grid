import { Map } from 'mapbox-gl'
import { mat4 } from 'gl-matrix'
import proj4, { Converter } from 'proj4'
import { pointToTile, tileToBBOX } from "@mapbox/tilebelt"
proj4.defs("EPSG:2326", "+proj=tmerc +lat_0=22.3121333333333 +lon_0=114.178555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,-0.067753,2.243648,1.158828,-1.094246 +units=m +no_defs +type=crs")

// Sharing parameters
const EXTENT = 8192;
const circumferenceAtEquator = 40075017;
// const earthRadius = 6371008.8;
// const earthCircumference = 2 * Math.PI * earthRadius;
// const DEG_TO_RAD = Math.PI / 180;
// const DEFAULT_MIN_ZOOM = 0;
// const DEFAULT_MAX_ZOOM = 25.5;
// const MAX_MERCATOR_LATITUDE = 85.051129;



/////////////////////////////////////////////////////////
//////////// Geo CS --> Tile local CS ///////////////////
/////////////////////////////////////////////////////////
type TileXYZ = { x: number, y: number, z: number }

/** Find target tile of lnglat in specific z */
export function lnglat2Tile(lng: number, lat: number, z: number): TileXYZ {

    const tile = pointToTile(lng, lat, Math.floor(z));
    return { x: tile[0], y: tile[1], z: tile[2] };
}

/** Calculate [x, y] in tile local CS in specific tile */
export function lnglat2TileLCS(lng: number, lat: number, tile: TileXYZ) {

    const EXTENT = 8192;
    const tileXYZ = [tile.x, tile.y, tile.z] as [number, number, number]
    const tileBBox = tileToBBOX(tileXYZ)
    return [
        Math.floor((lng - tileBBox[0]) / (tileBBox[2] - tileBBox[0]) * EXTENT),
        Math.floor((1.0 - (lat - tileBBox[1]) / (tileBBox[3] - tileBBox[1])) * EXTENT)
    ]
}

/** Calculate tile`s model matrix, including scaling and translation */
export function calcTilePosMatrix(map: Map, tileXYZ: TileXYZ) {

    let scale, scaledX, scaledY;
    const posMatrix = mat4.create();
    const worldSize = map.transform.worldSize

    // Note: Delete some operations about tile.wrap
    // WorldSize = 8192 * 2 ^ mapZoom in tile unit
    // Scale happened in fraction of map zoom
    scale = worldSize / Math.pow(2, tileXYZ.z);
    scaledX = tileXYZ.x * scale;
    scaledY = tileXYZ.y * scale;

    mat4.translate(posMatrix, posMatrix, [scaledX, scaledY, 0]);
    mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);

    return posMatrix;
}

/** Local tile CS in specific tile To final clip space */
export function calcTileMatrix(map: Map, tileXYZ: TileXYZ) {

    const finalTileMatrix = mat4.create();
    const posMatrix = calcTilePosMatrix(map, tileXYZ);
    const projMatrix = map.transform.projMatrix;

    mat4.multiply(finalTileMatrix, projMatrix, posMatrix);
    return finalTileMatrix;
}

/** Convert `tile-unit` to `meter-unit` */
export function tile2Meter(tile: TileXYZ, tileYCoordinate = 0) {

    // 10 as a zoom tolerance
    let ycoord
    tile.z > 10 ? ycoord = 0 : ycoord = tileYCoordinate

    const mercatorY = (tile.y + ycoord / EXTENT) / (1 << tile.z);
    const exp = Math.exp(Math.PI * (1 - 2 * mercatorY));
    // simplify cos(2 * atan(e) - PI/2) from mercator_coordinate.js, remove trigonometrics.
    return circumferenceAtEquator * 2 * exp / (exp * exp + 1) / EXTENT / (1 << tile.z);
}

// /** `pixelsPerMeter` is used to describe relation between real world and pixel distances.*/
// function pixelsPerMeter(map: mapboxgl.Map): number {

//     const tr = map.transform
//     return tr.projection.pixelsPerMeter(tr.center.lat, tr.worldSize);
// }




/////////////////////////////////////////////////////////
//////////// Projection CS --> Geo CS ///////////////////
/////////////////////////////////////////////////////////

/** Default converte : EPSG:2326 -> EPSG:4326 */
let _projConverter: null | Converter = null
export function projConverter(srcCS: string = 'EPSG:2326', destCS: string = 'EPSG:4326'): Converter {
    if (_projConverter) return _projConverter
    _projConverter = proj4(srcCS, destCS)
    return _projConverter
}
export function bboxVec4Transform(lbrt: [number, number, number, number]) {
    return [
        coordTransform(lbrt[0], lbrt[1]),
        coordTransform(lbrt[2], lbrt[3])
    ].flat() as [number, number, number, number]
}

export function bboxPointsTransform(boxPoints: [number, number][]) {
    const [lb, rb, lt, rt] = boxPoints
    return [
        coordTransform(...lb),
        coordTransform(...rb),
        coordTransform(...lt),
        coordTransform(...rt)
    ]
}
export function coordTransform(x: number, y: number) {
    const converter = _projConverter
    if (!converter) {
        console.warn("No valid converter")
        return [x, y]
    }
    const [lon, lat] = converter.forward([x, y])
    return [lon, lat]
}