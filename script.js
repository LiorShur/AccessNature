let map;
let path = [];
let markers = [];
let tracking = false;
let watchId;

const notes = [];

function initMap(position) {
  const { latitude, longitude } = position.coords;

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: latitude, lng: longitude },
    zoom: 15,
  });

  const startMarker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: map,
    title: "Start",
  });

  path.push({ lat: latitude, lng: longitude });

  startTracking();
}
function startTracking() {
  if (navigator.geolocation) {
    tracking = true;
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latLng = { lat: latitude, lng: longitude };

        path.push(latLng);

        new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: "#FF0000",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: map,
        });

        map.setCenter(latLng);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  }
}

function stopTracking() {
  tracking = false;
  navigator.geolocation.clearWatch(watchId);
}
function addTextNote() {
  const text = prompt("Enter your note:");
  if (!text) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    notes.push({ type: "text", content: text, lat: latitude, lng: longitude });
    addMarker(latitude, longitude, "📝 " + text);
  });
}

function addMarker(lat, lng, label) {
  const marker = new google.maps.Marker({
    position: { lat, lng },
    map: map,
    label: label[0],
    title: label,
  });
  markers.push(marker);
}
function addPhoto() {
  const photoInput = document.getElementById("photoInput");
  photoInput.click();

  photoInput.onchange = () => {
    const file = photoInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        notes.push({ type: "photo", content: e.target.result, lat: latitude, lng: longitude });
        addMarker(latitude, longitude, "📷 Photo");
      });
    };

    reader.readAsDataURL(file);
  };
}
function addAudio() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);

      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        notes.push({ type: "audio", content: url, lat: latitude, lng: longitude });
        addMarker(latitude, longitude, "🎤 Audio Note");
      });
    };

    recorder.start();
    setTimeout(() => recorder.stop(), 5000); // record for 5 seconds
  });
}
function saveRoute() {
  const routeData = {
    path,
    notes,
    date: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(routeData)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "route.json";
  a.click();
}
