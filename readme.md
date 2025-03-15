# Mining Visualization Tool

A 3D visualization tool for mining block models using Three.js. This tool allows users to load and visualize mining block data in an interactive 3D environment.

![Mining Visualization Screenshot](./public/Screenshot%20From%202025-03-15%2021-18-42.png)

## Features

- 3D visualization of mining block models
- Color-coding of different rock types
- Interactive camera controls using ArcballControls
- Cross-section visualization with clipping planes
- Coordinate normalization for large UTM coordinates
- Height exaggeration for better visualization

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/mining-viz-ish.git
   cd mining-viz-ish
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm run dev
   ```

4. Build for production
   ```bash
   npm run build
   ```

## Usage

The application loads a CSV file containing block model data. The CSV should have the following columns:
- `centroid_x`, `centroid_y`, `centroid_z`: Block center coordinates
- `dim_x`, `dim_y`, `dim_z`: Block dimensions
- `rock`: Rock type identifier

### Controls

- **Camera**: Click and drag to rotate, scroll to zoom
- **Clipping Planes**: Use the control panel in the top-right to enable/disable and adjust clipping planes

## Project Structure

```
mining-viz-ish/
├── src/
│   ├── app.ts         # Main application class
│   ├── main.ts        # Entry point
│   └── style.css      # Global styles
├── public/
│   └── data/          # CSV data files
├── index.html
└── vite.config.js     # Vite configuration
```

## Contributing

We welcome contributions to improve this visualization tool! Here are some areas we're currently working on:

### Current Development Directions

1. **CSV File Upload Functionality** (@nii0708)
   - Add a button to load new CSV files
   - Implement file validation and error handling

2. **CSV Compression** (@nii0708)
   - Research and implement methods to compress large CSV files
   - Optimize data loading for large datasets

3. **Coordinate Reference System** (@fawwazanvilen)
   - Add coordinate indicators at the bottom of the visualization
   - Implement a wind rose/compass for orientation

4. **Enhanced Clipping Plane** (@fawwazanvilen)
   - Improve the clipping plane UI and functionality
   - Add more interactive controls for cross-section visualization

5. **Surface Toggle** (@nii0708)
   - Add ability to toggle surface visualization
   - Implement different rendering modes

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Contributors

- [@fawwazanvilen](https://github.com/fawwazanvilen)
- [@nii0708](https://github.com/nii0708)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Three.js](https://threejs.org/) for 3D rendering
- [Vite](https://vitejs.dev/) for the build system
