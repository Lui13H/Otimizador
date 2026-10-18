/**
 * exportar.js — Modal para escolher o que exportar para Excel
 * (parte puramente visual; não depende do algorithm.js)
 *
 * Uso:
 *   ExportarModal.abrir({
 *     total: 5,            // transferências no total
 *     pendentes: 3,        // transferências ainda não confirmadas
 *     aoEscolher: modo => {}   // modo: 'tudo' | 'pendentes'
 *   })
 */
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .exp-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:exp-fade .18s ease-out}
    .exp-fundo[hidden]{display:none}
    .exp-modal{position:relative;width:100%;max-width:460px;padding:26px;border-radius:20px;
      background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:exp-entra .2s ease-out}
    .exp-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .exp-sub{color:var(--mut);font-size:.85rem;margin:6px 0 18px;line-height:1.5}
    .exp-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .exp-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}
    .exp-opcoes{display:grid;gap:12px}
    .exp-opcao{display:flex;align-items:flex-start;gap:14px;width:100%;padding:16px;text-align:left;
      border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.03);
      font:inherit;color:inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
    .exp-opcao:hover:not(:disabled){background:rgba(77,124,255,.1);border-color:rgba(120,150,255,.5);transform:translateY(-1px)}
    .exp-opcao:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
    .exp-opcao:disabled{opacity:.5;cursor:not-allowed}
    .exp-icone{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(77,124,255,.18);color:var(--blue2)}
    .exp-opcao[data-modo="pendentes"] .exp-icone{background:rgba(61,220,151,.16);color:var(--pos)}
    .exp-texto{display:grid;gap:3px;min-width:0}
    .exp-texto strong{font-size:.95rem}
    .exp-texto small{display:block;color:var(--mut);font-size:.78rem;line-height:1.4}
    .exp-nota{margin-top:14px;font-size:.78rem;color:var(--mut);line-height:1.5}
    @keyframes exp-fade{from{opacity:0}to{opacity:1}}
    @keyframes exp-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.exp-fundo,.exp-modal{animation:none}}`;
  document.head.appendChild(estilo);

  const ICONE_FECHAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICONE_TUDO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
  const ICONE_PENDENTE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  let fundo = null, focoAnterior = null, aoEscolherAtual = null;

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'exp-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="exp-modal" role="dialog" aria-modal="true" aria-labelledby="expTitulo">
        <button class="exp-fechar" type="button" aria-label="Fechar">${ICONE_FECHAR}</button>
        <h3 id="expTitulo">Exportar Transações Mínimas</h3>
        <p class="exp-sub">O arquivo terá as colunas Paga, Valor, Recebe e Pago. O que você quer exportar?</p>
        <div class="exp-opcoes">
          <button class="exp-opcao" type="button" data-modo="tudo">
            <span class="exp-icone">${ICONE_TUDO}</span>
            <span class="exp-texto">
              <strong>Exportar tudo</strong>
              <small id="expTxtTudo"></small>
            </span>
          </button>
          <button class="exp-opcao" type="button" data-modo="pendentes">
            <span class="exp-icone">${ICONE_PENDENTE}</span>
            <span class="exp-texto">
              <strong>Só as não confirmadas</strong>
              <small id="expTxtPend"></small>
            </span>
          </button>
        </div>
        <p class="exp-nota">Na coluna Pago, as transferências já marcadas aparecem como "Sim" e as demais como "Não".</p>
      </div>`;
    document.body.appendChild(fundo);

    fundo.querySelector('.exp-fechar').addEventListener('click', fechar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    fundo.querySelectorAll('.exp-opcao').forEach(b => b.addEventListener('click', () => escolher(b.dataset.modo)));

    document.addEventListener('keydown', e => {
      if (fundo.hidden) return;
      if (e.key === 'Escape') return fechar();
      if (e.key === 'Tab') { // mantém o foco dentro do modal
        const foco = [...fundo.querySelectorAll('button')].filter(el => !el.disabled && el.offsetParent !== null);
        if (!foco.length) return;
        const pos = foco.indexOf(document.activeElement);
        const prox = e.shiftKey ? (pos <= 0 ? foco.length - 1 : pos - 1) : (pos + 1) % foco.length;
        e.preventDefault();
        foco[prox].focus();
      }
    });
  }

  function escolher(modo) {
    const cb = aoEscolherAtual;
    fechar(true);
    if (cb) cb(modo);
  }

  function fechar(escolhido) {
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    aoEscolherAtual = null;
    if (!escolhido && focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function abrir(opcoes) {
    if (!fundo) criarFundo();
    aoEscolherAtual = opcoes.aoEscolher;
    focoAnterior = document.activeElement;

    const un = opcoes.unidade || ['transferência', 'transferências'];
    fundo.querySelector('#expTitulo').textContent = opcoes.titulo || 'Exportar Transações Mínimas';

    fundo.querySelector('#expTxtTudo').textContent =
      `${plural(opcoes.total, un[0], un[1])}, incluindo as já pagas.`;

    const btnPend = fundo.querySelector('[data-modo="pendentes"]');
    btnPend.disabled = opcoes.pendentes === 0;
    fundo.querySelector('#expTxtPend').textContent = opcoes.pendentes === 0
      ? 'Tudo já foi confirmado como pago.'
      : `${plural(opcoes.pendentes, un[0], un[1])} ainda por pagar.`;

    fundo.hidden = false;
    fundo.querySelector(opcoes.pendentes === 0 ? '[data-modo="tudo"]' : '[data-modo="pendentes"]').focus();
  }

  window.ExportarModal = { abrir: abrir };
})();