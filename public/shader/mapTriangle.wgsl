
struct UBlock{
    size : f32,
    meter_to_tile : f32,
    base_tile_pos : vec2f,
    tile_matrix : mat4x4f,
}

//Uniform Bindings
@group(0) @binding(0) var<uniform> block : UBlock;

//Storage Bindings
@group(1) @binding(0) var<storage> templatePoint : array<f32>;



@vertex
fn vMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4 < f32> {

    let pos = array(
        vec2f (0.0, 0.5),
        vec2f (-0.5, -0.5),
        vec2f (0.5, -0.5)
    );

    var vertInTile = block.base_tile_pos + pos[vertexIndex] * 500.0 * block.meter_to_tile;
    var vertCS = block.tile_matrix * vec4f(vertInTile, 0.0, 1.0);
    // var finalVert = vec4f(vertCS.xy, vertCS.z * 0.5 + 0.5, vertCS.w);

    return vertCS;
}


@fragment
fn fMain() -> @location(0) vec4f{


    return vec4f(0.6, 0.0, 0.0, 1.0);
}
