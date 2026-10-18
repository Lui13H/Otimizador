/**
 * ordenar.js — Modal genérico de escolha de ordenação para uma lista
 * (parte puramente visual; não depende do algorithm.js)
 *
 * Uso:
 *   OrdenarModal.abrir({
 *     titulo: 'Ordenar Transações registradas',
 *     opcoes: [{ valor: 'padrao', rotulo: 'Padrão', desc: 'Como está' }, ...],
 *     atual: 'padrao',
 *     aoEscolher: (valor) => { ... }
 *   })
 */
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .ord-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:ord-fade .18s ease-out}
    .ord-fundo[hidden]{display:none}
    .ord-modal{position:relative;width:100%;max-width:420px;padding:26px;border-radius:20px;
      background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:ord-entra .2s ease-out}
    .ord-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .ord-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .ord-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}

    .ord-opcoes{display:grid;gap:10px;margin-top:18px}
    .ord-opcao{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:13px 16px;text-align:left;
      border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.03);
      font:inherit;color:inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
    .ord-opcao:hover{background:rgba(77,124,255,.1);border-color:rgba(120,150,255,.5);transform:translateY(-1px)}
    .ord-opcao:active{transform:translateY(0)}
    .ord-opcao:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
    .ord-opcao[aria-pressed="true"]{border-color:var(--blue2);background:rgba(77,124,255,.14)}

    .ord-texto{display:grid;gap:2px;min-width:0}
    .ord-texto strong{font-size:.92rem}
    .ord-texto small{display:block;color:var(--mut);font-size:.76rem;line-height:1.4}

    .ord-check{flex:none;width:20px;height:20px;color:var(--blue2);visibility:hidden}
    .ord-opcao[aria-pressed="true"] .ord-check{visibility:visible}

    @keyframes ord-fade{from{opacity:0}to{opacity:1}}
    @keyframes ord-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ord-fundo,.ord-modal{animation:none}}`;
  document.head.appendChild(estilo);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const ICONE_FECHAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICONE_CHECK = '<svg class="ord-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  let fundo = null, focoAnterior = null, opcoesAtuais = null;

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'ord-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="ord-modal" role="dialog" aria-modal="true" aria-labelledby="ordTitulo">
        <button class="ord-fechar" type="button" aria-label="Fechar">${ICONE_FECHAR}</button>
        <h3 id="ordTitulo"></h3>
        <div class="ord-opcoes" id="ordOpcoes"></div>
      </div>`;
    document.body.appendChild(fundo);

    fundo.querySelector('.ord-fechar').addEventListener('click', fechar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    fundo.querySelector('#ordOpcoes').addEventListener('click', e => {
      const b = e.target.closest('[data-valor]');
      if (b) escolher(b.dataset.valor);
    });

    document.addEventListener('keydown', e => {
      if (fundo.hidden) return;
      if (e.key === 'Escape') return fechar();
      if (e.key === 'Tab') { // mantém o foco dentro do modal
        const foco = [...fundo.querySelectorAll('button')].filter(el => el.offsetParent !== null);
        if (!foco.length) return;
        const pos = foco.indexOf(document.activeElement);
        const prox = e.shiftKey ? (pos <= 0 ? foco.length - 1 : pos - 1) : (pos + 1) % foco.length;
        e.preventDefault();
        foco[prox].focus();
      }
    });
  }

  function escolher(valor) {
    const opcoes = opcoesAtuais;
    fechar();
    if (opcoes && opcoes.aoEscolher) opcoes.aoEscolher(valor);
  }

  function fechar() {
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    opcoesAtuais = null;
    if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
  }

  function abrir(opcoes) {
    if (!fundo) criarFundo();
    opcoesAtuais = opcoes;
    focoAnterior = document.activeElement;

    fundo.querySelector('#ordTitulo').textContent = opcoes.titulo;
    fundo.querySelector('#ordOpcoes').innerHTML = opcoes.opcoes.map(o => `
      <button class="ord-opcao" type="button" data-valor="${esc(o.valor)}" aria-pressed="${o.valor === opcoes.atual}">
        <span class="ord-texto"><strong>${esc(o.rotulo)}</strong>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span>
        ${ICONE_CHECK}
      </button>`).join('');

    fundo.hidden = false;
    (fundo.querySelector('[aria-pressed="true"]') || fundo.querySelector('.ord-opcao')).focus();
  }

  window.OrdenarModal = { abrir: abrir };
})();
