window.onload = function () {
window.addEventListener("load", function () {
  const videoInput = document.getElementById("videoInput");

  if (videoInput) {
    videoInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function () {
        navigator.geolocation.getCurrentPosition(position => {
          const { latitude, longitude } = position.coords;

          routeData.push({
            type: "video",
            timestamp: Date.now(),
            coords: { lat: latitude, lng: longitude },
            content: reader.result
          });

          alert("🎥 Video saved at your location.");
        });
      };

      reader.readAsDataURL(file);
    });
  }
});

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
  loadSavedSessions();
};

let elapsedTime = 0;
let isPaused = false;
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
  // Default fallback location (e.g. center of the US)
  const fallbackLatLng = { lat: 39.8283, lng: -98.5795 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: fallbackLatLng
  });

  marker = new google.maps.Marker({
    position: fallbackLatLng,
    map,
    title: "Your Location"
  });

  // Try to get user's actual location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        map.setCenter(userLatLng);
        marker.setPosition(userLatLng);
      },
      error => {
        console.warn("Geolocation failed, using fallback:", error);
      }
    );
  } else {
    console.warn("Geolocation not supported, using fallback location.");
  }
};


// window.initMap = function (callback = null) {
//   const dummyLatLng = path.length > 0 ? path[0] : { lat: 0, lng: 0 };

//   map = new google.maps.Map(document.getElementById("map"), {
//     zoom: 15,
//     center: dummyLatLng
//   });

//   marker = new google.maps.Marker({
//     position: dummyLatLng,
//     map,
//     title: "Starting Point"
//   });

//   // Callback once map is ready
//   if (callback) callback();
// };


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

window.startTracking = function () {
  console.log("Start tracking clicked");
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        console.log("Got position:", position);
        const { latitude, longitude } = position.coords;

        if (!isPaused) {
          const latLng = { lat: latitude, lng: longitude };

          // Update distance
          if (lastCoords) {
            const dist = haversineDistance(lastCoords, latLng);
            totalDistance += dist;
            document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
          }

          lastCoords = latLng;

          // Update path & map
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
      },
      err => {
        console.error("GPS error:", err);
        alert("Location access failed. Please enable GPS.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } else {
    alert("Geolocation not supported");
  }

  startTimer();
}
function stopTracking() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  stopTimer();   // stop timer
  showSummary(); // show stats after ending
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

window.captureVideo = function () {
  const input = document.getElementById("videoInput");
  if (!input) {
    console.error("Video input element not found!");
    return;
  }
  input.value = "";
  input.click();
};

window.addEventListener("load", function () {
  const videoInput = document.getElementById("videoInput");

  if (videoInput) {
    videoInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function () {
          // Get current location and store with video
          navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;

            routeData.push({
              type: "video",
              timestamp: Date.now(),
              coords: { lat: latitude, lng: longitude },
              content: reader.result
            });

            alert("🎥 Video saved at current location.");
          });
        };

        reader.readAsDataURL(file); // Convert to base64
      }
    });
  } else {
    console.warn("Video input not found at load.");
  }
});

// function captureVideo() {
//   document.getElementById("videoInput").addEventListener("change", function (e) {
//   const file = e.target.files[0];
//   if (file) {
//     const reader = new FileReader();
//     reader.onload = function () {
//       navigator.geolocation.getCurrentPosition(position => {
//         const { latitude, longitude } = position.coords;
//         routeData.push({
//           type: "video",
//           timestamp: Date.now(),
//           coords: { lat: latitude, lng: longitude },
//           content: reader.result // Base64 video
//         });
//         alert("Video saved at your location.");
//       });
//     };
//     reader.readAsDataURL(file);
//   }
// });

// }

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

function showMediaFullScreen(content, type) {
  // Create the full-screen overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "1000";

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.padding = "10px 20px";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.backgroundColor = "#f44336";
  closeBtn.style.color = "#fff";
  closeBtn.style.border = "none";
  closeBtn.style.cursor = "pointer";
  
  closeBtn.onclick = function() {
    document.body.removeChild(overlay); // Close the full screen
  };
  
  // Add close button
  overlay.appendChild(closeBtn);

  // Create media content
  if (type === "photo") {
    const img = document.createElement("img");
    img.src = content; // Base64 or image URL
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.objectFit = "contain";
    overlay.appendChild(img);
  } else if (type === "video") {
    const video = document.createElement("video");
    video.src = content; // Base64 or video URL
    video.controls = true;
    video.style.maxWidth = "90%";
    video.style.maxHeight = "90%";
    video.style.objectFit = "contain";
    overlay.appendChild(video);
  }

  // Append overlay to body
  document.body.appendChild(overlay);
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
      // Add full-screen option for photos and videos
      if (type === "photo" || type === "video") {
        showMediaFullScreen(content, type);
      }
    });
  });
}


//function showRouteDataOnMap() {


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
  elapsedTime = 0;
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const now = Date.now();
  elapsedTime = now - startTime;

  const hrs = Math.floor(elapsedTime / (1000 * 60 * 60));
  const mins = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((elapsedTime % (1000 * 60)) / 1000);

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
function togglePause() {
  isPaused = !isPaused;

  const btn = document.getElementById("pauseButtonLabel");
  btn.textContent = isPaused ? "Resume" : "Pause";

  if (isPaused) {
    clearInterval(timerInterval); // ⛔ Pause timer
  } else {
    // Resume timer by updating base startTime
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);

    // Update last GPS to avoid distance spike
    navigator.geolocation.getCurrentPosition(pos => {
      lastCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
    });
  }
}

function resetSession() {
  // Reset tracking data
  totalDistance = 0;
  lastCoords = null;
  routeData = [];
  path = [];
  isPaused = false;

  // Reset timer values
  startTime = null;
  elapsedTime = 0;
  clearInterval(timerInterval);
  timerInterval = null;

  // Update UI
  document.getElementById("timer").textContent = "00:00:00";
  document.getElementById("distance").textContent = "0.00 km";

  const pauseBtn = document.getElementById("pauseButtonLabel");
  if (pauseBtn) pauseBtn.textContent = "Pause";
}

function saveSession() {
  const name = prompt("Name this route:");
  if (!name) return;

  const session = {
    name,
    date: new Date().toISOString(),
    time: document.getElementById("timer").textContent,
    distance: totalDistance.toFixed(2),
    data: routeData
  };

  const saved = JSON.parse(localStorage.getItem("sessions") || "[]");
  saved.push(session);
  localStorage.setItem("sessions", JSON.stringify(saved));

  alert("Session saved!");
  closeSummary();
  loadSavedSessions();

  // ✅ FULL RESET
  resetSession();
}


function showSummary() {
  stopTimer();

  document.getElementById("summaryScreen").style.display = "block";

  document.getElementById("summaryTime").textContent = document.getElementById("timer").textContent;
  document.getElementById("summaryDistance").textContent = totalDistance.toFixed(2);

  document.getElementById("summaryTextCount").textContent = routeData.filter(e => e.type === "text").length;
  document.getElementById("summaryPhotoCount").textContent = routeData.filter(e => e.type === "photo").length;
  document.getElementById("summaryAudioCount").textContent = routeData.filter(e => e.type === "audio").length;
}

function closeSummary() {
  document.getElementById("summaryScreen").style.display = "none";
}

function loadSavedSessions() {
  const list = document.getElementById("savedSessionsList");
  list.innerHTML = "";

  const saved = JSON.parse(localStorage.getItem("sessions") || "[]");
  saved.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong> (${session.date.split("T")[0]})
      - ${session.distance} km
      <button onclick="loadSession(${index})">View</button>
    `;
    list.appendChild(li);
  });
}
function loadSession(index) {
  const saved = JSON.parse(localStorage.getItem("sessions") || "[]");
  const session = saved[index];

  routeData = session.data;
  totalDistance = parseFloat(session.distance);
  document.getElementById("timer").textContent = session.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";

  path = [];
  routeData.forEach(entry => {
    if (entry.type === "location") path.push(entry.coords);
  });

  // Now load map and wait to show data
  initMap(() => {
    renderSavedPath();
    showRouteDataOnMap();
  });
}
function renderSavedPath() {
  if (path.length > 0) {
    new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#00FF00",
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map
    });

    map.setCenter(path[0]); // Center on start
    marker.setPosition(path[0]);
  }
}

