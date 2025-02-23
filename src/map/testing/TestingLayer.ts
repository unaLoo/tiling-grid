import axios from "axios";
import { Map, CustomLayerInterface } from "mapbox-gl";
import { makeShaderDataDefinitions, makeStructuredView, StructuredView } from 'webgpu-utils'


export default class TestingLayer implements CustomLayerInterface {

    id: string = "Triangle-Layer";
    type: "custom" = "custom";
    renderingMode?: "2d" | "3d" = "2d"; // share depth buffer with other layers

    map!: Map
    ready: boolean = false

    context!: GPUCanvasContext
    device!: GPUDevice
    module!: GPUShaderModule
    pipeline!: GPURenderPipeline
    renderPassDescriptor!: GPURenderPassDescriptor
    bindGroupLayout!: GPUBindGroupLayout;
    bindGroup!: GPUBindGroup;
    renderPipelineLayout!: GPUPipelineLayout;
    positionBuffer!: GPUBuffer;
    normalsBuffer!: GPUBuffer;
    texCoordsBuffer!: GPUBuffer;
    indexBuffer!: GPUBuffer;
    indexCount!: number;
    depthTexture!: GPUTexture;
    uniformValueMap!: Record<string, StructuredViewPlus>;
    fUniformBuffer!: GPUBuffer;
    vUniformBuffer!: GPUBuffer;

    constructor() {


    }

    ////////////////////////////////////////////////////////
    // Initialize gl resources and register event listeners
    ////////////////////////////////////////////////////////
    async onAdd(map: Map, gl: WebGL2RenderingContext) {

        this.map = map

        ////////// [0] Init webgpu context , request gpu device
        const canvas = document.querySelector('#gpuCanvas') as HTMLCanvasElement
        const context = this.context = canvas.getContext('webgpu')!
        const adapter = await navigator.gpu.requestAdapter();
        const preferFormat = navigator.gpu.getPreferredCanvasFormat();
        const device = this.device = await adapter?.requestDevice()!;
        if (!device) {
            console.warn('WebGPU Not Support');
            return;
        }
        context.configure({
            "device": device,
            "format": preferFormat,
            "alphaMode": "premultiplied",
        })


        ////////// [1] Create shader module

        const shaderCode = (await axios.get('/shader/base.wgsl')).data
        const module = this.module = device.createShaderModule({
            label: 'hardcoded triangle shader module',
            code: shaderCode,
        });


        ////////// [2] Buffers

        /// vertex buffer
        const { positions, normals, texcoords, indices } = oneBall(18, 36, 1)
        this.positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX)
        this.normalsBuffer = createBuffer(device, normals, GPUBufferUsage.VERTEX)
        this.texCoordsBuffer = createBuffer(device, texcoords, GPUBufferUsage.VERTEX)

        /// index buffer
        this.indexCount = indices.length
        this.indexBuffer = createBuffer(device, indices, GPUBufferUsage.INDEX)


        /// uniform buffer
        const uniformValueMap = this.uniformValueMap = getUniformValueMap(shaderCode)

        const fUniformBuffer = this.fUniformBuffer = device.createBuffer({
            label: 'fUniformBuffer',
            size: uniformValueMap['f_uniform'].size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        uniformValueMap['f_uniform'].views['ambient_light'].set([1.0, 1.0, 1.0])
        uniformValueMap['f_uniform'].views['diffuse_light'].set([1.0, 1.0, 1.0])
        uniformValueMap['f_uniform'].views['specular_light'].set([0.9, 0.9, 0.9])
        uniformValueMap['f_uniform'].views['light_pos'].set([0.824, 0.449, 0.03])
        uniformValueMap['f_uniform'].views['camera_pos'].set([0.0, 0.0, 0.0])

        const vUniformBuffer = this.vUniformBuffer = device.createBuffer({
            label: 'vUniformBuffer',
            size: uniformValueMap['v_uniform'].size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
        uniformValueMap['v_uniform'].views['u_matrix'].set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        uniformValueMap['v_uniform'].views['normal_matrix'].set([1, 0, 0, 0, 1, 0, 0, 0, 1])


        ////////// [3] Texture and sampler
        const url = '/image/earth.jpg';
        const imgBitmap = await loadImageBitmap(url)
        const texture = device.createTexture({
            "label": 'texture',
            "format": 'rgba8unorm',
            "size": [imgBitmap.width, imgBitmap.height],
            "usage": GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        })
        device.queue.copyExternalImageToTexture(
            {
                "source": imgBitmap,
                "flipY": true,
            },
            {
                "texture": texture,
            },
            {
                "height": imgBitmap.height,
                "width": imgBitmap.width,
            }
        )
        this.depthTexture = device.createTexture({
            "label": 'new depth texture',
            "format": "depth24plus",
            "size": [canvas.width, canvas.height],
            "usage": GPUTextureUsage.RENDER_ATTACHMENT //注意，深度纹理usage:Render_ATTACHMENT
        })
        const sampler = device.createSampler({
            "label": 'sampler',
            "addressModeU": 'clamp-to-edge',
            "addressModeV": 'clamp-to-edge',
            "addressModeW": 'clamp-to-edge',
            "mipmapFilter": 'nearest',
            "magFilter": 'nearest',
            "minFilter": 'nearest',
            // "compare"  // 常用于深度纹理，比较采样器
            // "minFilter": 0,
            // "lodMaxClamp": 32, // 限制mipmap级别，性能优化
            // "maxAnisotropy": 16 // 各向异性滤波在多轴上采样，性能优化相关
        })


        ///////// [4] BindGroupLayout and BindGroup
        this.bindGroupLayout = device.createBindGroupLayout({
            'label': 'bindgrouplayout',
            'entries': [
                {   // @group(0) @binding(0) var<uniform> v_uniform:VUniform;
                    "binding": 0,
                    "visibility": GPUShaderStage.VERTEX,
                    "buffer": { "type": 'uniform' }
                },
                {   // @group(0) @binding(1) var<uniform> f_uniform:FUniform;
                    "binding": 1,
                    "visibility": GPUShaderStage.FRAGMENT,
                    "buffer": { "type": 'uniform' }
                },
                {   // @group(0) @binding(2) var the_sampler: sampler;
                    "binding": 2,
                    "visibility": GPUShaderStage.FRAGMENT,
                    "sampler": { "type": "filtering" }
                },
                {   // @group(0) @binding(3) var the_texture: texture_2d<f32>;
                    "binding": 3,
                    "visibility": GPUShaderStage.FRAGMENT,
                    "texture": { "viewDimension": "2d" }
                }
            ]
        })
        this.bindGroup = device.createBindGroup({
            'label': 'bindgroup',
            'layout': this.bindGroupLayout,
            'entries': [
                {
                    "binding": 0,
                    "resource": { buffer: vUniformBuffer }
                },
                {
                    "binding": 1,
                    "resource": { buffer: fUniformBuffer }
                },
                {
                    "binding": 2,
                    "resource": sampler
                },
                {
                    "binding": 3,
                    "resource": texture.createView()
                }
            ]
        })


        ///////// [5] PipelineLayout and RenderPipeline
        this.renderPipelineLayout = device.createPipelineLayout({
            label: 'renderpipelineLayout',
            "bindGroupLayouts": [this.bindGroupLayout]

        })
        this.pipeline = device.createRenderPipeline({
            label: "pipeline",
            "layout": this.renderPipelineLayout,
            "vertex": {
                "module": module,
                "entryPoint": 'v_main',
                "buffers": [
                    {
                        //@location(0) position: vec4f, 
                        "arrayStride": 3 * 4,
                        "attributes": [
                            {
                                "shaderLocation": 0,
                                "format": "float32x3",
                                "offset": 0
                            }
                        ]
                    },
                    {
                        // @location(1) normal: vec3f,
                        "arrayStride": 3 * 4,
                        "attributes": [
                            {
                                "shaderLocation": 1,
                                "format": "float32x3",
                                "offset": 0
                            }
                        ]
                    },
                    {
                        // @location(2) texcoord: vec2f
                        "arrayStride": 2 * 4,
                        "attributes": [
                            {
                                "shaderLocation": 2,
                                "format": "float32x2",
                                "offset": 0
                            }
                        ]
                    }
                ]
            },
            "fragment": {
                "module": module,
                "targets": [{
                    "format": preferFormat,
                    "blend": {
                        // result_color=(src_color×src_alpha)+(dst_color×(1−src_alpha))
                        "color": {
                            "srcFactor": "src-alpha",
                            "dstFactor": "one-minus-src-alpha",
                            "operation": "add"
                        },
                        // result_alpha=(src_alpha×1)+(dst_alpha×0)=dst_alpha
                        "alpha": {
                            "srcFactor": "one",
                            "dstFactor": "one-minus-src-alpha",
                            "operation": "add"
                        }
                    }
                }]
            },
            "primitive": {
                "topology": "triangle-list",
            },
            "depthStencil": {
                "depthWriteEnabled": true,
                "depthCompare": "less",
                "format": "depth24plus"
            }
        })

        ///////// [6] Create a render pass descriptor
        this.renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: [0., 0., 0., 0.],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                "depthClearValue": 1.0,
                "depthLoadOp": 'clear',
                "depthStoreOp": "store",
                "view": null
            }
        } as any;

        ///////// [7] canvas observer
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const canvas = entry.target as HTMLCanvasElement;
                const width = entry.contentBoxSize[0].inlineSize;
                const height = entry.contentBoxSize[0].blockSize;
                canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
                // this.render(gl, []); 

                this.depthTexture = device.createTexture({
                    "label": 'new depth texture',
                    "format": "depth24plus",
                    "size": [canvas.width, canvas.height],
                    "usage": GPUTextureUsage.RENDER_ATTACHMENT //注意，深度纹理usage:Render_ATTACHMENT
                })

                console.log(`ResizeObserver :: canvasSize:[${canvas.width} x ${canvas.height}]`);
            }
        });
        observer.observe(canvas);

        this.ready = true;
    }


    ////////////////////////////////////////////////////////
    // Clean up gl resources and event listeners.
    ////////////////////////////////////////////////////////
    onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext) {

    }

    ////////////////////////////////////////////////////////
    // Draw into the GL context.  -- Render to main framebuffer
    ////////////////////////////////////////////////////////
    render(gl: WebGL2RenderingContext, matrix: Array<number>) {

        console.log(Date.now().toString() + ' ' + this.id + ' rendering ')

        if (!this.ready) { this.map && this.map.triggerRepaint(); return; }

        this.renderPassDescriptor!.colorAttachments = [{
            view: this.context!.getCurrentTexture().createView(),
            clearValue: [0., 0., 0., 0.],
            loadOp: 'clear',
            storeOp: 'store',
        }]
        this.renderPassDescriptor!.depthStencilAttachment = {
            view: this.depthTexture.createView(),
            'depthClearValue': 1.0,
            'depthLoadOp': 'clear',
            'depthStoreOp': 'store',
        }
        const camera_pos = this.map.transform._camera.position
        this.uniformValueMap['f_uniform'].views['camera_pos'].set(camera_pos)
        this.device.queue.writeBuffer(this.fUniformBuffer, 0, this.uniformValueMap['f_uniform'].arrayBuffer)

        this.uniformValueMap['v_uniform'].views['u_matrix'].set(matrix)
        this.uniformValueMap['v_uniform'].views['normal_matrix'].set([1, 0, 0, 0, 1, 0, 0, 0, 1])
        this.device.queue.writeBuffer(this.vUniformBuffer, 0, this.uniformValueMap['v_uniform'].arrayBuffer)


        const commandEncoder = this.device.createCommandEncoder({ label: 'our encoder' });

        // 创建一个 render pass 编码器来编码特定的命令
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor!);

        passEncoder.setBindGroup(0, this.bindGroup)
        passEncoder.setVertexBuffer(0, this.positionBuffer)
        passEncoder.setVertexBuffer(1, this.normalsBuffer)
        passEncoder.setVertexBuffer(2, this.texCoordsBuffer)
        passEncoder.setIndexBuffer(this.indexBuffer, "uint16")

        passEncoder.setPipeline(this.pipeline)

        passEncoder.drawIndexed(this.indexCount);

        passEncoder.end();
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

}


///// Helper

function oneCube() {
    const positions = new Float32Array([1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1, -1]);
    const normals = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
    const texcoords = new Float32Array([1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23]);
    return {
        positions, normals, texcoords, indices
    }
}
function oneBall(numLatitudeBands: number, numLongitudeBands: number, radius: number) {
    const positions: number[] = [];
    const normals: number[] = [];
    const texcoords: number[] = [];
    const indices: number[] = [];

    // 计算经纬度的步长
    const phiStep = Math.PI / numLatitudeBands;  // latitude bands (从上到下)
    const thetaStep = 2 * Math.PI / numLongitudeBands; // longitude bands (从左到右)

    // 生成顶点位置、法线和纹理坐标
    for (let latNumber = 0; latNumber <= numLatitudeBands; latNumber++) {
        const phi = latNumber * phiStep;  // 纬度角度
        for (let lonNumber = 0; lonNumber <= numLongitudeBands; lonNumber++) {
            const theta = lonNumber * thetaStep;  // 经度角度

            // 计算球体的顶点位置
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);

            positions.push(x, y, z);

            // 计算法线（单位向量）
            const nx = x / radius;
            const ny = y / radius;
            const nz = z / radius;

            normals.push(nx, ny, nz);

            // 计算纹理坐标
            const u = lonNumber / numLongitudeBands;
            const v = latNumber / numLatitudeBands;

            texcoords.push(u, v);
        }
    }

    // 生成索引数组，连接三角形
    for (let latNumber = 0; latNumber < numLatitudeBands; latNumber++) {
        for (let lonNumber = 0; lonNumber < numLongitudeBands; lonNumber++) {
            const first = latNumber * (numLongitudeBands + 1) + lonNumber;
            const second = first + numLongitudeBands + 1;

            // 生成两个三角形
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    // 转换为数组
    const positionsArray = new Float32Array(positions);
    const normalsArray = new Float32Array(normals);
    const texcoordsArray = new Float32Array(texcoords);
    const indicesArray = new Uint16Array(indices);

    return {
        positions: positionsArray,
        normals: normalsArray,
        texcoords: texcoordsArray,
        indices: indicesArray
    };
}




function createBuffer(device: GPUDevice, data: ArrayBuffer, usage: GPUBufferUsageFlags) {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage,
        mappedAtCreation: true,// 创建缓冲区时，映射到内存中
    });
    new (data as any).constructor(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
}


async function loadImageBitmap(url: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { "premultiplyAlpha": "none", "colorSpaceConversion": "none" });
}


type StructuredViewPlus = StructuredView & { size: number }
export const getUniformValueMap = (code: string) => {

    const defs = makeShaderDataDefinitions(code);
    const uniformBufferInfos: Record<string, StructuredViewPlus> = {}
    for (let u in defs.uniforms) {
        const uniformValues = makeStructuredView(defs.uniforms[u]);
        const plus: StructuredViewPlus = { ...uniformValues, size: defs.uniforms[u].size }
        uniformBufferInfos[u] = plus
    }
    return uniformBufferInfos;
}