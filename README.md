# 🗺️ GeoLocator

A Chrome browser extension that automatically extracts and geocodes location mentions from web pages, displaying them on an interactive map or in a list view.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Chrome](https://img.shields.io/badge/chrome-extension-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **🔍 Automatic Location Detection** - Scans web pages for geographic locations (cities, countries, regions)
- **🗺️ Interactive Map** - Visualize locations on an OpenStreetMap-powered map with Leaflet.js
- **📍 Marker Clustering** - Intelligent clustering for better performance with many locations
- **📋 List View** - Toggle between map and detailed list views
- **📥 Country-Specific Data** - Download GeoNames data for specific countries for improved accuracy
- **📤 CSV Export** - Export discovered locations to CSV format
- **🆓 No API Key Required** - Uses free OpenStreetMap tiles (no Google Maps API key needed)
- **⚡ Fast & Offline** - Built-in database with 33,000+ major cities, expandable with country data

## 🎯 Use Cases

- **Research** - Quickly identify all locations mentioned in academic papers or articles
- **Travel Planning** - Extract destinations from travel blogs and guides
- **News Analysis** - Map out locations mentioned in news articles
- **Content Creation** - Gather geographic references from source material
- **Data Analysis** - Export location data for further processing

## 📦 Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/geolocator.git
   cd geolocator
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `geolocator` directory

3. **Done!** Click the GeoLocator icon in your extensions toolbar to open the sidepanel

## 🚀 Usage

### Basic Workflow

1. **Navigate to any web page** with location mentions (e.g., Wikipedia, news articles, travel blogs)
2. **Click the GeoLocator extension icon** to open the sidepanel
3. **Click "Scan Current Page"** to extract locations
4. **Review detected countries** and select which ones to download detailed data for
5. **Click "Download & Scan"** to get more accurate results with country-specific data
6. **View results** in list or map view
7. **Export to CSV** if needed

### Map View

- **Toggle to map view** by clicking the 🗺️ Map button
- **Zoom in/out** to see markers cluster and uncluster automatically
- **Click markers** to see location details (name, country, coordinates, population)
- **Pan around** to explore the geographic distribution

### List View

- Shows all detected locations with details
- Country, coordinates, and population (if available)
- Export to CSV for further analysis

## 🏗️ Architecture

### Components

- **Background Service Worker** (`background/background.js`)
  - Manages IndexedDB database
  - Handles GeoNames data downloads
  - Performs geocoding and location matching

- **Sidepanel UI** (`sidepanel/`)
  - Main user interface
  - List/Map view toggle
  - Country selection and download management

- **Map Visualization** (`map/`)
  - Leaflet.js-based interactive map
  - Marker clustering with leaflet.markercluster
  - PostMessage communication with sidepanel

- **Geocoding Engine** (`geocoder/`)
  - Text extraction and location detection
  - Fuzzy matching algorithms
  - Country-specific data integration

### Data Sources

- **GeoNames** - Free geographic database (cities15000.txt for major cities)
- **OpenStreetMap** - Free map tiles via Leaflet.js
- **Country Data** - Downloaded on-demand from GeoNames (http://download.geonames.org/)

## 🛠️ Technical Details

### Built With

- **Manifest V3** - Latest Chrome extension standard
- **Leaflet.js** - Open-source mapping library (bundled locally)
- **IndexedDB** - Client-side database for location data
- **OpenStreetMap** - Free map tiles
- **GeoNames** - Geographic name database

### Permissions

- `storage` - Save downloaded country data and settings
- `sidePanel` - Display UI in Chrome's sidepanel
- `activeTab` - Access current tab content for scanning
- `scripting` - Inject content scripts to extract page text
- `tabs` - Detect active tab URL

### File Structure

```
geolocator/
├── background/           # Service worker
│   └── background.js
├── content/             # Content script
│   └── content.js
├── data/                # Bundled location data
│   └── cities15000.json
├── geocoder/            # Geocoding engine
│   ├── geocoder.js
│   └── textExtractor.js
├── lib/                 # Third-party libraries (bundled)
│   ├── leaflet/         # Leaflet.js
│   └── leaflet.markercluster/
├── map/                 # Map visualization
│   ├── map.html
│   ├── map.js
│   └── images/          # Marker icons
├── sidepanel/           # Main UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── utils/               # Shared utilities
│   ├── constants.js
│   ├── database.js
│   ├── downloader.js
│   └── message.js
├── assets/              # Icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── manifest.json        # Extension manifest
```

## 🔧 Development

### Setup

1. Clone the repository
2. Make your changes
3. Reload the extension in `chrome://extensions/`
4. Test thoroughly

### Key Files to Modify

- **UI Changes**: `sidepanel/sidepanel.html`, `sidepanel/sidepanel.css`
- **Geocoding Logic**: `geocoder/geocoder.js`
- **Map Features**: `map/map.js`
- **Data Processing**: `background/background.js`

## 🐛 Known Issues

- Very large pages (100,000+ words) may be slow to process
- Some ambiguous location names may be incorrectly geocoded
- Country detection requires exact country name matches

## 🔮 Future Enhancements

- [ ] Support for custom location databases
- [ ] Batch processing of multiple tabs
- [ ] More export formats (GeoJSON, KML)
- [ ] Location filtering by country/region
- [ ] Improved fuzzy matching for misspellings
- [ ] Support for historical place names
- [ ] Heatmap visualization mode

## 📄 License

MIT License

Copyright (c) 2024 GeoLocator

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 🙏 Acknowledgments

- **GeoNames** - Free geographic database (http://www.geonames.org/)
- **Leaflet.js** - Open-source mapping library
- **OpenStreetMap** - Free map tiles and data
- **leaflet.markercluster** - Marker clustering plugin

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Note**: This extension uses the GeoNames database under the Creative Commons Attribution 4.0 License. Please comply with their usage terms: http://www.geonames.org/export/
