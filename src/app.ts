import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { MapControls } from 'three/addons/controls/MapControls.js';
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';
// import { distance, instance } from 'three/tsl';

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
  private controls: THREE.EventDispatcher; // more generic type to handle different type of controls
  private modelCenter = new THREE.Vector3();
  private coordinateOffset = new THREE.Vector3(); // to handle large coordinates

  // for clipping plane
  private clipPlanes = {
    xy: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),  // Normal along Z axis
    yz: new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),  // Normal along X axis
    xz: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)   // Normal along Y axis
  };
  private clipPlaneHelpers: {[key: string]: THREE.PlaneHelper} = {};
  private activeClipPlane: string | null = null;
  private clipPosition = 0;

  // constructor method
  constructor(container: HTMLElement) {
    console.log('Initializing app');
    
    // background color
    this.scene.background = new THREE.Color(0x333333);
    
    // setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.localClippingEnabled = false; // will be enabled when toggled on
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
    this.controls = new ArcballControls(this.camera, this.renderer.domElement, this.scene);
    (this.controls as ArcballControls).setGizmosVisible(false); // Make gizmos visible
    (this.controls as ArcballControls).setTbRadius(0.5); // Set appropriate radius

    // setup clipping plane
    this.setupClippingControls(container);

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
          // in UTM, particularly 52N in the example data's case
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
    const heightScaleFactor = 2; // Height exaggeration
    
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
    
    console.log('Block model creation complete');
  }

  // for clipping/cross-section plane
  private setupClippingControls(container: HTMLElement) {
    const panel = document.createElement('div');
    panel.className = 'clip-controls';
    panel.style.position = 'absolute';
    panel.style.top = '20px';
    panel.style.right = '20px';
    panel.style.backgroundColor = 'rgba(0,0,0,0.7)';
    panel.style.padding = '15px';
    panel.style.borderRadius = '5px';
    panel.style.zIndex = '1000';
    panel.style.color = 'white';

    // create radio buttons for each plane
    const planeLabels = {
      'xy': 'XY Plane (cut along Z)',
      'yz': 'YZ Plane (cut along X)',
      'xz': 'XZ Plane (cut along Y)'
    };

    Object.entries(planeLabels).forEach(([plane, label]) => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'clipPlane';
      radio.value = plane;
      radio.id = `plane-${plane}`;
      radio.onclick = () => this.setActiveClipPlane(plane);
  
      const labelElement = document.createElement('label');
      labelElement.htmlFor = `plane-${plane}`;
      labelElement.textContent = label;
  
      panel.appendChild(radio);
      panel.appendChild(labelElement);
      panel.appendChild(document.createElement('br'));
    });

    // add a 'disable' option
    const disableRadio = document.createElement('input');
    disableRadio.type = 'radio';
    disableRadio.name = 'clipPlane';
    disableRadio.value = 'none';
    disableRadio.id = 'plane-none';
    disableRadio.checked = true;
    disableRadio.onclick = () => this.disableClipping();

    const disableLabel = document.createElement('label');
    disableLabel.htmlFor = 'plane-none';
    disableLabel.textContent = 'No Clipping';

    panel.appendChild(disableRadio);
    panel.appendChild(disableLabel);
    panel.appendChild(document.createElement('br'));
    panel.appendChild(document.createElement('br'));

    // Position slider
    const positionSlider = document.createElement('input');
    positionSlider.type = 'range';
    positionSlider.min = '-2000';
    positionSlider.max = '2000';
    positionSlider.value = '0';
    positionSlider.id = 'clip-position';
    positionSlider.oninput = (e) => {
      this.clipPosition = parseFloat((e.target as HTMLInputElement).value);
      this.updateClipPlane();
    };

    const sliderLabel = document.createElement('label');
    sliderLabel.htmlFor = 'clip-position';
    sliderLabel.textContent = 'Clip Position: ';

    panel.appendChild(sliderLabel);
    panel.appendChild(positionSlider);

    container.appendChild(panel);
  }

  // set active clip plane
  private setActiveClipPlane(plane: string) {
    // Disable current clipping
    this.disableClipping();

    // Set new active plane
    this.activeClipPlane = plane;

    // Create helper if it doesn't exist
    if (!this.clipPlaneHelpers[plane]) {
      this.clipPlaneHelpers[plane] = new THREE.PlaneHelper(
        this.clipPlanes[plane as keyof typeof this.clipPlanes], 
        1000, 
        0xff0000
      );
      this.scene.add(this.clipPlaneHelpers[plane]);
    }
  
    // Enable clipping on all materials
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material.clippingPlanes = [this.clipPlanes[plane as keyof typeof this.clipPlanes]];
        node.material.clipIntersection = false;
        node.material.needsUpdate = true;
      }
    });

    // Update plane position
    this.updateClipPlane();
    
    // Enable clipping in renderer
    this.renderer.localClippingEnabled = true;
  }

  // disable clipping
  private disableClipping() {
    // Hide all helpers
    Object.values(this.clipPlaneHelpers).forEach(helper => {
      helper.visible = false;
    });
    
    // Remove clipping planes from materials
    this.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.material.clippingPlanes = [];
        node.material.needsUpdate = true;
      }
    });
    
    this.activeClipPlane = null;
    this.renderer.localClippingEnabled = false;
  }

  private updateClipPlane() {
    if (!this.activeClipPlane) return;
    
    const plane = this.clipPlanes[this.activeClipPlane as keyof typeof this.clipPlanes];
    
    // Update plane constant (position)
    plane.constant = -this.clipPosition;
    
    // Show helper
    const helper = this.clipPlaneHelpers[this.activeClipPlane];
    if (helper) {
      helper.visible = true;
      helper.updateMatrixWorld();
    }
  }
  
  
  private animate = () => {
    requestAnimationFrame(this.animate);
    // this.controls.update(); // not needed for ArcballControls
    (this.controls as ArcballControls).update();

    // update clip plane if camera movese
    if (this.activeClipPlane) {
      this.updateClipPlane();
    }

    this.renderer.render(this.scene, this.camera);
  }
}