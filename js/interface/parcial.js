/**
 * parcial.js — Modal para marcar/editar um pagamento parcial
 * (parte puramente visual; não depende do algorithm.js)
 *
 * Uso:
 *   ParcialModal.abrir({
 *     titulo: 'Pagamento parcial',
 *     descricao: 'Ana deve R$ 120,00 a Bruno',
 *     valorTotal: 120,
 *     valorAtual: 0,            // já marcado como pago antes, se houver
 *     aoConfirmar: (valor) => {}  // 0 remove o parcial, >= valorTotal marca como pago
 *   })
 */
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .prc-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:prc-fade .18s ease-out}
    .prc-fundo[hidden]{display:none}
    .prc-modal{position:relative;width:100%;max-width:400px;padding:26px;border-radius:20px;
      background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:prc-entra .2s ease-out;
      color:#e9eeff}
    .prc-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .prc-sub{color:#8c99bd;font-size:.85rem;margin:6px 0 18px;line-height:1.5}
    .prc-sub strong{color:#e9eeff}
    .prc-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:#8c99bd;cursor:pointer;display:grid;place-items:center}
    .prc-fechar:hover{background:rgba(255,255,255,.08);color:#e9eeff}

    .prc-campo{display:grid;gap:6px}
    .prc-campo label{font-size:.8rem;font-weight:600;color:#b9c5e8}
    .prc-campo input{width:100%;padding:11px 13px;border-radius:12px;border:1px solid rgba(120,150,255,.16);
      background:rgba(4,8,22,.7);color:#e9eeff;font:inherit;font-size:.92rem}
    .prc-campo input:focus-visible{outline:2px solid #4d7cff;outline-offset:0;border-color:#4d7cff}
    .prc-total{margin-top:6px;font-size:.78rem;color:#8c99bd}
    .prc-erro{min-height:1.2em;margin-top:8px;font-size:.82rem;color:#ff7a90}

    .prc-rodape{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:20px;flex-wrap:wrap}
    .prc-remover{margin-right:auto;background:none;border:0;color:#ff7a90;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;padding:6px 0}
    .prc-remover:hover{text-decoration:underline}
    .prc-btn{font:inherit;font-size:.88rem;font-weight:700;border:1px solid rgba(120,150,255,.16);cursor:pointer;
      padding:10px 16px;border-radius:12px;color:#e9eeff;background:rgba(255,255,255,.04)}
    .prc-btn:hover{background:rgba(255,255,255,.09)}
    .prc-btn.prc-primario{background:linear-gradient(135deg,#5b86ff,#3a63e6);border-color:transparent;color:#fff}
    .prc-btn.prc-primario:hover{background:linear-gradient(135deg,#6b92ff,#4a71f0)}

    @keyframes prc-fade{from{opacity:0}to{opacity:1}}
    @keyframes prc-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.prc-fundo,.prc-modal{animation:none}}`;
  document.head.appendChild(estilo);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const lerValor = txt => {
    const t = String(txt).trim().replace(/R\$/gi, '').replace(/\s/g, '');
    let s = t.replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  };

  const ICONE_FECHAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let fundo = null, focoAnterior = null, opcoesAtuais = null;

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'prc-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="prc-modal" role="dialog" aria-modal="true" aria-labelledby="prcTitulo">
        <button class="prc-fechar" type="button" aria-label="Fechar">${ICONE_FECHAR}</button>
        <h3 id="prcTitulo"></h3>
        <p class="prc-sub" id="prcSub"></p>
        <div class="prc-campo">
          <label for="prcValor">Quanto já foi pago?</label>
          <input id="prcValor" type="text" inputmode="decimal" placeholder="0,00">
          <span class="prc-total" id="prcTotalTxt"></span>
        </div>
        <div class="prc-erro" id="prcErro" role="alert"></div>
        <div class="prc-rodape">
          <button class="prc-remover" type="button" id="prcRemover" hidden>Remover pagamento parcial</button>
          <button class="prc-btn" type="button" id="prcCancelar">Cancelar</button>
          <button class="prc-btn prc-primario" type="button" id="prcConfirmar">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(fundo);

    const q = s => fundo.querySelector(s);
    q('.prc-fechar').addEventListener('click', fechar);
    q('#prcCancelar').addEventListener('click', fechar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    q('#prcValor').addEventListener('input', () => { q('#prcErro').textContent = ''; });
    q('#prcRemover').addEventListener('click', () => confirmar(0));
    q('#prcConfirmar').addEventListener('click', () => confirmar());

    document.addEventListener('keydown', e => {
      if (fundo.hidden) return;
      if (e.key === 'Escape') return fechar();
      if (e.key === 'Enter' && e.target.id === 'prcValor') { e.preventDefault(); confirmar(); }
      if (e.key === 'Tab') { // mantém o foco dentro do modal
        const foco = [...fundo.querySelectorAll('button, input')].filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
        if (!foco.length) return;
        const pos = foco.indexOf(document.activeElement);
        const prox = e.shiftKey ? (pos <= 0 ? foco.length - 1 : pos - 1) : (pos + 1) % foco.length;
        e.preventDefault();
        foco[prox].focus();
      }
    });
  }

  function confirmar(valorForcado) {
    const opcoes = opcoesAtuais;
    if (!opcoes) return;
    let valor = valorForcado;
    if (valor === undefined) {
      const bruto = fundo.querySelector('#prcValor').value.trim();
      valor = bruto ? lerValor(bruto) : 0;
      if (!isFinite(valor) || valor < 0) {
        fundo.querySelector('#prcErro').textContent = 'Informe um valor válido.';
        fundo.querySelector('#prcValor').focus();
        return;
      }
      if (valor > opcoes.valorTotal + 0.005) {
        fundo.querySelector('#prcErro').textContent = `O valor pago não pode passar de ${fmtBRL(opcoes.valorTotal)}.`;
        fundo.querySelector('#prcValor').focus();
        return;
      }
    }
    fechar();
    if (opcoes.aoConfirmar) opcoes.aoConfirmar(valor);
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

    fundo.querySelector('#prcTitulo').textContent = opcoes.titulo || 'Pagamento parcial';
    fundo.querySelector('#prcSub').innerHTML = esc(opcoes.descricao || '');
    fundo.querySelector('#prcTotalTxt').textContent = `Valor total: ${fmtBRL(opcoes.valorTotal)}`;
    const input = fundo.querySelector('#prcValor');
    input.value = opcoes.valorAtual ? opcoes.valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    fundo.querySelector('#prcErro').textContent = '';
    fundo.querySelector('#prcRemover').hidden = !(opcoes.valorAtual > 0);

    fundo.hidden = false;
    input.focus();
    input.select();
  }

  window.ParcialModal = { abrir: abrir };
})();
