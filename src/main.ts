import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

//////// REACT UI ////////
// import Depository from './depository'
// import setupDom from './react/index'

//////// MAP ////////////
import NHLayerGroup from './map/NHLayerGroup'
import NHTileControl from './control/tileControl'
import MapTriangleLayer from './map/layers/mapTriangleLayer'
import StaticGridLayer from './map/layers/staticSingleGridLayerV2'

// DOM Configuration //////////////////////////////////////////////////////////////////////////////////////////////////////
const root = document.getElementById('app')!

// Map
const mapDiv = document.createElement('div')
mapDiv.style.height = '100%'
mapDiv.style.width = '100%'
mapDiv.id = 'map'
root.appendChild(mapDiv)

const gpuCanvas = document.createElement('canvas')
gpuCanvas.id = "gpuCanvas"
gpuCanvas.style.position = 'absolute'
gpuCanvas.style.top = '0'
gpuCanvas.style.width = '100%'
gpuCanvas.style.height = '100%'
gpuCanvas.style.pointerEvents = 'none'
gpuCanvas.style.cursor = 'grab'
gpuCanvas.style.backgroundColor = 'transparent'
gpuCanvas.style.zIndex = '1';
root.appendChild(gpuCanvas)

// Start Dash ////////////////////////////////////////////////////////////////////////////////////////////////

mapboxgl.accessToken = 'pk.eyJ1IjoieWNzb2t1IiwiYSI6ImNrenozdWdodDAza3EzY3BtdHh4cm5pangifQ.ZigfygDi2bK4HXY1pWh-wg'

const map = new mapboxgl.Map({
	// style: 'mapbox://styles/ycsoku/cm3zhjxbs00pa01sd6hx7grtr',
	// style: 'mapbox://styles/ycsoku/clrjfv4jz00pe01pdfxgshp6z',
	style: "mapbox://styles/mapbox/dark-v11",
	center: [114.051537, 22.446937],
	projection: 'mercator',
	container: 'map',
	antialias: true,
	maxZoom: 22,
	zoom: 15

}).on('load', () => {

	const tileControl = new NHTileControl({
		baseURL: '/tileServer',
		tileSize: [512,512],
		// tileSize: [666, 999], 
		coordTransformRule: ['EPSG:2326', 'EPSG:4326'],
		boundaryCondition: [808357.5000000000000000, 824117.5000000000000000, 838897.5000000000000000, 843902.5000000000000000],
		firstLevelSize: [64, 64],
		// firstLevelSize: [128, 256],
		subdivideRules: [
			[2, 2],
			[2, 2],
			[2, 2],
			[2, 2],
			[2, 2],
			[2, 2],
		]
	})
	map.addControl(tileControl)

	const layerGroup = new NHLayerGroup({
		canvas: gpuCanvas,
		tileControl: tileControl
	})
	map.addLayer(layerGroup)

	//////// Layers /////////////////////////////////////////////
	// const tiles = tileControl.getTilesByLevel(3)
	// console.log(tiles.map(t=>t.id))

	const tile = tileControl.getTileByID('1-0-0')!
	layerGroup.addLayer(new StaticGridLayer({ id: 'grid', tile: tile }))
	// layerGroup.addLayer(new StaticGridLayer({ id: '2', tile: tileControl.getTileByID('1-0-1')! }))


	map.on('click', e => {
		console.log(e.lngLat)
	})


	// layerGroup.addLayer(new MapTriangleLayer({ id: 'qwss', origin: [114.051537, 22.446937] }))
	// map.setCenter([120.980697, 31.684162])
	// map.setZoom(18.5)


	// map.addLayer(new TestingLayer())
	// Depository.getInstance().setData("MapInstance", map)
	// setupDom()


	// map.showTileBoundaries = true
	// const colorEarth = new ColorEarth()	
	// map.addLayer(colorEarth as mapboxgl.CustomLayerInterface)


})



