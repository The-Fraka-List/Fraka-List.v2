
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

        
        const maxLevelPoints = Math.max(50, 250 - (topPosition * 3));

        if (levelData.records && Array.isArray(levelData.records)) {
          levelData.records.forEach(record => {
            const username = record.user.trim();
            if (!username) return;

            if (!playerRegistry[username]) {
              playerRegistry[username] = {
                name: username,
                points: 0,
                completions: 0,
                listProgress: 0,
                hardest: { name: levelData.name, rank: topPosition }
              };
            }

            const currentPlayer = playerRegistry[username];

            if (record.percent === 100) {
              currentPlayer.points += maxLevelPoints;
              currentPlayer.completions += 1;
            } else if (record.percent >= parseInt(levelData.percentToQualify || 50)) {
              const progressScore = maxLevelPoints * (record.percent / 100) * 0.4;
              currentPlayer.points += Math.round(progressScore * 10) / 10;
              currentPlayer.listProgress += 1;
            }

            if (topPosition < currentPlayer.hardest.rank && record.percent === 100) {
              currentPlayer.hardest.name = levelData.name;
              currentPlayer.hardest.rank = topPosition;
            }
          });
        }
      } catch (levelErr) {
        console.warn(`Error procesando los datos analíticos del archivo: ${fileName}.json`, levelErr);
      }
    }

    const rankedPlayers = Object.values(playerRegistry).sort((a, b) => b.points - a.points);

    container.innerHTML = `
      <div class="page-header animate-fadeIn">
        <h1 class="page-title"><span>Leaderboard</span> Global</h1>
        <p class="page-subtitle">Puntuaciones y récords de la comunidad calculados automáticamente</p>
        <div class="page-title-bar"></div>
      </div>

      <div class="table-container animate-fadeIn" style="max-width: 1000px; margin: 30px auto; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--font-ui);">
          <thead>
            <tr style="border-bottom: 2px solid var(--accent-primary); color: var(--text-primary); font-size: 1.1rem;">
              <th style="padding: 16px;">Rank</th>
              <th style="padding: 16px;">Jugador</th>
              <th style="padding: 16px;">Puntos Totales</th>
              <th style="padding: 16px; text-align: center;">Completados</th>
              <th style="padding: 16px; text-align: center;">Progresos</th>
              <th style="padding: 16px; text-align: right;">Récord Más Difícil</th>
            </tr>
          </thead>
          <tbody>
            ${rankedPlayers.length === 0 
              ? `<tr><td colspan="6" style="padding: 30px; text-align: center; color: var(--text-secondary);">No se encontraron récords registrados en el sistema.</td></tr>`
              : rankedPlayers.map((player, idx) => {
                  let medal = `#${idx + 1}`;
                  if (idx === 0) medal = '🥇';
                  if (idx === 1) medal = '🥈';
                  if (idx === 2) medal = '🥉';

                  return `
                    <tr class="leaderboard-row" style="border-bottom: 1px solid var(--border-card); background: var(--bg-surface); transition: background 0.2s;">
                      <td style="padding: 16px; font-weight: 700; font-size: 1.1rem; color: var(--accent-primary);">${medal}</td>
                      <td style="padding: 16px; font-weight: 600; color: var(--text-primary);" class="player-name">${player.name}</td>
                      <td style="padding: 16px; font-weight: 700; color: #fff; font-family: 'Orbitron', sans-serif;">${player.points.toFixed(1)} <span style="font-size: 0.8rem; color: var(--accent-primary);">PTS</span></td>
                      <td style="padding: 16px; text-align: center; color: var(--text-primary);">${player.completions}</td>
                      <td style="padding: 16px; text-align: center; color: var(--text-secondary);">${player.listProgress}</td>
                      <td style="padding: 16px; text-align: right; font-size: 0.9rem; color: var(--accent-primary); font-style: italic;">
                        ${player.hardest.name} <span style="color: var(--text-secondary); font-size: 0.8rem;">(Top ${player.hardest.rank})</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
          </tbody>
        </table>
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