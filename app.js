window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const base64Data = params.get("data");
  if (base64Data) {
    try {
      const json = atob(base64Data);
      routeData = JSON.parse(json);
      alert("Shared route loaded!");
    } catch (e) {
      console.error("Invalid share data.");
    }
  }
};

let startTime = null;
let timerInterval = null;
let totalDistance = 0;
let lastCoords = null;
let map;
let path = [];
let marker;
let watchId;
let routeData = [];

window.initMap = function () {
  const dummyLatLng = { lat: 0, lng: 0 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: dummyLatLng
  });

  marker = new google.maps.Marker({
    position: dummyLatLng,
    map,
    title: "Waiting for GPS..."
  });
};

function updateMap(lat, lng) {
  const latLng = { lat, lng };
  path.push(latLng);
  marker.setPosition(latLng);
  map.panTo(latLng);

  new google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: "#00FF00",
    strokeOpacity: 1.0,
    strokeWeight: 2,
    map
  });

  routeData.push({
    type: "location",
    timestamp: Date.now(),
    coords: latLng
  });
}

function startTracking() {
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude } = position.coords;
        const latLng = { lat: latitude, lng: longitude };

        marker.setPosition(latLng);
        map.panTo(latLng);

        path.push(latLng);
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#00FF00",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map
        });

        routeData.push({
          type: "location",
          timestamp: Date.now(),
          coords: latLng
        });
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } else {
    alert("Geolocation not supported");
  }
}

function stopTracking() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
}
function addTextNote() {
  const note = prompt("Enter your note:");
  if (note) {
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      routeData.push({
        type: "text",
        timestamp: Date.now(),
        coords: { lat: latitude, lng: longitude },
        content: note
      });
      alert("Note added at your location.");
    });
  }
}
document.getElementById("photoInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function () {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        routeData.push({
          type: "photo",
          timestamp: Date.now(),
          coords: { lat: latitude, lng: longitude },
          content: reader.result // Base64 image
        });
        alert("Photo saved at current location.");
      });
    };
    reader.readAsDataURL(file);
  }
});

function capturePhoto() {
  document.getElementById("photoInput").click();
}
let mediaRecorder;
let audioChunks = [];

function startAudioRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            routeData.push({
              type: "audio",
              timestamp: Date.now(),
              coords: { lat: latitude, lng: longitude },
              content: reader.result // Base64 audio
            });
            alert("Audio note saved at location.");
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();

      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000); // Record for 5 seconds (can be changed)
    })
    .catch(err => alert("Microphone access denied."));
}
function exportData() {
  const fileName = `route-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function showRouteDataOnMap() {
  routeData.forEach(entry => {
    const { coords, type, content } = entry;
    let infoContent = "";

    if (type === "text") {
      infoContent = `<p>${content}</p>`;
    } else if (type === "photo") {
      infoContent = `<img src="${content}" alt="Photo" style="width:150px"/>`;
    } else if (type === "audio") {
      infoContent = `<audio controls src="${content}"></audio>`;
    } else {
      return; // skip location-only
    }

    const marker = new google.maps.Marker({
      position: coords,
      map: map,
      icon: {
        url: type === "photo" ? "📸" :
             type === "audio" ? "🎙️" :
             "📝",
        scaledSize: new google.maps.Size(32, 32)
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: infoContent
    });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });
  });
}
function exportGPX() {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NatureTracker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Nature Route</name>
    <trkseg>
`;

  routeData
    .filter(entry => entry.type === "location")
    .forEach(entry => {
      gpx += `      <trkpt lat="${entry.coords.lat}" lon="${entry.coords.lng}">
        <time>${new Date(entry.timestamp).toISOString()}</time>
      </trkpt>\n`;
    });

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `route-${Date.now()}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Nature Tracker Route Summary", 10, 10);

  let y = 20;
  for (let entry of routeData) {
    if (y > 270) {
      doc.addPage();
      y = 10;
    }

    doc.setFontSize(12);
    doc.text(`Type: ${entry.type}`, 10, y); y += 6;
    doc.text(`Time: ${new Date(entry.timestamp).toLocaleString()}`, 10, y); y += 6;
    doc.text(`Lat: ${entry.coords.lat.toFixed(5)}, Lng: ${entry.coords.lng.toFixed(5)}`, 10, y); y += 6;

    if (entry.type === "text") {
      doc.text(`Note: ${entry.content}`, 10, y); y += 10;
    }
    else if (entry.type === "photo") {
      // Image embedding
      try {
        const img = entry.content;
        doc.addImage(img, "JPEG", 10, y, 50, 50);
        y += 60;
      } catch (e) {
        doc.text("Photo (couldn't embed)", 10, y); y += 10;
      }
    }
    else if (entry.type === "audio") {
      doc.text(`Audio note recorded (not embeddable in PDF)`, 10, y); y += 10;
    }
  }

  doc.save(`route-${Date.now()}.pdf`);
}
function generateShareableLink() {
  const json = JSON.stringify(routeData);
  const base64 = btoa(json);
  const url = `${location.origin}${location.pathname}?data=${encodeURIComponent(base64)}`;

  navigator.clipboard.writeText(url).then(() => {
    alert("Shareable link copied to clipboard!");
  });
}
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay(); // final update
}

function updateTimerDisplay() {
  const now = Date.now();
  const elapsed = now - startTime;
  const hrs = Math.floor(elapsed / (1000 * 60 * 60));
  const mins = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((elapsed % (1000 * 60)) / 1000);

  document.getElementById("timer").textContent =
    `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function pad(num) {
  return num.toString().padStart(2, '0');
}
function haversineDistance(coord1, coord2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
