
let allPenguins = [];
let massChartInstance = null;
let barChartInstance = null;
let pieChartInstance = null;

async function loadPenguins() {
  const sortBy = document.getElementById("sortSelect").value;
  const res = await fetch(`https://penguinanalytics.onrender.com/penguins/?sort_by=${sortBy}`);
  const data = await res.json();
  allPenguins = data;
  renderPenguinTable(data);
  document.getElementById("noResultMsg").textContent = '';
}

function renderPenguinTable(penguins, prepend = null) {
  const tbody = document.querySelector("#penguinTable tbody");
  tbody.innerHTML = "";

  if (prepend) {
    const row = document.createElement("tr");
    row.innerHTML = formatPenguinRow(prepend);
    row.classList.add("search-highlight");
    tbody.appendChild(row);
  }

  penguins.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = formatPenguinRow(p);
    tbody.appendChild(row);
  });
}

function formatPenguinRow(p) {
  return `
    <td>${p.id}</td><td>${p.name}</td><td>${p.status}</td>
    <td>${p.mass}</td><td>${p.danger_flag ? '⚠️' : '✅'}</td>
    <td>${p.last_seen}</td>
    <td>
      <button onclick="viewPenguin(${p.id})">View</button>
      <button onclick="deletePenguin(${p.id})">Delete</button>
    </td>
  `;
}

async function viewPenguin(id) {
  const penguin = allPenguins.find(p => p.id === id);
  if (!penguin) return;

  document.getElementById("greenName").textContent = penguin.name;
  document.getElementById("greenStage").textContent = penguin.status;
  document.getElementById("penguinImage").src = penguin.latest_image || "fallback.jpg";


  const ctx = document.getElementById("massChart").getContext("2d");
  const res = await fetch(`https://penguinanalytics.onrender.com/penguins/${penguin.id}/weight-trend`);
  const trend = await res.json();

  const labels = trend.map(t => t.date);
  const values = trend.map(t => t.mass);

  if (massChartInstance) massChartInstance.destroy();
  massChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Mass Over Time',
        data: values,
        borderColor: 'blue',
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true },
        x: { title: { display: true, text: 'Date' } }
      }
    }
  });
}

async function deletePenguin(id) {
  await fetch(`https://penguinanalytics.onrender.com/penguins/${id}`, { method: "DELETE" });
  loadPenguins();
}

async function searchPenguin() {
  const query = document.getElementById("searchInput").value;
  const msg = document.getElementById("noResultMsg");
  msg.textContent = '';

  if (!query) return;

  const searchRes = await fetch(`https://penguinanalytics.onrender.com/penguins/search?query=${query}`);
  const searchData = await searchRes.json();
  const searchedPenguin = searchData[0];

  if (!searchedPenguin) {
    msg.textContent = "No penguin found for that ID or name.";
    loadPenguins();
    return;
  }

  const penguinRes = await fetch(`https://penguinanalytics.onrender.com/penguins/?sort_by=last_seen`);
  const penguins = await penguinRes.json();
  allPenguins = penguins;
  renderPenguinTable(penguins, searchedPenguin);
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  document.getElementById("noResultMsg").textContent = "";
  loadPenguins();
}
function downloadColonyStatsJSON() {
  fetch("https://penguinanalytics.onrender.com/analytics/colony-stats")
    .then(res => res.json())
    .then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "colony_stats.json";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert("Error downloading stats: " + err.message));
}

async function downloadData() {
  try {
    const res = await fetch("https://penguinanalytics.onrender.com/penguins/download");
    if (!res.ok) throw new Error("Failed to download data");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'penguin_data.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Error downloading data: " + err.message);
  }
}

async function viewColonyStats() {
  const res = await fetch("https://penguinanalytics.onrender.com/analytics/colony-stats");
  const stats = await res.json();

  const barCtx = document.getElementById("colonyBarChart").getContext("2d");
  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(stats.moulting_stages),
      datasets: [{
        label: 'Moulting Stage Count',
        data: Object.values(stats.moulting_stages),
        backgroundColor: ['#007bff', '#28a745', '#ffc107']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { title: { display: true, text: "Stage" } }
      }
    }
  });

  const pieCtx = document.getElementById("riskPieChart").getContext("2d");
  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ["At Risk", "Not At Risk"],
      datasets: [{
        data: [stats.at_risk_count, stats.total_penguins - stats.at_risk_count],
        backgroundColor: ["#dc3545", "#28a745"]
      }]
    },
    options: { responsive: true }
  });

  const details = document.getElementById("colonyDetails");
  details.innerHTML = `
    <p><strong>Total Penguins:</strong> ${stats.total_penguins}</p>
    <p><strong>Average Mass:</strong> ${stats.average_mass.toFixed(2)} kg</p>
    <p><strong>Mass Std Dev:</strong> ${stats.stddev_mass.toFixed(2)}</p>
    <p><strong>Min Mass:</strong> ${stats.min_mass}</p>
    <p><strong>Max Mass:</strong> ${stats.max_mass}</p>
    <p><strong>At Risk %:</strong> ${stats.at_risk_percentage}</p>
    <p><strong>Avg. Hours Since Seen:</strong> ${stats.average_hours_since_seen.toFixed(2)}</p>
    <p><strong>Last Seen Penguin:</strong> ID ${stats.latest_seen.penguin_id}</p>
  `;
}

function closeColonyStats() {
  const ctxBar = document.getElementById("colonyBarChart").getContext("2d");
  const ctxPie = document.getElementById("riskPieChart").getContext("2d");

  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }

  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  ctxBar.clearRect(0, 0, 200, 150);
  ctxPie.clearRect(0, 0, 200, 150);
  document.getElementById("colonyDetails").innerHTML = "";
}

window.onload = () => {
  loadPenguins();
};
