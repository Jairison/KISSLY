// Ajustes dinâmicos sobre o app.json.
// KISSLY_BASE_URL: caminho em que a versão web é publicada (ex.: "/KISSLY" no GitHub Pages).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.KISSLY_BASE_URL ? { baseUrl: process.env.KISSLY_BASE_URL } : {}),
  },
});
