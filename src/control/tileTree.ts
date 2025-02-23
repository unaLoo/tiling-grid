
import { coordTransform, bboxTransform } from "../mapjitter/proj"

type TileData = unknown
type TileXYZ = [number, number, number]
type BoundingBox = [number, number, number, number]
type TileLoadCallback = (error?: string, data?: TileData) => void

type SubdivideLevelInfoItem = { gridNum: [number, number], gridSize: [number, number] }
type TileTreeOption = {
    bboxIn2326: BoundingBox
    subdivideLevelInfo: SubdivideLevelInfoItem[]
}


class Node {
    // Node ID：0-124131 , 1-012231
    id: string
    level: number
    tileGridNum: number // grid num per tile side
    gridUnitMeter: number = 1
    projLeftBottom: [number, number]
    geoBoundaryIn4326: BoundingBox
    totalBoundaryIn4326: BoundingBox
    _parent: Node | null = null
    _children: Array<Node | null> = [null, null, null, null]
    constructor({ id, level, tileGridNum, projLeftBottom, parent, gridUnitMeter, totalBoundaryIn4326, geoBoundaryIn4326 }: {
        id: string
        level: number
        parent?: Node | undefined | null
        tileGridNum: number
        gridUnitMeter?: number
        projLeftBottom: [number, number]
        geoBoundaryIn4326: BoundingBox
        totalBoundaryIn4326: BoundingBox
    }) {
        this.id = id
        this.level = level
        this.tileGridNum = tileGridNum
        this.projLeftBottom = projLeftBottom
        this.totalBoundaryIn4326 = totalBoundaryIn4326
        this.geoBoundaryIn4326 = geoBoundaryIn4326
        parent && (this._parent = parent)
        gridUnitMeter && (this.gridUnitMeter = gridUnitMeter)
    }

    /** return node `Projection-Coordinate` in meter */
    get nodeBBoxIn2326() {

        // Projection coordinate in meter
        const length = this.tileGridNum * this.gridUnitMeter

        return [
            this.projLeftBottom[0],
            this.projLeftBottom[1],
            this.projLeftBottom[0] + length,
            this.projLeftBottom[1] + length,
        ]

    }

    get nodeBBoxIn4326() {
        const LB = coordTransform(this.nodeBBoxIn2326[0], this.nodeBBoxIn2326[1])
        const RT = coordTransform(this.nodeBBoxIn2326[2], this.nodeBBoxIn2326[3])
        return [...LB, ...RT]
    }


    getParent() {
        return this._parent
    }

    getChildren() {
        return this._children
    }

    getTile() {

    }

    removeChild() {

    }

    findNodeById(targetId: string): Node | null {
        if (this.id === targetId) {
            return this;
        }

        for (const child of this._children) {
            if (child !== null) {
                const res = child.findNodeById(targetId)
                if (res !== null) return res
            }
        }

        return null;
    }


    findNodeByLevel(targetLevel: number): Array<Node | null> {

        const results = [];

        if (this.level === targetLevel) {
            results.push(this);
        }

        else if (this.level < targetLevel) {
            if (this.level + 1 === targetLevel) {
                results.push(...this._children.filter(child => child));
            } else {
                for (const child of this._children) {
                    if (child) {
                        results.push(...child.findNodeByLevel(targetLevel));
                    }
                }
            }
        }

        return results;
    }


    propagate(maxLevel: number) {
        // Ending condition
        if (this.level === maxLevel) return this

        const childGridUnitMeter = this.gridUnitMeter / 2
        const childTileSizeInMeter = this.tileGridNum * childGridUnitMeter

        /* Propagate quad children 
            ---------
            | 2 | 3 |
            ---------
            | 0 | 1 |
            ---------
        */
        // console.log(this.id, this.geoBoundaryIn4326)
        for (let i = 0; i < 4; i++) {

            const nodeLB = [...this.projLeftBottom] as [number, number]
            nodeLB[0] += childTileSizeInMeter * (i % 2)
            nodeLB[1] += childTileSizeInMeter * Math.floor(i / 2)
            const nodeID = this.id + i.toString()

            const fatherBBox4326 = this.geoBoundaryIn4326
            const childBox4326 = [0, 0, 0, 0] as BoundingBox
            childBox4326[0] = lerp(fatherBBox4326[0], fatherBBox4326[2], (i % 2) / 2)
            childBox4326[1] = lerp(fatherBBox4326[1], fatherBBox4326[3], Math.floor(i / 2) / 2)
            childBox4326[2] = childBox4326[0] + (fatherBBox4326[2] - fatherBBox4326[0]) * 1 / 2
            childBox4326[3] = childBox4326[1] + (fatherBBox4326[3] - fatherBBox4326[1]) * 1 / 2

            this._children[i] = new Node({
                id: nodeID,
                parent: this,
                level: this.level + 1,
                tileGridNum: this.tileGridNum,
                projLeftBottom: nodeLB,
                gridUnitMeter: this.gridUnitMeter / 2,
                totalBoundaryIn4326: this.totalBoundaryIn4326,
                geoBoundaryIn4326: childBox4326,
            }).propagate(maxLevel)

        }

        return this
    }
}




export default class TileTree {

    trees: Array<Node> = []
    tileGridNum!: number
    bboxIn2326: BoundingBox
    bboxIn4326: BoundingBox
    subdivideLevelInfo: Array<SubdivideLevelInfoItem>
    expanded2326BBox!: BoundingBox
    expanded4326BBox!: BoundingBox

    constructor(options: TileTreeOption) {
        this.bboxIn2326 = options.bboxIn2326
        this.subdivideLevelInfo = options.subdivideLevelInfo
        this.bboxIn4326 = [
            ...coordTransform(this.bboxIn2326[0], this.bboxIn2326[1]),
            ...coordTransform(this.bboxIn2326[2], this.bboxIn2326[3])
        ] as BoundingBox
        this.initTree()
    }
    initTree() {
        // Take short side of rect as the side length of the tile
        // const [w, h] = [this.bboxIn2326[2] - this.bboxIn2326[0], this.bboxIn2326[3] - this.bboxIn2326[1]]
        const [w, h] = [...this.subdivideLevelInfo[0].gridNum]
        const minEdgeLength = Math.min(w, h)
        const maxEdgeLength = Math.max(w, h)
        this.tileGridNum = minEdgeLength

        // Arrangement direction of the first-level nodes
        const firstDirection = w > h ? 1 : 0

        // Generage first level tile-node
        let firstLevelNodeNum = Math.ceil(maxEdgeLength / minEdgeLength)

        // Calculate expanded 4326 BoundingBox
        const expanded2326BBox = [...this.bboxIn2326] as BoundingBox
        if (firstDirection) {   // row
            expanded2326BBox[2] = expanded2326BBox[0] + (firstLevelNodeNum) * this.tileGridNum * this.subdivideLevelInfo[0].gridSize[0]
        } else {                // colom
            expanded2326BBox[3] = expanded2326BBox[1] + (firstLevelNodeNum) * this.tileGridNum * this.subdivideLevelInfo[0].gridSize[1]
        }
        this.expanded2326BBox = expanded2326BBox

        this.expanded4326BBox = bboxTransform(expanded2326BBox)
        console.log(this.expanded4326BBox)
        for (let i = 0; i < firstLevelNodeNum; i++) {
            const LB = [this.bboxIn2326[0], this.bboxIn2326[1]] as [number, number]
            if (firstDirection) {   // row  
                LB[0] += i * minEdgeLength * this.subdivideLevelInfo[0].gridSize[0]
                LB[1] += 0
            } else {                // column
                LB[0] += 0
                LB[1] += i * minEdgeLength * this.subdivideLevelInfo[0].gridSize[0]
            }

            const box4326 = [0, 0, 0, 0] as BoundingBox
            if (firstDirection) {   // row  
                box4326[0] = lerp(this.expanded4326BBox[0], this.expanded4326BBox[2], i / (firstLevelNodeNum))
                box4326[1] = this.bboxIn4326[1]
                box4326[2] = lerp(this.expanded4326BBox[0], this.expanded4326BBox[2], (i + 1) / (firstLevelNodeNum))
                box4326[3] = this.bboxIn4326[3]
            } else {                // column
                box4326[0] = this.bboxIn4326[0]
                box4326[1] = lerp(this.expanded4326BBox[1], this.expanded4326BBox[3], i / (firstLevelNodeNum))
                box4326[2] = this.bboxIn4326[2]
                box4326[3] = lerp(this.expanded4326BBox[1], this.expanded4326BBox[3], (i + 1) / (firstLevelNodeNum))
            }

            this.trees.push(new Node({
                id: `${i}-`,
                level: 0,
                projLeftBottom: LB,
                tileGridNum: minEdgeLength,
                totalBoundaryIn4326: this.bboxIn4326,
                gridUnitMeter: this.subdivideLevelInfo[0].gridSize[0],
                geoBoundaryIn4326: box4326
            }).propagate(this.subdivideLevelInfo.length - 1))

        }
    }
}

function lerp(a: number, b: number, t: number): number {
    return (1.0 - t) * a + t * b
}
