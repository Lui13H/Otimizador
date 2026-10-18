/**
 * tema.js — Alterna entre tema escuro (padrão) e claro
 * (parte puramente visual; o botão usa o mesmo estilo de chave do #btnAnimacao)
 *
 * O <html> já recebe data-theme antes do CSS carregar (script inline no <head>,
 * lendo a mesma chave do localStorage) pra não piscar o tema errado ao abrir a página.
 * Botão: <button id="btnTema"> liga/desliga e lembra a escolha no navegador.
 */
(function () {
  const CHAVE_PREF = 'otimizador-tema';

  const estaEscuro = () => document.documentElement.dataset.theme !== 'light';

  function aplicar() {
    const btn = document.getElementById('btnTema');
    if (btn) btn.setAttribute('aria-checked', String(estaEscuro()));
  }

  function alternar() {
    const escuro = !estaEscuro();
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    try { localStorage.setItem(CHAVE_PREF, escuro ? 'escuro' : 'claro'); } catch (e) { }
    aplicar();
  }

  aplicar();
  const btn = document.getElementById('btnTema');
  if (btn) btn.addEventListener('click', alternar);
})();
