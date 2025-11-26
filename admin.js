// Admin panel functionality - basic skeleton
// You'll expand this based on your ERPNext report UI structure

const CONFIG_FILE = 'config.json'; // Store config in JSON file

let config = {
  users: [],
  fields: [],
  permissions: {}
};

function loadConfig() {
  // Load from localStorage for now, later from PHP/JSON file
  const stored = localStorage.getItem('adminConfig');
  if (stored) {
    config = JSON.parse(stored);
  }
  renderUsers();
  renderFields();
}

function saveConfig() {
  localStorage.setItem('adminConfig', JSON.stringify(config));
  // TODO: Save to server via PHP
}

function renderUsers() {
  const tbody = document.getElementById('userTable');
  tbody.innerHTML = '';
  config.users.forEach((user, idx) => {
    tbody.innerHTML += `
      <tr>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${idx})">Delete</button>
        </td>
      </tr>
    `;
  });
}

function addUser() {
  const email = prompt("Enter user email:");
  const role = prompt("Enter role (viewer/editor/admin):");
  if (email && role) {
    config.users.push({ email, role });
    saveConfig();
    renderUsers();
  }
}

function deleteUser(idx) {
  if (confirm("Delete this user?")) {
    config.users.splice(idx, 1);
    saveConfig();
    renderUsers();
  }
}

function renderFields() {
  // TODO: Implement field management UI
}

loadConfig();
