import axios from 'axios';

// Constants
const API_BASE_URL = 'https://restcountries.com/v3.1';
const MAP_SVG_PATH = '/world-map.svg';

// DOM Elements
const mapContainer = document.getElementById('map-container');
const countryInfo = document.getElementById('country-info');
const countryDetails = document.getElementById('country-details');
const closeInfoButton = document.getElementById('close-info');

// State
let selectedCountry = null;
let mapSvg = null;

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Load the SVG map
    await loadMap();
    
    // Add event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Error initializing app:', error);
    mapContainer.innerHTML = `
      <div class="error-message">
        <p>Failed to load the world map. Please try again later.</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Load the SVG map into the map container
 */
async function loadMap() {
  try {
    const response = await fetch(MAP_SVG_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.status} ${response.statusText}`);
    }
    
    const svgText = await response.text();
    mapContainer.innerHTML = svgText;
    
    // Get the SVG element
    mapSvg = mapContainer.querySelector('svg');
    
    // Make the SVG responsive
    mapSvg.setAttribute('width', '100%');
    mapSvg.setAttribute('height', '100%');
    
    // Add event listeners to countries
    const countries = mapSvg.querySelectorAll('.country');
    countries.forEach(country => {
      country.addEventListener('click', () => handleCountryClick(country));
    });
  } catch (error) {
    throw new Error(`Error loading map: ${error.message}`);
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Close country info panel
  closeInfoButton.addEventListener('click', () => {
    countryInfo.classList.remove('active');
    
    // Remove selected state from country
    if (selectedCountry) {
      selectedCountry.classList.remove('selected');
      selectedCountry = null;
    }
    
    // Remove overlay on mobile
    const overlay = document.querySelector('.overlay');
    if (overlay) {
      overlay.remove();
    }
  });
}

/**
 * Handle country click event
 * @param {SVGElement} countryElement - The clicked country SVG element
 */
async function handleCountryClick(countryElement) {
  try {
    // Get country code from the element ID
    const countryCode = countryElement.id;
    
    // Update selected country
    if (selectedCountry) {
      selectedCountry.classList.remove('selected');
    }
    countryElement.classList.add('selected');
    selectedCountry = countryElement;
    
    // Show loading state
    countryDetails.innerHTML = '<div class="loading"></div>';
    countryInfo.classList.add('active');
    
    // Add overlay on mobile
    if (window.innerWidth < 768) {
      const overlay = document.createElement('div');
      overlay.classList.add('overlay');
      document.body.appendChild(overlay);
      
      overlay.addEventListener('click', () => {
        closeInfoButton.click();
      });
    }
    
    // Fetch country data
    const countryData = await fetchCountryData(countryCode);
    
    // Display country data
    displayCountryInfo(countryData);
  } catch (error) {
    console.error('Error handling country click:', error);
    countryDetails.innerHTML = `
      <div class="error-message">
        <p>Failed to load country information. Please try again later.</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Fetch country data from the REST Countries API
 * @param {string} countryCode - The ISO country code
 * @returns {Object} - Country data
 */
async function fetchCountryData(countryCode) {
  try {
    const response = await axios.get(`${API_BASE_URL}/alpha/${countryCode}`);
    return response.data[0];
  } catch (error) {
    throw new Error(`Failed to fetch country data: ${error.message}`);
  }
}

/**
 * Display country information in the info panel
 * @param {Object} country - Country data from the API
 */
function displayCountryInfo(country) {
  // Extract data from the country object
  const name = country.name.common;
  const officialName = country.name.official;
  const capital = country.capital?.[0] || 'N/A';
  const region = country.region;
  const subregion = country.subregion || 'N/A';
  const population = country.population.toLocaleString();
  const languages = country.languages ? Object.values(country.languages).join(', ') : 'N/A';
  const currencies = country.currencies ? 
    Object.values(country.currencies).map(c => `${c.name} (${c.symbol})`).join(', ') : 
    'N/A';
  const flagUrl = country.flags.svg;
  
  // Create HTML for country details
  const html = `
    <img src="${flagUrl}" alt="${name} flag" class="country-flag">
    <h3>${name}</h3>
    <dl class="country-data">
      <dt>Official Name</dt>
      <dd>${officialName}</dd>
      
      <dt>Capital</dt>
      <dd>${capital}</dd>
      
      <dt>Region</dt>
      <dd>${region}${subregion !== 'N/A' ? ` (${subregion})` : ''}</dd>
      
      <dt>Population</dt>
      <dd>${population}</dd>
      
      <dt>Languages</dt>
      <dd>${languages}</dd>
      
      <dt>Currencies</dt>
      <dd>${currencies}</dd>
    </dl>
  `;
  
  // Update the country details container
  countryDetails.innerHTML = html;
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);