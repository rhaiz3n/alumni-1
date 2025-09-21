// script.js
const openBtn = document.getElementById('openModal');
const closeBtn = document.getElementById('closeModal');
const modal = document.getElementById('modal');
const form = document.getElementById('alumniForm');
const tbody = document.querySelector('#alumniTable tbody');
const counter = document.getElementById('rowCounter');

openBtn.onclick = () => modal.classList.add('show');
closeBtn.onclick = closeModal;

async function loadData() {
  const resp = await fetch('/api/alumni');
  const data = await resp.json(); // now valid JSON
  tbody.innerHTML = '';
  data.forEach(r => {
    const tr = document.createElement('tr');
    ['firstName','lastName','initial','suffix','civilStatus',
     'dateBirth','gender','phoneNo','major',
     'yearStarted','graduated','studentNo']
      .forEach(key => {
        const td = document.createElement('td');
        td.textContent = r[key] || '';
        tr.appendChild(td);
      });
    tbody.appendChild(tr);
  });
}

form.onsubmit = async e => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {};
  for (const [key, val] of fd.entries()) {
    payload[key] = val.trim();
  }

  try {
    const res = await fetch('/api/alumni', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Unknown error');

    alert('Saved successfully!');
    closeModal();
    form.reset();
    loadData(1);
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

function closeModal() {
  modal.classList.remove('show');
}

window.onload = () => loadData(1);
