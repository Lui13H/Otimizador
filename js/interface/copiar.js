/**
 * copiar.js — Modal de escolha de formato ao copiar uma lista de transações
 * (parte puramente visual; não depende do algorithm.js)
 *
 * Mostra três opções antes de copiar:
 *   - Copiador Intuitivo: frase clara ("Ana paga → Bruno recebe: R$ 50,00"),
 *     pronta pra colar numa mensagem.
 *   - Copiador para WhatsApp: mesma ideia, mas com *negrito* e emoji,
 *     já formatado do jeito que o WhatsApp renderiza.
 *   - Copiador Excel: colunas separadas por TAB (Paga/Valor/Recebe, sem
 *     cabeçalho), no mesmo formato que o Ctrl+V de uma planilha produz.
 *
 * Uso:
 *   CopiarModal.abrir({
 *     titulo: 'Copiar Transações Mínimas',
 *     qtd: acertos.length,
 *     textoIntuitivo: '...\n...',
 *     textoWhatsapp: '...\n...',
 *     textoExcel: '...\n...'
 *   })
 */
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .cop-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:cop-fade .18s ease-out}
    .cop-fundo[hidden]{display:none}
    .cop-modal{position:relative;width:100%;max-width:460px;padding:26px;border-radius:20px;
      background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:cop-entra .2s ease-out}
    .cop-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .cop-sub{color:var(--mut);font-size:.85rem;margin:6px 0 18px;line-height:1.5}
    .cop-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .cop-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}

    .cop-opcoes{display:grid;gap:12px}
    .cop-opcao{display:flex;align-items:flex-start;gap:14px;width:100%;padding:16px;text-align:left;
      border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.03);
      font:inherit;color:inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
    .cop-opcao:hover{background:rgba(77,124,255,.1);border-color:rgba(120,150,255,.5);transform:translateY(-1px)}
    .cop-opcao:active{transform:translateY(0)}
    .cop-opcao:focus-visible{outline:2px solid var(--blue);outline-offset:2px}

    .cop-icone{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;
      background:rgba(77,124,255,.18);color:var(--blue2)}
    .cop-opcao[data-modo="whatsapp"] .cop-icone{background:rgba(37,211,102,.16);color:#25d366}
    .cop-opcao[data-modo="excel"] .cop-icone{background:rgba(61,220,151,.16);color:var(--pos)}

    .cop-texto{display:grid;gap:3px;min-width:0}
    .cop-texto strong{font-size:.95rem}
    .cop-texto small{display:block;color:var(--mut);font-size:.78rem;line-height:1.4}

    .cop-exemplo{margin-top:6px;font-size:.78rem;color:#aebfee;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cop-exemplo-excel{display:flex;gap:0;border-radius:6px;overflow:hidden;border:1px solid rgba(140,170,255,.25);white-space:nowrap}
    .cop-cel{flex:1 1 auto;min-width:0;padding:3px 8px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;
      background:rgba(255,255,255,.04);border-right:1px solid rgba(140,170,255,.25);overflow:hidden;text-overflow:ellipsis}
    .cop-cel:last-child{border-right:0}

    @keyframes cop-fade{from{opacity:0}to{opacity:1}}
    @keyframes cop-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.cop-fundo,.cop-modal{animation:none}}`;
  document.head.appendChild(estilo);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const ICONE_FECHAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICONE_INTUITIVO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const ICONE_WHATSAPP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-1.3-.6-2.2-1.1-3-2.5-.2-.3 0-.5.1-.6.2-.2.4-.5.6-.7.1-.2.1-.4 0-.6-.1-.2-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9 1-.9 2.3 0 1.3 1 2.6 1.1 2.8.1.2 1.9 3 4.7 4.1 2.3.9 2.8.7 3.3.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
  const ICONE_EXCEL = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>';

  let fundo = null, focoAnterior = null, opcoesAtuais = null;

  function celulasExcel(linha) {
    return linha.split('\t').map(c => `<span class="cop-cel">${esc(c)}</span>`).join('');
  }

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'cop-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="cop-modal" role="dialog" aria-modal="true" aria-labelledby="copTitulo">
        <button class="cop-fechar" type="button" aria-label="Fechar">${ICONE_FECHAR}</button>
        <h3 id="copTitulo"></h3>
        <p class="cop-sub" id="copSub"></p>
        <div class="cop-opcoes">
          <button class="cop-opcao" type="button" data-modo="intuitivo">
            <span class="cop-icone">${ICONE_INTUITIVO}</span>
            <span class="cop-texto">
              <strong>Copiador Intuitivo</strong>
              <small>Frase clara, pronta pra colar numa mensagem</small>
              <span class="cop-exemplo" id="copExIntuitivo"></span>
            </span>
          </button>
          <button class="cop-opcao" type="button" data-modo="whatsapp">
            <span class="cop-icone">${ICONE_WHATSAPP}</span>
            <span class="cop-texto">
              <strong>Copiar para WhatsApp</strong>
              <small>Com *negrito* e emoji, pronto pra colar numa conversa</small>
              <span class="cop-exemplo" id="copExWhatsapp"></span>
            </span>
          </button>
          <button class="cop-opcao" type="button" data-modo="excel">
            <span class="cop-icone">${ICONE_EXCEL}</span>
            <span class="cop-texto">
              <strong>Copiador Excel</strong>
              <small>Colunas separadas por tabulação, cole direto numa planilha</small>
              <span class="cop-exemplo cop-exemplo-excel" id="copExExcel"></span>
            </span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(fundo);

    fundo.querySelector('.cop-fechar').addEventListener('click', fechar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    fundo.querySelectorAll('.cop-opcao').forEach(b => b.addEventListener('click', () => escolher(b.dataset.modo)));

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

  async function copiarTexto(texto) {
    try { await navigator.clipboard.writeText(texto); return true; }
    catch (e) { return false; }
  }

  const TEXTO_POR_MODO = {
    excel: o => o.textoExcel,
    whatsapp: o => o.textoWhatsapp,
    intuitivo: o => o.textoIntuitivo
  };

  const AVISO_POR_MODO = {
    excel: t => `${t}: copiado no formato Excel. Cole numa planilha.`,
    whatsapp: t => `${t}: copiado formatado pro WhatsApp. Cole na conversa.`,
    intuitivo: t => `${t}: copiado. Cole onde quiser.`
  };

  async function escolher(modo) {
    const opcoes = opcoesAtuais;
    if (!opcoes) return;
    const texto = (TEXTO_POR_MODO[modo] || TEXTO_POR_MODO.intuitivo)(opcoes);
    const ok = await copiarTexto(texto);
    fechar();
    const avisar = msg => { if (typeof aviso === 'function') aviso(msg); };
    if (!ok) return avisar('Não foi possível copiar automaticamente.');
    avisar((AVISO_POR_MODO[modo] || AVISO_POR_MODO.intuitivo)(opcoes.titulo));
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

    const n = opcoes.qtd;
    fundo.querySelector('#copTitulo').textContent = opcoes.titulo;
    fundo.querySelector('#copSub').textContent = `${n} ${n === 1 ? 'transação' : 'transações'}. Escolha o formato para copiar:`;
    fundo.querySelector('#copExIntuitivo').textContent = opcoes.textoIntuitivo.split('\n')[0] || '';
    const linhasWhatsapp = opcoes.textoWhatsapp.split('\n');
    fundo.querySelector('#copExWhatsapp').textContent = linhasWhatsapp.find(l => l.trim().startsWith('•')) || linhasWhatsapp.find(l => l.trim()) || '';
    fundo.querySelector('#copExExcel').innerHTML = celulasExcel(opcoes.textoExcel.split('\n')[0] || '');

    fundo.hidden = false;
    fundo.querySelector('.cop-opcao').focus();
  }

  window.CopiarModal = { abrir: abrir };
})();
