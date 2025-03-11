import { MiningVizApp } from './app';

// Create container
const container = document.createElement('div');
container.style.width = '100vw';
container.style.height = '100vh';
container.style.margin = '0';
container.style.overflow = 'hidden';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(container);

// Initialize app
const app = new MiningVizApp(container);

// Load data - adjust path to your actual file location
app.loadData('/data/BM_PL_250224_mod_250228.csv');

console.log('Main initialization complete');