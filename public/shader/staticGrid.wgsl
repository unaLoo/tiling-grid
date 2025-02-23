
struct VertexInput {
    @builtin(vertex_index) vertexIndex : u32,
    @builtin(instance_index) instanceIndex : u32
}

struct GridTileRenderInfoBlock{
    meter_to_tile: f32,
    grid_row_col: vec2f,
    grid_size: vec2f,// in meter
    base_tile_pos: vec2f,// in local tile unit 
    tile_matrix: mat4x4f    
}




//Uniform Bindings
@group(0) @binding(0) var<uniform> infoBlock : GridTileRenderInfoBlock;

//Storage Bindings
@group(1) @binding(0) var<storage, read> templateGridVert : array<f32>;


@vertex
fn vMain(vInput: VertexInput) -> @builtin(position) vec4f {

    let gridrowcol = vec2u(infoBlock.grid_row_col);
    let grid_LT_Index = (vInput.instanceIndex / gridrowcol.x) * (gridrowcol.x + 1) + (vInput.instanceIndex % gridrowcol.x);
    let grid_RT_Index = grid_LT_Index + 1;
    let grid_LB_Index = grid_LT_Index + u32(infoBlock.grid_row_col.x + 1);
    let grid_RB_Index = grid_LB_Index + 1;
    
    // let gridVertexIndexArray = array<u32, 4>(
    //     grid_LT_Index,
    //     grid_RT_Index,
    //     grid_LB_Index,
    //     grid_RB_Index,
    // );
    // let gridIndex = gridVertexIndexArray[vInput.vertexIndex];
     let lineStripVertIndexArray = array<u32, 5>(
        grid_LT_Index,
        grid_RT_Index,
        grid_RB_Index,
        grid_LB_Index,
        grid_LT_Index, // close the loop
    );
    let vertIndex = lineStripVertIndexArray[vInput.vertexIndex];    

    
    var offsetPosInMeter = vec2f(
        templateGridVert[vertIndex * 2], templateGridVert[vertIndex * 2 + 1]
    );

    offsetPosInMeter = offsetPosInMeter * 1.0 * infoBlock.grid_size; // in meter

    let pos = infoBlock.base_tile_pos + offsetPosInMeter * infoBlock.meter_to_tile;

    return infoBlock.tile_matrix * vec4f(pos, 0.0, 1.0);
}

@fragment
fn fMain() -> @location(0) vec4f{

    return vec4f(0.4,0.4,0.4, 0.1);
}