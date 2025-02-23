import proj4, { Converter } from 'proj4'

proj4.defs("EPSG:2326", "+proj=tmerc +lat_0=22.3121333333333 +lon_0=114.178555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,-0.067753,2.243648,1.158828,-1.094246 +units=m +no_defs +type=crs")


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