
// Sistema de puntos: Top 1 = 500.00, Top 150 = 14.50, curva exponencial progresiva
// entre medio, y 0.01 fijo para cualquier posición fuera del Top 150.
function getMaxPointsForPosition(topPosition) {
  if (topPosition <= 1) return 500;
  if (topPosition >= 150) return topPosition === 150 ? 14.5 : 0.01;
  const ratio = 14.5 / 500;
  const points = 500 * Math.pow(ratio, (topPosition - 1) / 149);
  return Math.round(points * 100) / 100;
}

export async function render(container) {
  container.innerHTML = `
    <div class="state-message">
      <div class="spinner"></div>
      <p style="margin-top:16px; font-size:0.9rem; opacity:0.8;">
        Procesando bases de datos y calculando puntos en vivo...
      </p>
    </div>`;

  try {
    const listResponse = await fetch('data-lvl/_list.json');
    if (!listResponse.ok) throw new Error("No se pudo mapear el archivo de índice _list.json");
    const levelFiles = await listResponse.json();

    const playerRegistry = {};

    for (let index = 0; index < levelFiles.length; index++) {
      const fileName = levelFiles[index].trim();
      
      try {
        const res = await fetch(`data-lvl/${fileName}.json`);
        if (!res.ok) continue; 
        
        const levelData = await res.json();
        const topPosition = index + 1; 

        const maxLevelPoints = getMaxPointsForPosition(topPosition);

        if (levelData.records && Array.isArray(levelData.records)) {
          levelData.records.forEach(record => {
            const username = record.user.trim();
            if (!username) return;

            const nombreNivelSeguro = levelData.name || fileName.replace('.json', '');

            if (!playerRegistry[username]) {
              playerRegistry[username] = {
                name: username,
                points: 0,
                completions: 0,
                listProgress: 0,
                hardest: { name: nombreNivelSeguro, rank: topPosition }
              };
            }

            const currentPlayer = playerRegistry[username];

            if (record.percent === 100) {
              currentPlayer.points += maxLevelPoints;
              currentPlayer.completions += 1;
            } else if (record.percent >= parseInt(levelData.percentToQualify || 50)) {
              const progressScore = maxLevelPoints * (record.percent / 100) * 0.4;
              currentPlayer.points += Math.round(progressScore * 100) / 100;
              currentPlayer.listProgress += 1;
            }

            if (topPosition < currentPlayer.hardest.rank && record.percent === 100) {
              currentPlayer.hardest.name = nombreNivelSeguro;
              currentPlayer.hardest.rank = topPosition;
            }
          });
        }
      } catch (levelErr) {
        console.warn(`Error procesando los datos analíticos del archivo: ${fileName}.json`, levelErr);
      }
    }

    const rankedPlayers = Object.values(playerRegistry).sort((a, b) => b.points - a.points);

    const noPlayers = `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-secondary)">No se encontraron récords registrados.</td></tr>`;

    const tableRows = rankedPlayers.map((player, idx) => {
      let medal = `#${idx + 1}`;
      if (idx === 0) medal = '🥇';
      if (idx === 1) medal = '🥈';
      if (idx === 2) medal = '🥉';
      return `
        <tr class="leaderboard-row">
          <td class="lb-rank">${player.points.toFixed(2) && medal}</td>
          <td class="lb-player">${player.name}</td>
          <td class="lb-pts">${player.points.toFixed(2)} <span>PTS</span></td>
          <td class="lb-center">${player.completions}</td>
          <td class="lb-center">${player.listProgress}</td>
          <td class="lb-right">
            <span class="lb-hardest">${player.hardest.name}</span>
            <span class="lb-hardest-rank"> (Top ${player.hardest.rank})</span>
          </td>
        </tr>`;
    }).join('');

    const playerCards = rankedPlayers.map((player, idx) => {
      let medal = '#' + (idx + 1);
      let medalClass = '';
      if (idx === 0) { medal = '🥇'; medalClass = 'lb-card__rank--gold'; }
      if (idx === 1) { medal = '🥈'; medalClass = 'lb-card__rank--silver'; }
      if (idx === 2) { medal = '🥉'; medalClass = 'lb-card__rank--bronze'; }
      return `
        <div class="lb-card">
          <div class="lb-card__rank ${medalClass}">${medal}</div>
          <div class="lb-card__body">
            <div class="lb-card__name">${player.name}</div>
            <div class="lb-card__hardest">☠ ${player.hardest.name} <span>(Top ${player.hardest.rank})</span></div>
            <div class="lb-card__stats">
              <span><strong>${player.completions}</strong> completados</span>
              <span class="lb-card__sep">·</span>
              <span><strong>${player.listProgress}</strong> progresos</span>
            </div>
          </div>
          <div class="lb-card__pts">${player.points.toFixed(2)}<span>PTS</span></div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="lb-page-header animate-fadeIn">
        <h1 class="page-title"><span>Leaderboard</span> Global</h1>
        <p class="page-subtitle">Puntuaciones y récords de la comunidad calculados automáticamente</p>
        <div class="page-title-bar"></div>
      </div>

      <!-- Tabla: visible solo en desktop -->
      <div class="lb-table-wrap animate-fadeIn">
        <table class="lb-table">
          <thead>
            <tr>
              <th class="lb-rank">Rank</th>
              <th>Jugador</th>
              <th>Puntos</th>
              <th class="lb-center">Completados</th>
              <th class="lb-center">Progresos</th>
              <th class="lb-right">Hardest</th>
            </tr>
          </thead>
          <tbody>${rankedPlayers.length === 0 ? noPlayers : tableRows}</tbody>
        </table>
      </div>

      <!-- Cards: visible solo en móvil -->
      <div class="lb-cards animate-fadeIn">
        ${rankedPlayers.length === 0
          ? '<p style=\"text-align:center;color:var(--text-secondary);padding:var(--space-8)\">No se encontraron récords.</p>'
          : playerCards}
      </div>
    `;

  } catch (error) {
    container.innerHTML = `
      <div class="state-message text-error">
        <p>⚠️ Error crítico en la compilación del Leaderboard</p>
        <p style="font-size:0.85rem; opacity:0.7; margin-top:8px;">${error.message}</p>
      </div>`;
    console.error("Fallo estructural en el cálculo:", error);
  }
}
