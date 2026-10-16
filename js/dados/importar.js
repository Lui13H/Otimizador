/**
 * importar.js — Importa transações coladas (ou lidas de arquivo) para o formulário
 * (parte puramente visual; não depende do algorithm.js)
 *
 * Formatos de texto reconhecidos (um por linha):
 *   1) Resumo do botão "Copiar resumo":      Ana → Bruno: R$ 120,00
 *   2) Tabela do Excel (colunas por TAB):    Paga ⇥ Valor ⇥ Recebe   (com ou sem a linha de cabeçalho)
 *   3) Texto simples "Pagador Recebedor Valor":   João Arthur LuisH 9,00
 *   4) Texto simples "Pagador Valor Recebedor":   João Arthur 9,00 LuisH
 * Valor negativo inverte o sentido (quem pagava passa a receber).
 * Em nomes com espaço no formato 3, a separação pagador/recebedor é deduzida pelos
 * nomes já conhecidos; quando não dá para ter certeza, a linha é marcada para conferência.
 *
 * Uso:
 *   ImportarResumo.ligar([inputs...], linhas => {...}, () => ['Ana', ...])   // Ctrl+V nos campos
 *   ImportarResumo.ligarCampoDedicado(input)                                // campo só para colar
 *   ImportarResumo.importarResultado(resultado)                             // ex.: vindo de um .xlsx
 */
(function () {
  /* ---------- Estilos ---------- */
  const estilo = document.createElement('style');
  estilo.textContent = `
    .imp-fundo{position:fixed;inset:0;z-index:25;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:imp-fade .18s ease-out}
    .imp-fundo[hidden]{display:none}
    .imp-modal{position:relative;width:100%;max-width:640px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;
      padding:24px;border-radius:20px;background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:imp-entra .2s ease-out}
    .imp-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .imp-sub{color:var(--mut);font-size:.85rem;line-height:1.5;margin:6px 0 16px}
    .imp-sub strong{color:var(--txt)}
    .imp-aviso{margin:-6px 0 14px;padding:9px 12px;border-radius:12px;font-size:.8rem;line-height:1.5;color:#f3d28a;background:rgba(255,196,80,.1);border:1px solid rgba(255,196,80,.3)}
    .imp-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .imp-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}

    .imp-cols,.imp-linha{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 110px 34px;gap:8px;align-items:center}
    .imp-cols{padding:0 10px 6px 8px;font-size:.72rem;font-weight:700;color:var(--mut)}
    .imp-lista{flex:1 1 auto;overflow-y:auto;display:grid;gap:8px;align-content:start;min-height:80px;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(140,170,255,.3) transparent}
    .imp-linha{padding:8px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line)}
    .imp-linha.invertida{box-shadow:inset 3px 0 0 var(--blue2)}
    .imp-linha.incerta{border-color:rgba(255,196,80,.6);background:rgba(255,196,80,.06)}
    .imp-linha.invalida{border-color:rgba(255,122,144,.6);background:rgba(255,122,144,.06)}
    .imp-linha input{padding:9px 11px;font-size:.88rem}
    .imp-linha input.v{text-align:right;font-weight:700}
    .imp-linha .icone{width:34px;height:34px}
    .imp-erro{min-height:1.2em;margin-top:12px;font-size:.82rem;color:var(--neg)}
    .imp-rodape{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}
    .imp-total{font-size:.85rem;color:var(--mut)}
    .imp-total strong{color:var(--blue2)}
    .imp-botoes{display:flex;gap:10px;margin-left:auto}
    .imp-vazio{padding:26px 12px;text-align:center;color:var(--mut);font-size:.88rem}

    @keyframes imp-fade{from{opacity:0}to{opacity:1}}
    @keyframes imp-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (max-width:560px){
      .imp-modal{padding:18px}
      .imp-cols{display:none}
      .imp-linha{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 34px}
      .imp-linha input.v{grid-column:1/3;grid-row:2;text-align:left}
      .imp-linha .icone{grid-column:3;grid-row:1/3}
      .imp-botoes{width:100%}
      .imp-botoes .btn{flex:1}
    }
    @media (prefers-reduced-motion:reduce){.imp-fundo,.imp-modal{animation:none}}`;
  document.head.appendChild(estilo);

  /* ---------- Leitura de valores e texto ---------- */
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const ehNumero = t => /^[-−–]?\(?(?:R\$)?\s*[-−–]?\d[\d.,]*\)?$/i.test(String(t).trim());

  // "1.234,56" → 1234.56 · "(50,00)" e "-50,00" → negativo · aceita "R$"
  function lerValor(txt) {
    if (typeof txt === 'number') return txt;
    const t = String(txt).trim().replace(/R\$/gi, '').replace(/\s/g, '');
    const neg = /^[-−–]/.test(t) || /^\(.*\)$/.test(t) || /^[-−–]/.test(t.replace(/^\(/, ''));
    let s = t.replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return neg ? -n : n;
  }

  // "Ana → Bruno: R$ 120,00"  (também ->, =>, -->, ➜)
  const SETA = /^\s*(.+?)\s*(?:→|->|-->|=>|➜|➔|➡)\s*(.+?)\s*[:=\-–]\s*(?:R\$\s*)?([-−]?[\d.,]+)\s*$/;

  function detectarCabecalho(celulas) {
    const n = celulas.map(norm);
    const p = n.findIndex(c => c === 'paga' || c === 'pagador');
    const v = n.findIndex(c => c === 'valor');
    const r = n.findIndex(c => c === 'recebe' || c === 'recebedor');
    return p >= 0 && v >= 0 && r >= 0 ? { p: p, v: v, r: r } : null;
  }

  /**
   * itens: [{ tipo:'certa', p, r, v } | { tipo:'amb', nomes:[...], v }]
   * Resolve as ambíguas, inverte negativos e descarta o que não serve.
   */
  function construir(itens, ignoradas, nomesExtras) {
    const conhecidos = new Set((nomesExtras || []).map(norm));
    itens.forEach(it => { if (it.tipo === 'certa') { conhecidos.add(norm(it.p)); conhecidos.add(norm(it.r)); } });

    const linhas = [];
    let invertidas = 0, incertas = 0;
    ignoradas = ignoradas || [];

    itens.forEach(it => {
      let p, r, incerta = false;
      if (it.tipo === 'certa') { p = it.p; r = it.r; }
      else {
        const t = it.nomes;
        let melhor = null;
        for (let i = 1; i < t.length; i++) {
          const pag = t.slice(0, i).join(' '), rec = t.slice(i).join(' ');
          const pontos = (conhecidos.has(norm(pag)) ? 1 : 0) + (conhecidos.has(norm(rec)) ? 1 : 0);
          const recPalavras = t.length - i;
          if (!melhor || pontos > melhor.pontos || (pontos === melhor.pontos && recPalavras < melhor.recPalavras))
            melhor = { pag: pag, rec: rec, pontos: pontos, recPalavras: recPalavras };
        }
        p = melhor.pag; r = melhor.rec; incerta = melhor.pontos === 0;
      }
      let v = it.v, invertida = false;
      if (!isFinite(v) || v === 0 || !p || !r || norm(p) === norm(r)) { ignoradas.push(it.origem || (p + ' → ' + r)); return; }
      if (v < 0) { v = -v; const x = p; p = r; r = x; invertida = true; invertidas++; }
      if (incerta) incertas++;
      linhas.push({ pagador: p, recebedor: r, valor: Math.round(v * 100) / 100, incerta: incerta, invertida: invertida });
    });
    return { linhas: linhas, ignoradas: ignoradas, invertidas: invertidas, incertas: incertas };
  }

  function interpretar(texto, nomesExtras) {
    const itens = [], ignoradas = [];
    let mapa = null;
    const certa = (p, r, v, origem) => itens.push({ tipo: 'certa', p: String(p || '').trim(), r: String(r || '').trim(), v: v, origem: origem });

    String(texto).split(/\r?\n/).forEach(bruta => {
      const l = bruta.replace(/\u00a0/g, ' ').trim();
      if (!l) return;

      // 1) Resumo com seta
      const m = l.match(SETA);
      if (m) return certa(m[1], m[2], lerValor(m[3]), l);

      // 2) Colunas separadas por TAB (Excel) ou ";" (CSV)
      const sep = l.includes('\t') ? '\t' : (l.split(';').length >= 3 ? ';' : null);
      if (sep) {
        const cel = l.split(sep).map(c => c.trim());
        while (cel.length && !cel[cel.length - 1]) cel.pop();
        const cab = detectarCabecalho(cel);
        if (cab) { mapa = cab; return; }
        let ip, iv, ir;
        if (mapa && cel.length > Math.max(mapa.p, mapa.v, mapa.r)) { ip = mapa.p; iv = mapa.v; ir = mapa.r; }
        else if (cel.length === 3 && ehNumero(cel[1])) { ip = 0; iv = 1; ir = 2; }        // Paga · Valor · Recebe
        else if (cel.length === 3 && ehNumero(cel[2])) { ip = 0; ir = 1; iv = 2; }        // Paga · Recebe · Valor
        else return ignoradas.push(l);
        return certa(cel[ip], cel[ir], lerValor(cel[iv]), l);
      }

      // 3) Texto simples separado por espaços
      const toks = l.split(/\s+/).filter(t => t.toLowerCase() !== 'r$');
      const nt = toks.map(norm);
      if (nt.includes('valor') && (nt.includes('paga') || nt.includes('pagador')) && (nt.includes('recebe') || nt.includes('recebedor'))) return; // cabeçalho
      const nums = toks.map((t, i) => (ehNumero(t) ? i : -1)).filter(i => i >= 0);
      if (nums.length !== 1) return ignoradas.push(l);
      const k = nums[0], v = lerValor(toks[k]);

      if (k === toks.length - 1) {                       // Pagador Recebedor Valor
        const nomes = toks.slice(0, -1);
        if (nomes.length < 2) return ignoradas.push(l);
        if (nomes.length === 2) return certa(nomes[0], nomes[1], v, l);
        return itens.push({ tipo: 'amb', nomes: nomes, v: v, origem: l });
      }
      if (k > 0) return certa(toks.slice(0, k).join(' '), toks.slice(k + 1).join(' '), v, l); // Pagador Valor Recebedor
      ignoradas.push(l);
    });

    return construir(itens, ignoradas, nomesExtras);
  }

  /* ---------- Utilidades ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtValor = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const plural = (n, um, varios) => (n === 1 ? um : varios);

  /* ---------- Modal ---------- */
  let fundo = null, dados = [], aoConfirmar = null, focoAnterior = null;
  let callbackPadrao = null, obterNomesPadrao = null;

  const ICONE_LIXO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'imp-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="imp-modal" role="dialog" aria-modal="true" aria-labelledby="impTitulo">
        <button class="imp-fechar" type="button" aria-label="Fechar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <h3 id="impTitulo">Importar transações</h3>
        <p class="imp-sub" id="impSub"></p>
        <div class="imp-aviso" id="impAviso" hidden></div>
        <div class="imp-cols" aria-hidden="true"><span>Pagador</span><span>Recebedor</span><span>Valor (R$)</span><span></span></div>
        <div class="imp-lista" id="impLista"></div>
        <div class="imp-erro" id="impErro" role="alert"></div>
        <div class="imp-rodape">
          <span class="imp-total" id="impTotal"></span>
          <div class="imp-botoes">
            <button class="btn" type="button" id="impCancelar">Cancelar</button>
            <button class="btn primario" type="button" id="impConfirmar">Adicionar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(fundo);

    const q = s => fundo.querySelector(s);
    q('.imp-fechar').addEventListener('click', () => fechar());
    q('#impCancelar').addEventListener('click', () => fechar());
    q('#impConfirmar').addEventListener('click', confirmar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });

    q('#impLista').addEventListener('input', e => {
      const linha = e.target.closest('.imp-linha');
      if (!linha) return;
      const i = +linha.dataset.i, campo = e.target.dataset.campo;
      dados[i][campo] = e.target.value;
      linha.classList.remove('invalida');
      if (campo !== 'valor') { dados[i].incerta = false; linha.classList.remove('incerta'); }
      q('#impErro').textContent = '';
      atualizarTotal();
    });
    q('#impLista').addEventListener('click', e => {
      const del = e.target.closest('[data-rm]');
      if (!del) return;
      dados.splice(+del.dataset.rm, 1);
      desenhar();
    });

    document.addEventListener('keydown', e => {
      if (fundo.hidden) return;
      if (e.key === 'Escape') return fechar();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); confirmar(); }
      if (e.key === 'Tab') { // mantém o foco dentro do modal
        const foco = [...fundo.querySelectorAll('button, input')].filter(el => !el.disabled && el.offsetParent !== null);
        if (!foco.length) return;
        const pos = foco.indexOf(document.activeElement);
        const prox = e.shiftKey ? (pos <= 0 ? foco.length - 1 : pos - 1) : (pos + 1) % foco.length;
        e.preventDefault();
        foco[prox].focus();
      }
    });
  }

  function atualizarTotal() {
    const n = dados.length;
    const soma = dados.reduce((t, d) => { const v = lerValor(d.valor); return t + (v > 0 ? v : 0); }, 0);
    fundo.querySelector('#impTotal').innerHTML = n ? `Soma das transações: <strong>${fmtBRL(soma)}</strong>` : '';
    const btn = fundo.querySelector('#impConfirmar');
    btn.textContent = n ? `Adicionar ${n} ${plural(n, 'transação', 'transações')}` : 'Adicionar';
    btn.disabled = !n;
    btn.style.opacity = n ? '' : '.5';
  }

  function desenhar() {
    fundo.querySelector('#impLista').innerHTML = dados.length ? dados.map((d, i) => `
      <div class="imp-linha${d.incerta ? ' incerta' : ''}${d.invertida ? ' invertida' : ''}" data-i="${i}"${d.incerta ? ' title="Não deu para ter certeza de onde termina o nome do pagador. Confira."' : (d.invertida ? ' title="Valor negativo: sentido invertido."' : '')}>
        <input data-campo="pagador" value="${esc(d.pagador)}" aria-label="Pagador da transação ${i + 1}" placeholder="Pagador">
        <input data-campo="recebedor" value="${esc(d.recebedor)}" aria-label="Recebedor da transação ${i + 1}" placeholder="Recebedor">
        <input class="v" data-campo="valor" inputmode="decimal" value="${esc(d.valor)}" aria-label="Valor da transação ${i + 1}" placeholder="0,00">
        <button class="icone del" type="button" data-rm="${i}" aria-label="Remover transação ${i + 1}" title="Remover">${ICONE_LIXO}</button>
      </div>`).join('') : '<div class="imp-vazio">Nenhuma transação restante.</div>';
    atualizarTotal();
  }

  function confirmar() {
    const erro = fundo.querySelector('#impErro');
    const prontas = [];
    let primeira = null, msg = '';

    [...fundo.querySelectorAll('.imp-linha')].forEach((el, i) => {
      const d = dados[i];
      const p = d.pagador.trim(), r = d.recebedor.trim(), v = lerValor(d.valor);
      let problema = '';
      if (!p || !r) problema = 'Preencha o pagador e o recebedor.';
      else if (p.toLowerCase() === r.toLowerCase()) problema = 'Pagador e recebedor devem ser pessoas diferentes.';
      else if (!(v > 0)) problema = 'Informe um valor maior que zero.';
      el.classList.toggle('invalida', !!problema);
      if (problema && !primeira) { primeira = el; msg = problema; }
      if (!problema) prontas.push({ pagador: p, recebedor: r, valor: Math.round(v * 100) / 100 });
    });

    if (primeira) {
      erro.textContent = msg;
      primeira.scrollIntoView({ block: 'nearest' });
      const ruim = [...primeira.querySelectorAll('input')].find(inp =>
        inp.dataset.campo === 'valor' ? !(lerValor(inp.value) > 0) : !inp.value.trim()) || primeira.querySelector('input');
      ruim.focus();
      return;
    }
    if (!prontas.length) return;

    const cb = aoConfirmar;
    fechar(true);
    if (cb) cb(prontas);
  }

  function fechar(confirmado) {
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    dados = [];
    if (!confirmado && focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
  }

  function abrir(resultado, callback) {
    if (!fundo) criarFundo();
    aoConfirmar = callback;
    focoAnterior = document.activeElement;
    dados = resultado.linhas.map(l => ({
      pagador: l.pagador, recebedor: l.recebedor, valor: fmtValor(l.valor),
      incerta: !!l.incerta, invertida: !!l.invertida
    }));

    const n = dados.length;
    fundo.querySelector('#impSub').innerHTML =
      `Encontramos <strong>${n} ${plural(n, 'transação', 'transações')}</strong>. Revise, corrija o que precisar e confirme para adicioná-las de uma vez.`;

    const avisos = [];
    const ign = resultado.ignoradas.length;
    if (ign) avisos.push(`${ign} ${plural(ign, 'linha não foi reconhecida e foi ignorada', 'linhas não foram reconhecidas e foram ignoradas')}.`);
    if (resultado.invertidas) avisos.push(`${resultado.invertidas} ${plural(resultado.invertidas, 'linha com valor negativo teve', 'linhas com valor negativo tiveram')} o sentido invertido (marcada${resultado.invertidas === 1 ? '' : 's'} com uma barra azul).`);
    if (resultado.incertas) avisos.push(`${resultado.incertas} ${plural(resultado.incertas, 'linha tem', 'linhas têm')} nome com espaço e a separação entre pagador e recebedor foi deduzida (marcada${resultado.incertas === 1 ? '' : 's'} em amarelo). Confira.`);
    const aviso = fundo.querySelector('#impAviso');
    aviso.hidden = !avisos.length;
    aviso.innerHTML = avisos.map(esc).join('<br>');

    fundo.querySelector('#impErro').textContent = '';
    desenhar();
    fundo.hidden = false;
    fundo.querySelector('.imp-linha input, #impCancelar').focus();
  }

  /* ---------- API ---------- */
  const nomesAtuais = () => (obterNomesPadrao ? obterNomesPadrao() : []);
  const avisar = msg => { if (typeof aviso === 'function') aviso(msg); };

  function importarResultado(resultado) {
    if (!resultado || !resultado.linhas.length) {
      avisar('Não encontrei nenhuma transação válida.');
      return false;
    }
    abrir(resultado, callbackPadrao);
    return true;
  }

  function importarTexto(texto) {
    return importarResultado(interpretar(texto, nomesAtuais()));
  }

  // Ctrl+V nos campos do formulário: só intercepta se o texto parecer transações
  function ligar(campos, callback, obterNomes) {
    callbackPadrao = callback;
    obterNomesPadrao = obterNomes || null;
    campos.forEach(campo => {
      campo.addEventListener('paste', e => {
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        if (!texto) return;
        const resultado = interpretar(texto, nomesAtuais());
        if (!resultado.linhas.length) return;
        e.preventDefault();
        abrir(resultado, callbackPadrao);
      });
    });
  }

  // Campo próprio para colar: sempre trata o conteúdo e avisa se nada foi reconhecido
  function ligarCampoDedicado(input) {
    input.addEventListener('paste', e => {
      e.preventDefault();
      const texto = (e.clipboardData || window.clipboardData).getData('text');
      if (!texto || !texto.trim()) return avisar('A área de transferência está vazia.');
      importarTexto(texto);
      input.value = '';
    });
    input.addEventListener('input', () => { input.value = ''; }); // o campo serve apenas para colar
  }

  window.ImportarResumo = {
    ligar: ligar,
    ligarCampoDedicado: ligarCampoDedicado,
    importarTexto: importarTexto,
    importarResultado: importarResultado,
    interpretar: interpretar,
    construir: construir,
    lerValor: lerValor,
    nomesAtuais: nomesAtuais
  };
})();