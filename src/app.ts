import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// type definitions
interface BlockData {
  centroid_x: number;
  centroid_y: number;
  centroid_z: number;
  dim_x: number;
  dim_y: number;
  dim_z: number;
  rock: string;
}

export class MiningVizApp {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private modelCenter = new THREE.Vector3();
  private coordinateOffset = new THREE.Vector3(); // to handle large coordinates

  constructor(container: HTMLElement) {
    console.log('Initializing app');
    
    // background color
    this.scene.background = new THREE.Color(0x333333);
    
    // setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    
    // set up camera
    this.camera = new THREE.PerspectiveCamera(
      60, 
      container.clientWidth / container.clientHeight, 
      1, 
      10000 // we'll normalize coordinates so this is sufficient
    );
    this.camera.position.set(0, 0, 1000);
    
    // set up controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    
    // add lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    // add grid and axes for reference
    const gridHelper = new THREE.GridHelper(2000, 20);
    this.scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(500);
    this.scene.add(axesHelper);
    
    // handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
    
    // start animation loop
    this.animate();
    
    console.log('App initialization complete');
  }
  
  public async loadData(url: string) {
    try {
      console.log('Loading data from:', url);
      
      // load CSV data
      const response = await fetch(url);
      const text = await response.text();
      console.log('CSV data loaded, length:', text.length);
      
      const data = this.parseCSV(text);
      console.log('Parsed blocks:', data.length);
      
      if (data.length > 0) {
        // compute coordinate offset to bring values close to origin
        this.computeCoordinateOffset(data);
        console.log('Using coordinate offset:', this.coordinateOffset);
        
        // create visualization
        this.createBlockModel(data);
      } else {
        console.error('No valid blocks found in data');
      }
      
    } catch (error) {
      console.error('Failed to load or parse data:', error);
    }
  }
  
  private parseCSV(csvText: string): BlockData[] {
    const lines = csvText.split('\n');
    console.log('CSV lines:', lines.length);
    
    // Find rock column index
    const headers = lines[0].split(',');
    const rockIndex = headers.indexOf('rock');
    
    console.log('Headers:', headers);
    console.log('Rock index:', rockIndex);
    
    const data: BlockData[] = [];
    
    // Skip header lines (first 3 rows in the example)
    for (let i = 3; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      
      // Only process rows with enough values
      if (values.length < 6) continue;
      
      try {
        const block: BlockData = {
          centroid_x: parseFloat(values[0]),
          centroid_y: parseFloat(values[1]),
          centroid_z: parseFloat(values[2]),
          dim_x: parseFloat(values[3]),
          dim_y: parseFloat(values[4]),
          dim_z: parseFloat(values[5]),
          rock: rockIndex >= 0 && rockIndex < values.length ? values[rockIndex] : 'unknown'
        };
        
        // Skip blocks with invalid dimensions or NaN values
        if (isNaN(block.centroid_x) || isNaN(block.dim_x)) {
          continue;
        }
        
        data.push(block);
      } catch (e) {
        // Skip problematic rows
      }
    }
    
    console.log('Successfully parsed blocks:', data.length);
    if (data.length > 0) {
      console.log('First block:', data[0]);
    }
    
    return data;
  }
  
  private computeCoordinateOffset(blocks: BlockData[]) {
    // Find min values for x, y, z to use as offset
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    
    blocks.forEach(block => {
      minX = Math.min(minX, block.centroid_x);
      minY = Math.min(minY, block.centroid_y);
      minZ = Math.min(minZ, block.centroid_z);
    });
    
    // Set the offset (we'll subtract this from all coordinates)
    this.coordinateOffset.set(minX, minY, minZ);
  }
  
private createBlockModel(blocks: BlockData[]) {
  console.log('Creating block model with', blocks.length, 'blocks');
  
  // Calculate model center after normalization
  let xSum = 0, ySum = 0, zSum = 0;
  blocks.forEach(block => {
    xSum += block.centroid_x - this.coordinateOffset.x;
    ySum += block.centroid_y - this.coordinateOffset.y;
    zSum += block.centroid_z - this.coordinateOffset.z;
  });
  
  this.modelCenter.set(
    xSum / blocks.length,
    zSum / blocks.length, // Map z (height) to y in Three.js
    ySum / blocks.length  // Map y to z in Three.js
  );
  
  console.log('Normalized model center:', this.modelCenter);
  
  // Group blocks by rock type
  const rockTypes = [...new Set(blocks.map(block => block.rock))];
  console.log('Rock types:', rockTypes);
  
  // Assign a color to each rock type
  const rockColors = new Map<string, THREE.Color>();
  rockTypes.forEach((rock, i) => {
    // Generate distinct colors
    const hue = i / rockTypes.length;
    rockColors.set(rock, new THREE.Color().setHSL(hue, 0.8, 0.6));
  });
  
  // Limit blocks to visualize for performance
  const maxBlocks = 5000;
  const visibleBlocks = blocks.length > maxBlocks ? blocks.slice(0, maxBlocks) : blocks;
  console.log(`Visualizing ${visibleBlocks.length} of ${blocks.length} blocks`);
  
  // Group by rock type for better organization
  const blocksByRock: Record<string, BlockData[]> = {};
  visibleBlocks.forEach(block => {
    if (!blocksByRock[block.rock]) {
      blocksByRock[block.rock] = [];
    }
    blocksByRock[block.rock].push(block);
  });
  
  // Create a group for the blocks
  const blockGroup = new THREE.Group();
  
  // Scale factors - make blocks smaller overall and exaggerate height
  const scaleFactor = 0.7; // Overall scale reduction
  const heightScaleFactor = 1.5; // Height exaggeration
  
  // Create blocks by rock type
  Object.entries(blocksByRock).forEach(([rockType, blocksOfType]) => {
    // Get color for this rock type
    const color = rockColors.get(rockType) || new THREE.Color(0xcccccc);
    const material = new THREE.MeshLambertMaterial({ color });
    
    console.log(`Creating ${blocksOfType.length} ${rockType} blocks`);
    
    // Create blocks
    blocksOfType.forEach(block => {
      const geometry = new THREE.BoxGeometry(
        block.dim_x * scaleFactor, 
        block.dim_z * scaleFactor * heightScaleFactor, // Z dimension maps to Y (height) in Three.js
        block.dim_y * scaleFactor  // Y dimension maps to Z in Three.js
      );
      
      const cube = new THREE.Mesh(geometry, material);
      
      // Position using normalized coordinates with proper mapping
      // x -> x, z -> y (height), y -> z
      cube.position.set(
        block.centroid_x - this.coordinateOffset.x,
        (block.centroid_z - this.coordinateOffset.z) * heightScaleFactor, // Z to Y with height exaggeration
        block.centroid_y - this.coordinateOffset.y
      );
      
      blockGroup.add(cube);
    });
  });
  
  // Add all blocks to scene
  this.scene.add(blockGroup);
  
  // Position camera to better view the model
  this.camera.position.set(
    this.modelCenter.x + 500,
    this.modelCenter.y + 500, // Look from above
    this.modelCenter.z + 500
  );
  this.controls.target.copy(this.modelCenter);
  
  console.log('Block model creation complete');
}
  
  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}