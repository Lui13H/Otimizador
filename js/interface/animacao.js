/**
 * animacao.js — Animação ao adicionar uma transação (parte puramente visual)
 *
 * Não depende do algorithm.js. Usa apenas as funções auxiliares do index.html
 * (avatar, esc, brl, aviso), chamadas só no momento em que a animação aparece.
 *
 * Uso:  AnimacaoTransacao.mostrar({ de: 'Ana', para: 'Bruno', valor: 120 })
 * Botão: <button id="btnAnimacao"> liga/desliga e lembra a escolha no navegador.
 */
(function () {
  const CHAVE_PREF = 'otimizador-animacao';
  const DURACAO_MS = 2200;
  const DURACAO_SUCESSO_MS = 4000;

  let ativa = true;
  try { ativa = localStorage.getItem(CHAVE_PREF) !== 'off'; } catch (e) { }

  let fundo = null, timer = null;

  /* ---------- Estilos (injetados por aqui para manter tudo no mesmo arquivo) ---------- */
  const estilo = document.createElement('style');
  estilo.textContent = `
    .btn.alternar{display:inline-flex;align-items:center;gap:10px}
    .btn.alternar .chave{width:34px;height:20px;border-radius:99px;background:rgba(255,255,255,.16);position:relative;transition:background .2s;flex:none}
    .btn.alternar .chave::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .2s}
    .btn.alternar[aria-checked="true"] .chave{background:var(--blue)}
    .btn.alternar[aria-checked="true"] .chave::after{transform:translateX(14px)}

    .anim-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:anim-fade .2s ease-out}
    .anim-fundo[hidden]{display:none}
    .anim-modal{position:relative;width:100%;max-width:580px;padding:26px 26px 30px;border-radius:22px;overflow:hidden;
      background:linear-gradient(160deg,#16275a,#080e24);border:1px solid rgba(130,170,255,.4);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 60px -20px rgba(77,124,255,.6);animation:anim-entra .25s ease-out}
    .anim-modal h3{font-size:1.05rem;font-weight:800;padding-right:36px}
    .anim-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .anim-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}

    .anim-cena{display:grid;grid-template-columns:auto minmax(70px,1fr) auto;align-items:center;gap:14px;margin-top:26px}
    .anim-pessoa{display:flex;align-items:center;gap:10px;min-width:0}
    .anim-pessoa .nome{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;font-size:.92rem}
    .anim-pessoa .nome small{display:block;color:var(--mut);font-weight:500;font-size:.72rem}
    .anim-pessoa .avatar{width:44px;height:44px;font-size:.95rem}
    .anim-receb .avatar{animation:anim-recebe 1.2s ease-in-out .9s infinite}

    .anim-trilho{position:relative;height:60px}
    .anim-trilho::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:2px dashed rgba(140,176,255,.35)}
    .anim-nota{position:absolute;top:50%;left:0;width:38px;height:22px;border-radius:5px;display:grid;place-items:center;
      font-size:.7rem;font-weight:800;color:#06251a;background:linear-gradient(135deg,#5bf0b0,#1fa56e);
      box-shadow:0 4px 14px -4px rgba(61,220,151,.8);opacity:0;animation:anim-voa 1.2s ease-in-out infinite}
    .anim-nota:nth-child(2){animation-delay:.4s}
    .anim-nota:nth-child(3){animation-delay:.8s}
    .anim-valor{margin-top:22px;text-align:center;font-size:1.7rem;font-weight:800;color:var(--pos);letter-spacing:-.02em}
    .anim-progresso{position:absolute;left:0;bottom:0;height:3px;width:100%;background:linear-gradient(90deg,var(--blue),var(--blue2));transform-origin:left;animation:anim-tempo ${DURACAO_MS}ms linear forwards}

    @keyframes anim-fade{from{opacity:0}to{opacity:1}}
    @keyframes anim-entra{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
    @keyframes anim-voa{
      0%{left:0;opacity:0;transform:translateY(-50%) rotate(-8deg) scale(.6)}
      15%{opacity:1}
      85%{opacity:1}
      100%{left:calc(100% - 38px);opacity:0;transform:translateY(-50%) rotate(8deg) scale(.6)}
    }
    @keyframes anim-recebe{0%,100%{transform:scale(1)}50%{transform:scale(1.14);box-shadow:0 0 0 6px rgba(61,220,151,.25)}}
    @keyframes anim-tempo{from{transform:scaleX(1)}to{transform:scaleX(0)}}

    /* Variante "transação efetuada com sucesso" */
    .anim-titulo-ok{color:var(--pos)}
    .anim-ok .anim-nota{animation-iteration-count:2}
    .anim-ok .anim-receb .avatar{animation-iteration-count:2}
    .anim-check{margin:18px auto 0;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;
      background:rgba(61,220,151,.14);border:2px solid var(--pos);box-shadow:0 0 40px -6px rgba(61,220,151,.6);
      opacity:0;transform:scale(.4);animation:anim-check-entra .5s cubic-bezier(.2,1.4,.4,1) 2.6s forwards}
    .anim-check path{stroke-dasharray:30;stroke-dashoffset:30;animation:anim-check-traco .4s ease-out 2.9s forwards}
    @keyframes anim-check-entra{to{opacity:1;transform:scale(1)}}
    @keyframes anim-check-traco{to{stroke-dashoffset:0}}
    @media (prefers-reduced-motion:reduce){
      .anim-check{animation:none;opacity:1;transform:none}
      .anim-check path{animation:none;stroke-dashoffset:0}
    }

    @media (max-width:520px){
      .anim-cena{gap:8px}
      .anim-pessoa .nome{max-width:72px}
      .anim-pessoa .avatar{width:38px;height:38px}
    }
    @media (prefers-reduced-motion:reduce){
      .anim-nota{animation:none;left:calc(50% - 19px);top:50%;opacity:1;transform:translateY(-50%)}
      .anim-nota:nth-child(n+2){display:none}
      .anim-receb .avatar,.anim-progresso,.anim-modal,.anim-fundo{animation:none}
    }`;
  document.head.appendChild(estilo);

  /* ---------- Modal ---------- */
  function fechar() {
    clearTimeout(timer);
    if (fundo) fundo.hidden = true;
  }

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'anim-fundo';
    fundo.hidden = true;
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    document.body.appendChild(fundo);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fundo.hidden) fechar(); });
  }

  function exibir(dados, sucesso) {
    if (!ativa) return false;
    const duracao = sucesso ? DURACAO_SUCESSO_MS : DURACAO_MS;
    if (!fundo) criarFundo();

    // Recria o conteúdo a cada vez para a animação sempre recomeçar do zero
    fundo.innerHTML = `
      <div class="anim-modal" role="dialog" aria-label="${sucesso ? 'Transação efetuada com sucesso' : 'Transação adicionada'}">
        <button class="anim-fechar" type="button" aria-label="Fechar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <h3${sucesso ? ' class="anim-titulo-ok"' : ''}>${sucesso ? 'Transação efetuada com sucesso' : 'Transação adicionada'}</h3>
        <div class="anim-cena${sucesso ? ' anim-ok' : ''}">
          <div class="anim-pessoa">
            ${avatar(dados.de)}
            <span class="nome">${esc(dados.de)}<small>paga</small></span>
          </div>
          <div class="anim-trilho" aria-hidden="true">
            <span class="anim-nota">R$</span><span class="anim-nota">R$</span><span class="anim-nota">R$</span>
          </div>
          <div class="anim-pessoa anim-receb">
            ${avatar(dados.para)}
            <span class="nome">${esc(dados.para)}<small>recebe</small></span>
          </div>
        </div>
        <div class="anim-valor">${brl(Math.round(dados.valor * 100))}</div>
        ${sucesso ? '<div class="anim-check" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' : ''}
        <div class="anim-progresso" style="animation-duration:${duracao}ms"></div>
      </div>`;
    fundo.querySelector('.anim-fechar').addEventListener('click', fechar);
    fundo.hidden = false;

    clearTimeout(timer);
    timer = setTimeout(fechar, duracao);
    return true;
  }

  function mostrar(dados) { return exibir(dados, false); }
  function confirmar(dados) { return exibir(dados, true); }

  /* ---------- Botão "Mostrar animação" ---------- */
  function atualizarBotao(btn) {
    btn.setAttribute('aria-checked', String(ativa));
  }

  function iniciarBotao() {
    const btn = document.getElementById('btnAnimacao');
    if (!btn) return;
    atualizarBotao(btn);
    btn.addEventListener('click', () => {
      ativa = !ativa;
      try { localStorage.setItem(CHAVE_PREF, ativa ? 'on' : 'off'); } catch (e) { }
      atualizarBotao(btn);
      if (!ativa) fechar();
      if (typeof aviso === 'function') aviso(ativa ? 'Animação ativada.' : 'Animação desativada.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarBotao);
  else iniciarBotao();

  window.AnimacaoTransacao = { mostrar: mostrar, confirmar: confirmar, fechar: fechar };
})();