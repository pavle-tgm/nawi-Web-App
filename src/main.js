let countryData = {};
fetch('src/data.json')
  .then(response => response.json())
  .then(data => countryData = data);

document.querySelectorAll('#map path').forEach(path => {
  path.addEventListener('click', (e) => {
    const country = e.target.getAttribute('data-name');
    showCountryInfo(country);
  });
});

function showCountryInfo(name) {
  const infoBox = document.querySelector('.info span');
  const data = countryData[name];
  if (data) {
    infoBox.innerHTML = `${name}<br>
      <span style="font-size: 0.7em;">
      <strong>Hauptstadt:</strong> ${data.Hauptstadt}<br>
      <strong>Einwohner:</strong> ${data.Einwohner}<br>
      <strong>Sprache:</strong> ${data.Sprache}
      </span>`;
  } else {
    infoBox.innerHTML = `${name}<br><span style="font-size: 0.7em;">Keine Daten verfügbar.</span>`;
  }
}
