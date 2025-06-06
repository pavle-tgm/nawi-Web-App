import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.skypack.dev/lil-gui@0.17.0";
import axios from 'axios';

let countryData = {};
fetch("src/data.json")
    .then(res => res.json())
    .then(data => {
      countryData = data;
      calculateTotalCo2();
      populateCountryDropdown();

      // === Country Comparison Modal Logic ===
      // (moved from DOMContentLoaded to here)
      // Elements
      const compareBtn = document.getElementById("compare-btn");
      const compareModal = document.getElementById("compare-modal");
      const compareClose = document.getElementById("compare-close");
      const compareSubmit = document.getElementById("compare-submit");
      const country1Select = document.getElementById("country1-select");
      const country2Select = document.getElementById("country2-select");
      const compareResults = document.getElementById("compare-results");

      // Helper: Get all country names from countryData (sorted)
      function getAllCountryNames() {
        return Object.keys(countryData).sort((a, b) => a.localeCompare(b));
      }

      // Populate dropdowns
      function populateDropdowns() {
        const names = getAllCountryNames();
        country1Select.innerHTML = '<option value="">Land wählen...</option>';
        country2Select.innerHTML = '<option value="">Land wählen...</option>';
        names.forEach(name => {
          country1Select.innerHTML += `<option value="${name}">${name}</option>`;
          country2Select.innerHTML += `<option value="${name}">${name}</option>`;
        });
      }

      // Open modal
      compareBtn.addEventListener("click", () => {
        populateDropdowns();
        compareModal.style.display = "block";
        compareResults.innerHTML = '';
      });

      // Close modal
      compareClose.addEventListener("click", () => {
        compareModal.style.display = "none";
      });
      window.addEventListener("click", e => {
        if (e.target === compareModal) compareModal.style.display = "none";
      });

      // Compare and render
      function renderComparison() {
        const name1 = country1Select.value;
        const name2 = country2Select.value;
        if (!name1 || !name2 || name1 === name2) {
          compareResults.innerHTML = '<p style="text-align:center;color:#888;">Bitte zwei verschiedene Länder wählen.</p>';
          return;
        }
        const data1 = countryData[name1];
        const data2 = countryData[name2];
        if (!data1 || !data2) {
          compareResults.innerHTML = '<p style="text-align:center;color:#e74c3c;">Fehler beim Laden der Länderdaten.</p>';
          return;
        }
        // Helper to highlight better value
        function highlight(val1, val2, isLowerBetter = false, unit = "") {
          if (val1 === undefined || val1 === null || val1 === "N/A" || val1 === "Keine Daten verfügbar") return val1 || "-";
          if (val2 === undefined || val2 === null || val2 === "N/A" || val2 === "Keine Daten verfügbar") return val1 || "-";
          let n1 = parseFloat((val1 + "").replace(/[^\d\.-]/g, ""));
          let n2 = parseFloat((val2 + "").replace(/[^\d\.-]/g, ""));
          if (isNaN(n1) || isNaN(n2)) return val1;
          let better = isLowerBetter ? n1 < n2 : n1 > n2;
          return `<span style="font-weight:bold;color:${better ? '#27ae60' : '#2c3e50'}">${val1}${unit}</span>`;
        }
        // Build comparison table
        compareResults.innerHTML = `
        <div class="compare-table" style="display:flex;gap:2em;justify-content:center;align-items:flex-start;flex-wrap:wrap;">
          <div class="compare-col" style="min-width:200px;max-width:260px;">
            <h3 style="text-align:center;">${name1}</h3>
            <div><strong>Hauptstadt:</strong> ${data1.Hauptstadt || '-'}</div>
            <div><strong>Einwohner:</strong> ${data1.Einwohner || '-'}</div>
            <div><strong>Sprache:</strong> ${data1.Sprache || '-'}</div>
            <div><strong>CO₂-Emissionen:</strong> ${highlight(data1.CO2, data2.CO2, true, '')}</div>
            <div><strong>Erneuerbare Energie:</strong> ${highlight(data1.Renewable, data2.Renewable, false, '')}</div>
            <div><strong>Temperaturänderung:</strong> ${highlight(data1.Temperature, data2.Temperature, false, '')}</div>
          </div>
          <div class="compare-col" style="min-width:200px;max-width:260px;">
            <h3 style="text-align:center;">${name2}</h3>
            <div><strong>Hauptstadt:</strong> ${data2.Hauptstadt || '-'}</div>
            <div><strong>Einwohner:</strong> ${data2.Einwohner || '-'}</div>
            <div><strong>Sprache:</strong> ${data2.Sprache || '-'}</div>
            <div><strong>CO₂-Emissionen:</strong> ${highlight(data2.CO2, data1.CO2, true, '')}</div>
            <div><strong>Erneuerbare Energie:</strong> ${highlight(data2.Renewable, data1.Renewable, false, '')}</div>
            <div><strong>Temperaturänderung:</strong> ${highlight(data2.Temperature, data1.Temperature, false, '')}</div>
          </div>
        </div>
        <div style="margin-top:1em;text-align:center;font-size:0.95em;color:#888;">Grün = besserer Wert</div>
      `;
      }

      country1Select.addEventListener("change", renderComparison);
      country2Select.addEventListener("change", renderComparison);
    });

// Cache for climate data to avoid excessive API calls
const climateDataCache = {};

const containerEl = document.querySelector(".globe-wrapper");
const canvasEl = containerEl.querySelector("#globe-3d");
const svgMapDomEl = document.querySelector("#map");
const svgCountries = Array.from(svgMapDomEl.querySelectorAll("path"));
const svgCountryDomEl = document.querySelector("#country");
const infoBox = document.querySelector(".info");
const infoContent = infoBox.querySelector("span");
const popup = document.getElementById("country-info-popup");
const popupText = document.getElementById("popup-text");
const popupClose = document.getElementById("popup-close");

let hoveredCountryIdx = 6;
let isTouchScreen = false;
let isHoverable = true;

const svgViewBox = [2000, 1000];
const offsetY = -.1;

const textureLoader = new THREE.TextureLoader();
const bBoxes = [];
const dataUris = [];
let staticMapUri;

const params = {
  strokeColor: "#2a3f5f",
  defaultColor: "#3a6ea5",
  hoverColor: "#00e5ff",
  fogColor: "#0d1b2a",
  fogDistance: 2.65,
  strokeWidth: 2.5,
  hiResScalingFactor: 2,
  lowResScalingFactor: 0.7
};

let renderer, scene, camera, rayCaster, pointer, controls;
let globeGroup, globeColorMesh, globeStrokesMesh, globeSelectionOuterMesh;
let autoRotationEnabled = true;
let lastInteractionTime = Date.now();

// CO2 Emissions Calculator
const totalCo2Element = document.getElementById('total-co2');
const countrySelect = document.getElementById('country-select');
const countryContributionElement = document.getElementById('country-contribution');

initScene();
createControls();

window.addEventListener("resize", updateSize);

containerEl.addEventListener("touchstart", () => {
  isTouchScreen = true;
  lastInteractionTime = Date.now();
});
containerEl.addEventListener("mousemove", e => {
  updateMousePosition(e.clientX, e.clientY);
  lastInteractionTime = Date.now();
});
containerEl.addEventListener("click", async e => {
  updateMousePosition(e.clientX, e.clientY);
  lastInteractionTime = Date.now();
  const country = svgCountries[hoveredCountryIdx];
  if (country) {
    const name = country.getAttribute("data-name");
    await showCountryInfo(name);
  }
});
containerEl.addEventListener("wheel", () => {
  lastInteractionTime = Date.now();
});

popupClose.addEventListener("click", () => {
  popup.classList.remove("show");
});

function updateMousePosition(eX, eY) {
  pointer.x = (eX - containerEl.offsetLeft) / containerEl.offsetWidth * 2 - 1;
  pointer.y = -((eY - containerEl.offsetTop) / containerEl.offsetHeight) * 2 + 1;
}

function initScene() {
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: false, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new THREE.Color("#0d1b2a"), 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(params.fogColor, 0, params.fogDistance);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 3);
  camera.position.z = 1.3;

  globeGroup = new THREE.Group();
  scene.add(globeGroup);

  rayCaster = new THREE.Raycaster();
  rayCaster.far = 1.15;
  pointer = new THREE.Vector2(-1, -1);

  createOrbitControls();
  createGlobe();
  prepareHiResTextures();
  prepareLowResTextures();
  updateSize();

  gsap.ticker.add(render);
}

function createOrbitControls() {
  controls = new OrbitControls(camera, canvasEl);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = .46 * Math.PI;
  controls.maxPolarAngle = .46 * Math.PI;
  controls.zoomToCursor = true; // Make zoom focus on mouse cursor

  controls.addEventListener("start", () => {
    isHoverable = false;
    pointer = new THREE.Vector2(-1, -1);
    lastInteractionTime = Date.now();
    autoRotationEnabled = false;
    gsap.to(globeGroup.scale, { duration: .3, x: .9, y: .9, z: .9, ease: "power1.inOut" });
  });
  controls.addEventListener("end", () => {
    lastInteractionTime = Date.now();
    gsap.to(globeGroup.scale, {
      duration: .6,
      x: 1, y: 1, z: 1,
      ease: "back(1.7).out",
      onComplete: () => {
        isHoverable = true;
        autoRotationEnabled = true;
      }
    });
  });
}

function createGlobe() {
  const globeGeometry = new THREE.IcosahedronGeometry(1, 20);

  const globeColorMaterial = new THREE.MeshPhongMaterial({
    transparent: false,
    side: THREE.DoubleSide,
    shininess: 80,
    specular: new THREE.Color(0x555555)
  });

  const globeStrokeMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
    depthTest: false
  });

  const outerSelectionColorMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });

  globeColorMesh = new THREE.Mesh(globeGeometry, globeColorMaterial);
  globeStrokesMesh = new THREE.Mesh(globeGeometry, globeStrokeMaterial);
  globeSelectionOuterMesh = new THREE.Mesh(globeGeometry, outerSelectionColorMaterial);

  // Add ambient light for better visibility
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Add directional light for subtle highlights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  globeStrokesMesh.renderOrder = 2;

  globeGroup.add(globeStrokesMesh, globeSelectionOuterMesh, globeColorMesh);
}

function prepareHiResTextures() {
  svgCountries.forEach(path => {
    if (!path.getAttribute("data-name")) {
      path.setAttribute("data-name", path.getAttribute("title") || path.id || "Unknown");
    }
  });

  gsap.set(svgMapDomEl, {
    attr: {
      "viewBox": `0 ${offsetY * svgViewBox[1]} ${svgViewBox[0]} ${svgViewBox[1]}`,
      "stroke-width": params.strokeWidth,
      "stroke": params.strokeColor,
      "fill": params.defaultColor,
      "width": svgViewBox[0] * params.hiResScalingFactor,
      "height": svgViewBox[1] * params.hiResScalingFactor
    }
  });

  let svgData = new XMLSerializer().serializeToString(svgMapDomEl);
  staticMapUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  setMapTexture(globeColorMesh.material, staticMapUri);

  gsap.set(svgMapDomEl, {
    attr: {
      "fill": "none",
      "stroke": params.strokeColor
    }
  });

  svgData = new XMLSerializer().serializeToString(svgMapDomEl);
  staticMapUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  setMapTexture(globeStrokesMesh.material, staticMapUri);

  infoContent.innerHTML = svgCountries[hoveredCountryIdx].getAttribute("data-name");
}

function prepareLowResTextures() {
  gsap.set(svgCountryDomEl, {
    attr: {
      "viewBox": `0 ${offsetY * svgViewBox[1]} ${svgViewBox[0]} ${svgViewBox[1]}`,
      "stroke-width": params.strokeWidth,
      "stroke": params.strokeColor,
      "fill": params.hoverColor,
      "width": svgViewBox[0] * params.lowResScalingFactor,
      "height": svgViewBox[1] * params.lowResScalingFactor
    }
  });

  svgCountries.forEach((path, idx) => {
    bBoxes[idx] = path.getBBox();
  });

  svgCountries.forEach((path, idx) => {
    svgCountryDomEl.innerHTML = "";
    svgCountryDomEl.appendChild(svgCountries[idx].cloneNode(true));
    const svgData = new XMLSerializer().serializeToString(svgCountryDomEl);
    dataUris[idx] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
  });

  setMapTexture(globeSelectionOuterMesh.material, dataUris[hoveredCountryIdx]);
}

function setMapTexture(material, URI) {
  textureLoader.load(URI, texture => {
    texture.repeat.set(1, 1);
    material.map = texture;
    material.needsUpdate = true;
  });
}

function updateMap(uv = { x: 0, y: 0 }) {
  const pointObj = svgMapDomEl.createSVGPoint();
  pointObj.x = uv.x * svgViewBox[0];
  pointObj.y = (1 + offsetY - uv.y) * svgViewBox[1];

  for (let i = 0; i < svgCountries.length; i++) {
    const boundingBox = bBoxes[i];
    if (
        pointObj.x > boundingBox.x &&
        pointObj.x < boundingBox.x + boundingBox.width &&
        pointObj.y > boundingBox.y &&
        pointObj.y < boundingBox.y + boundingBox.height
    ) {
      if (svgCountries[i].isPointInFill(pointObj)) {
        if (i !== hoveredCountryIdx) {
          hoveredCountryIdx = i;
          setMapTexture(globeSelectionOuterMesh.material, dataUris[hoveredCountryIdx]);
          infoContent.innerHTML = svgCountries[hoveredCountryIdx].getAttribute("data-name");
          break;
        }
      }
    }
  }
}

function render() {
  controls.update();

  // Check if we should enable auto-rotation (after 3 seconds of inactivity)
  const idleTime = Date.now() - lastInteractionTime;
  if (autoRotationEnabled && idleTime > 3000) {
    // Apply a slow rotation to the globe
    globeGroup.rotation.y += 0.002;
  }

  if (isHoverable) {
    rayCaster.setFromCamera(pointer, camera);
    const intersects = rayCaster.intersectObject(globeStrokesMesh);
    if (intersects.length) {
      updateMap(intersects[0].uv);
    }
  }
  if (isTouchScreen && isHoverable) isHoverable = false;
  renderer.render(scene, camera);
}

function updateSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  containerEl.style.width = width + "px";
  containerEl.style.height = height + "px";
  renderer.setSize(width, height);
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -aspect;
  camera.right = aspect;
  camera.top = 1;
  camera.bottom = -1;
  camera.updateProjectionMatrix();

}


function createControls() {
  const gui = new GUI();
  gui.close();

  gui.addColor(params, "strokeColor").onChange(prepareHiResTextures).name("stroke");
  gui.addColor(params, "defaultColor").onChange(prepareHiResTextures).name("color");
  gui.addColor(params, "hoverColor").onChange(prepareLowResTextures).name("highlight");
  gui.addColor(params, "fogColor").onChange(() => {
    scene.fog = new THREE.Fog(params.fogColor, 0, params.fogDistance);
  }).name("fog");

  gui.add(params, "fogDistance", 1, 4).onChange(() => {
    scene.fog = new THREE.Fog(params.fogColor, 0, params.fogDistance);
  }).name("fog distance");
}

async function showCountryInfo(name) {
  // Show loading state
  popupText.innerHTML = `
    <h3>${name}</h3>
    <div class="loading-indicator">
      <p>Lade Klimadaten...</p>
    </div>
  `;
  popup.classList.add("show");

  let data = countryData[name];

  // If not found in data.json, fetch from REST Countries API for basic info only
  if (!data) {
    try {
      const response = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=true`);
      const country = response.data[0];
      data = {
        Hauptstadt: country.capital ? country.capital[0] : "N/A",
        Einwohner: country.population ? country.population.toLocaleString() : "N/A",
        Sprache: country.languages ? Object.values(country.languages).join(", ") : "N/A",
        CO2: "N/A",
        Renewable: "N/A",
        Temperature: "N/A"
      };
    } catch (error) {
      console.error("Error fetching country info from REST Countries API:", error);
      data = null;
    }
  }

  if (data) {
    // Format population with commas for better readability
    const formattedPopulation = data.Einwohner ? data.Einwohner.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "N/A";

    // Basic country info HTML
    let infoHTML = `
      <h3>${name}</h3>
      <div class="country-basic-info">
        <p><strong>Hauptstadt:</strong> ${data.Hauptstadt || "N/A"}</p>
        <p><strong>Einwohner:</strong> ${formattedPopulation}</p>
        <p><strong>Sprache:</strong> ${data.Sprache || "N/A"}</p>
        ${data.Währung ? `<p><strong>Währung:</strong> ${data.Währung}</p>` : ''}
        ${data.Fläche ? `<p><strong>Fläche:</strong> ${data.Fläche.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} km²</p>` : ''}
        ${data.Kontinent ? `<p><strong>Kontinent:</strong> ${data.Kontinent}</p>` : ''}
      </div>
    `;

    // Climate data section (from JSON only)
    let climateHTML = `
      <div class="climate-data-section">
        <h4>Klimawandel-Statistiken</h4>
        <div class="climate-data">
          <div class="climate-stat">
            <p><strong>CO₂-Emissionen:</strong> ${data.CO2 || "Keine Daten verfügbar"}</p>
          </div>
          <div class="climate-stat">
            <p><strong>Erneuerbare Energie:</strong> ${data.Renewable || "Keine Daten verfügbar"}</p>
          </div>
          <div class="climate-stat">
            <p><strong>Temperaturänderung:</strong> ${data.Temperature || "Keine Daten verfügbar"}</p>
          </div>
        </div>
      </div>
    `;

    // Combine all sections
    popupText.innerHTML = infoHTML + climateHTML;

  } else {
    popupText.innerHTML = `
      <h3>${name}</h3>
      <p>Keine detaillierten Daten verfügbar.</p>
      <p>Dieses Land ist in unserer Datenbank, aber wir haben noch keine ausführlichen Informationen dazu.</p>
    `;
  }
}

// Function to calculate total CO2 emissions
let worldTotalCO2 = 0;
function calculateTotalCo2() {
  let total = 0;
  Object.values(countryData).forEach(country => {
    if (country.CO2 && !isNaN(parseFloat(country.CO2.replace(/[^\d\.-]/g, "")))) {
      total += parseFloat(country.CO2.replace(/[^\d\.-]/g, ""));
    }
  });
  worldTotalCO2 = total;
  totalCo2Element.textContent = total.toFixed(2);
}

// Function to populate country dropdown
function populateCountryDropdown() {
  Object.keys(countryData).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    countrySelect.appendChild(option);
  });
}

// Function to update country contribution
function updateCountryContribution() {
  const selectedCountry = countrySelect.value;
  const country = countryData[selectedCountry];
  let contribution = 0;
  if (country && country.CO2 && !isNaN(parseFloat(country.CO2.replace(/[^\d\.-]/g, "")))) {
    contribution = parseFloat(country.CO2.replace(/[^\d\.-]/g, ""));
    countryContributionElement.textContent = contribution.toFixed(2);
  } else {
    countryContributionElement.textContent = '0';
  }
  // Add percentage display
  let percent = (worldTotalCO2 > 0 && contribution > 0) ? ((contribution / worldTotalCO2) * 100).toFixed(2) : '0.00';
  let percentElem = document.getElementById('country-percentage');
  if (!percentElem) {
    percentElem = document.createElement('div');
    percentElem.id = 'country-percentage';
    countryContributionElement.parentNode.appendChild(percentElem);
  }
  percentElem.textContent = `(${percent}% of world total)`;
}

// Event listener for country selection
countrySelect.addEventListener('change', updateCountryContribution);
