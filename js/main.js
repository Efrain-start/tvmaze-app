// main.js
const API = {
  search: (q, signal) =>
  axios.get(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { signal }),
  show:   (id) => axios.get(`https://api.tvmaze.com/shows/${id}`),
  episodes: (id) => axios.get(`https://api.tvmaze.com/shows/${id}/episodes`),
};

// Helpers UI
const $app = document.getElementById("app");
const stripHtml = (s = '') => s.replace(/<[^>]+>/g, '');


const html = String.raw;
const imgSafe = (src) => src || "https://placehold.co/210x295?text=No+Image";
const debounce = (fn, ms = 350) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};


// Views
function HomeView() {
  $app.innerHTML = html`
    <section class="card">
      <h2>Búsqueda de series</h2>
      <form class="search" id="search-form" autocomplete="off">
        <input id="q" name="q" placeholder="Ej. Friends, Breaking Bad…" />
        <button type="submit">Buscar</button>
      </form>
      <div id="results" class="grid"></div>
      <p class="empty">Escribe un término y presiona “Buscar”.</p>
    </section>
  `;

  const form = document.getElementById("search-form");
  const results = document.getElementById("results");
  const empty = $app.querySelector(".empty");

  const input = document.getElementById("q");

  let controller = null; 
  

const onType = debounce(() => {
  const v = input.value.trim();
  if (v.length >= 2) {
    form.requestSubmit();     
  } else {
    results.innerHTML = "";
    if (!document.querySelector(".empty")) {
      $app.insertAdjacentHTML("beforeend", `<p class="empty">Escribe un término y presiona “Buscar”.</p>`);
    }
    
    if (controller) controller.abort();
  }
}, 350);

input.addEventListener("input", onType);



  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = new FormData(form).get("q")?.trim();
    if (!q) return;

    results.innerHTML = "";
    empty.className = "loading";

    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const { data } = await API.search(q, controller.signal); 
      empty.remove();
      if (!data.length) {
        $app.insertAdjacentHTML("beforeend", `<p class="empty">Sin resultados para <strong>${q}</strong>.</p>`);
        return;
      }

      results.innerHTML = data.map(({ show }) => {
        const img = show.image?.medium || show.image?.original;
        const genres = (show.genres || []).map(g => `<span class="badge">${g}</span>`).join(" ");
        return html`
          <article class="card">
            <a href="#/show/${show.id}" style="text-decoration:none; color:inherit">
              <img loading="lazy" src="${imgSafe(img)}" alt="${show.name}" width="210" height="295" style="width:100%; height:295px; object-fit:cover; border-radius:10px;">
              <h3>${show.name}</h3>
              <p class="muted">${genres || ""}</p>
            </a>
          </article>
        `;
      }).join("");

    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;  
      console.error(err);
      results.innerHTML = "";
      $app.insertAdjacentHTML("beforeend", `<p class="error">Ocurrió un error al buscar. Intenta de nuevo.</p>`);
    }
  });
}



async function ShowView(id) {
  $app.innerHTML = `<section class="card"><h2>Detalle de serie</h2><p class="loading">Cargando…</p></section>`;

  try {
   
    const [{ data: show }, { data: episodes }] = await Promise.all([
      API.show(id),
      API.episodes(id)
    ]);

    // Datos del show
    const cover   = show?.image?.original || show?.image?.medium;
    const rating  = show?.rating?.average ? `${show.rating.average}/10` : 'Sin rating';
    const genres  = (show?.genres || []).join(', ') || 'Sin género';
    const summary = stripHtml(show?.summary || 'Sin descripción.');
    const link    = show?.url || '#';

    // Lista de episodios
    const list = (episodes && episodes.length)
      ? episodes.map(ep => `
          <li>
            <span class="badge">S${ep.season}E${ep.number ?? "?"}</span>
            <strong>${ep.name}</strong> — <small class="muted">${ep.airdate || "s/f"}</small>
          </li>
        `).join("")
      : `<li class="muted">No hay episodios disponibles.</li>`;

    // Render
    $app.innerHTML = html`
      <nav class="container" style="margin-bottom:12px">
        <a href="#/" class="badge">← Volver</a>
      </nav>

      <section class="card">
        <div class="media">
          <img src="${imgSafe(cover)}" alt="${show?.name || 'Poster'}" width="420" height="600" style="border-radius:10px; max-width:100%; height:auto;">
          <div>
            <h2>${show?.name || 'Sin título'}</h2>
            <p class="muted">${genres} • ${rating} ${show?.premiered ? '• ' + show.premiered : ''}</p>
            <p>${summary}</p>
            <p><a href="${link}" target="_blank" rel="noopener">Ver en TVMaze ↗</a></p>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Lista de episodios</h3>
        <ul style="list-style:none; padding-left:0; display:grid; gap:8px;">
          ${list}
        </ul>
      </section>
    `;
  } catch (err) {
    console.error(err);
    $app.innerHTML = html`
      <section class="card">
        <h2>Detalle de serie</h2>
        <p class="error">No se pudieron cargar los detalles/episodios.</p>
        <p><a href="#/" class="badge">← Volver</a></p>
      </section>
    `;
  }
}


// Router
function router() {
  const { hash } = window.location;
  const match = hash.match(/^#\/show\/(\d+)$/);

  if (!hash || hash === "#/") {
    HomeView();
  } else if (match) {
    const id = match[1];
    ShowView(id);
  } else {
    $app.innerHTML = `<section class="card"><h2>404</h2><p class="empty">Ruta no encontrada</p></section>`;
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

