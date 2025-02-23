@vertex 
fn vMain (@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {

    let pos = array(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5)
    );

    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment 
fn fMain() -> @location(0) vec4f{
    return vec4f(0.5, 0.0, 0.0, 1.0);
}