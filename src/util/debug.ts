import BoundingBox2D from "./boundingBox2D";
import { bboxPointsTransform } from "../util/spaceTransform";


export function bbox2DsToGeojson(box2Ds: BoundingBox2D[]) {
    const features = box2Ds.map(box2D => {
        const points4326 = bboxPointsTransform(box2D.points)
        return bboxPointsToGeofeature(points4326 as [number, number][])
    })
    return featuresToGeojson(features)
}


export function bbox2DtoGeojson(bbox: BoundingBox2D) {
    const points4326 = bboxPointsTransform(bbox.points)
    const feature = bboxPointsToGeofeature(points4326 as [number, number][])
    const geojson = featuresToGeojson([feature])
    return geojson
}

export function bboxPointsToGeofeature(points: [number, number][]) {
    const [lb, rb, lt, rt] = points;
    return {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "coordinates": [
                lb, // bottom-left
                rb, // bottom-right
                rt, // top-right
                lt, // top-left
                lb  // close the polygon
            ],
            "type": "LineString"
        }
    }
}

export function featuresToGeojson(features: Array<Object>) {
    return {
        "type": "FeatureCollection",
        "features": features
    }
}