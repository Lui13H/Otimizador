/**
 * importar.js — Importa transações coladas (ou lidas de arquivo) para o formulário
 * (parte visual; só LÊ o algorithm.js — via otimizarTransacoesMatriz — para conferir
 * a tabela de Transações Mínimas colada junto. Nunca altera o algorithm.js.)
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
 * Três tabelas coladas juntas (como ao copiar do Excel várias seleções de uma vez,
 * separadas por uma coluna em branco) são reconhecidas automaticamente:
 *   - Transações registradas / Pendências (Paga/Valor/Recebe) → vira transação
 *   - Saldo Geral (Pessoa/Saldo)                              → só conferência
 *   - Transações Mínimas / Transferências (Paga/Valor/Recebe) → só conferência
 * O modal mostra, para cada uma das duas últimas, se ela bate com o que foi
 * importado da primeira — e onde está a diferença, quando não bate.
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
    .imp-conferencia{display:grid;gap:8px;margin:2px 0 8px}
    .imp-conf-item{padding:10px 12px;border-radius:12px;font-size:.82rem;line-height:1.55;border:1px solid var(--line);background:rgba(255,255,255,.03)}
    .imp-conf-item.ok{border-color:rgba(61,220,151,.35);background:rgba(61,220,151,.07);color:#bfe9d2}
    .imp-conf-item.erro{border-color:rgba(255,122,144,.45);background:rgba(255,122,144,.08);color:#ffd3db}
    .imp-conf-selo{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;font-size:.66rem;font-weight:800;margin-right:6px;vertical-align:-2px}
    .imp-conf-item.ok .imp-conf-selo{background:rgba(61,220,151,.28);color:#3ddc97}
    .imp-conf-item.erro .imp-conf-selo{background:rgba(255,122,144,.28);color:var(--neg)}
    .imp-conf-lista{margin:6px 0 0;padding-left:18px;color:var(--mut)}
    .imp-conf-lista li{margin:3px 0}

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
    const g = n.findIndex(c => c === 'pago');
    return p >= 0 && v >= 0 && r >= 0 ? { p: p, v: v, r: r, g: g } : null;
  }

  function detectarCabecalhoSaldo(celulas) {
    const n = celulas.map(norm);
    const p = n.findIndex(c => c === 'pessoa' || c === 'nome');
    const s = n.findIndex(c => c === 'saldo');
    return p >= 0 && s >= 0 ? { p: p, s: s } : null;
  }

  const vaziaCel = v => v === undefined || v === null || v === '' || (typeof v === 'string' && !v.trim());
  const ehSim = v => norm(v == null ? '' : v) === 'sim';

  /* ---------- Várias tabelas coladas juntas (separadas por coluna em branco) ---------- */
  // Texto colado → grade de células (linhas × colunas, por TAB)
  function paraGrade(texto) {
    return String(texto).replace(/\r/g, '').split('\n').map(l => l.split('\t').map(c => c.trim()));
  }

  // Blocos de colunas contíguas não totalmente vazias, separados por colunas em branco
  function blocosDeColunas(grade) {
    const maxCol = grade.reduce((m, l) => Math.max(m, l.length), 0);
    const blocos = [];
    let inicio = -1;
    for (let c = 0; c <= maxCol; c++) {
      const vazia = c === maxCol || grade.every(l => vaziaCel(l[c]));
      if (!vazia && inicio === -1) inicio = c;
      if (vazia && inicio !== -1) { blocos.push([inicio, c - 1]); inicio = -1; }
    }
    return blocos;
  }

  const subgrade = (grade, c0, c1) => grade.map(l => l.slice(c0, c1 + 1));

  // Acha o cabeçalho Paga/Valor/Recebe num bloco e lê as linhas de transação abaixo dele
  function linhasBrutasTransacoes(sub) {
    for (let r = 0; r < sub.length; r++) {
      const cab = detectarCabecalho(sub[r]);
      if (!cab) continue;
      const linhas = [];
      for (let k = r + 1; k < sub.length; k++) {
        const lin = sub[k];
        const p = String(lin[cab.p] || '').trim(), rec = String(lin[cab.r] || '').trim();
        const vbruto = lin[cab.v];
        if (!p && !rec && vaziaCel(vbruto)) continue; // linha em branco
        linhas.push({ pagador: p, recebedor: rec, valor: lerValor(vbruto), pago: cab.g >= 0 && ehSim(lin[cab.g]), origem: 'linha ' + (k + 1) });
      }
      return { linhas: linhas, headerRow: r };
    }
    return null;
  }

  // Acha o cabeçalho Pessoa/Saldo num bloco e lê as linhas abaixo dele
  function linhasDeSaldo(sub) {
    for (let r = 0; r < sub.length; r++) {
      const cab = detectarCabecalhoSaldo(sub[r]);
      if (!cab) continue;
      const linhas = [];
      for (let k = r + 1; k < sub.length; k++) {
        const lin = sub[k];
        const pessoa = String(lin[cab.p] || '').trim();
        const sbruto = lin[cab.s];
        if (!pessoa && vaziaCel(sbruto)) continue;
        if (!pessoa) continue;
        linhas.push({ pessoa: pessoa, saldo: lerValor(sbruto), origem: 'linha ' + (k + 1) });
      }
      return { linhas: linhas, headerRow: r };
    }
    return null;
  }

  // Usa o texto acima do cabeçalho do bloco pra saber se é "Transações registradas"
  // (pendências, a importar) ou "Transações Mínimas" (conferência, ex-"Transferências")
  function tituloDoBloco(sub, headerRow) {
    for (let r = 0; r < headerRow; r++) {
      const celula = sub[r].find(c => !vaziaCel(c));
      if (!celula) continue;
      const t = norm(celula);
      if (/pendenc|registrad/.test(t)) return 'pendencias';
      if (/minim|transferenc|paga quem/.test(t)) return 'minimas';
    }
    return null;
  }

  /**
   * Lê uma grade (linhas × colunas) em busca de tabelas de transações (Paga/Valor/Recebe)
   * e, quando há mais de uma tabela lado a lado, de uma tabela de saldo (Pessoa/Saldo).
   * Com apenas uma tabela, funciona como a leitura clássica (ex.: uma planilha só com
   * a tabela de transferências). Com duas ou mais, a primeira tabela de transações vira
   * "pendências" (o que será importado) e as demais viram conferência (resultado.verificacao).
   */
  function interpretarGrade(grade, nomesExtras, exigirMultiplo) {
    const blocos = blocosDeColunas(grade);
    if (!blocos.length) return null;

    if (blocos.length === 1) {
      if (exigirMultiplo) return null;
      const [c0, c1] = blocos[0];
      const t = linhasBrutasTransacoes(subgrade(grade, c0, c1));
      if (!t) return null;
      const itens = t.linhas.map(l => ({ tipo: 'certa', p: l.pagador, r: l.recebedor, v: l.valor, pago: l.pago, origem: l.origem }));
      return construir(itens, [], nomesExtras);
    }

    const transacoesBlocos = [];
    let saldoBloco = null;
    blocos.forEach(([c0, c1]) => {
      const sub = subgrade(grade, c0, c1);
      const t = linhasBrutasTransacoes(sub);
      if (t) { transacoesBlocos.push({ titulo: tituloDoBloco(sub, t.headerRow), dados: t }); return; }
      if (!saldoBloco) saldoBloco = linhasDeSaldo(sub);
    });
    if (!transacoesBlocos.length) return null;

    let pendBloco = transacoesBlocos.find(b => b.titulo === 'pendencias');
    let minBloco = transacoesBlocos.find(b => b.titulo === 'minimas');
    if (!pendBloco && !minBloco) { pendBloco = transacoesBlocos[0]; minBloco = transacoesBlocos[1] || null; }
    else if (!pendBloco) pendBloco = transacoesBlocos.find(b => b !== minBloco) || transacoesBlocos[0];
    else if (!minBloco) minBloco = transacoesBlocos.find(b => b !== pendBloco) || null;

    const itens = pendBloco.dados.linhas.map(l => ({ tipo: 'certa', p: l.pagador, r: l.recebedor, v: l.valor, pago: l.pago, origem: l.origem }));
    const resultado = construir(itens, [], nomesExtras);
    resultado.verificacao = (saldoBloco || minBloco) ? {
      saldoInformado: saldoBloco ? saldoBloco.linhas : null,
      minimasInformadas: minBloco ? minBloco.dados.linhas : null
    } : null;
    return resultado;
  }

  // Texto colado: tenta achar várias tabelas primeiro; sem isso, cai no leitor linha a linha
  function interpretarMultiplo(texto, nomesExtras) {
    return interpretarGrade(paraGrade(texto), nomesExtras, true);
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
      linhas.push({ pagador: p, recebedor: r, valor: Math.round(v * 100) / 100, incerta: incerta, invertida: invertida, pago: !!it.pago });
    });
    return { linhas: linhas, ignoradas: ignoradas, invertidas: invertidas, incertas: incertas };
  }

  function interpretar(texto, nomesExtras) {
    const itens = [], ignoradas = [];
    let mapa = null;
    const certa = (p, r, v, origem, pago) => itens.push({ tipo: 'certa', p: String(p || '').trim(), r: String(r || '').trim(), v: v, pago: !!pago, origem: origem });

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
        let ip, iv, ir, ig = -1;
        if (mapa && cel.length > Math.max(mapa.p, mapa.v, mapa.r)) { ip = mapa.p; iv = mapa.v; ir = mapa.r; ig = mapa.g; }
        else if (cel.length === 4 && ehNumero(cel[1]) && /^(sim|nao)$/.test(norm(cel[3]))) { ip = 0; iv = 1; ir = 2; ig = 3; } // Paga · Valor · Recebe · Pago
        else if (cel.length === 3 && ehNumero(cel[1])) { ip = 0; iv = 1; ir = 2; }        // Paga · Valor · Recebe
        else if (cel.length === 3 && ehNumero(cel[2])) { ip = 0; ir = 1; iv = 2; }        // Paga · Recebe · Valor
        else return ignoradas.push(l);
        return certa(cel[ip], cel[ir], lerValor(cel[iv]), l, ig >= 0 && ehSim(cel[ig]));
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

  // Tenta primeiro ler várias tabelas coladas juntas; sem isso, usa o leitor linha a linha
  function interpretarTexto(texto, nomesExtras) {
    return interpretarMultiplo(texto, nomesExtras) || interpretar(texto, nomesExtras);
  }

  /* ---------- Utilidades ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmtValor = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const plural = (n, um, varios) => (n === 1 ? um : varios);

  /* ---------- Conferência: Saldo Geral e Transações Mínimas ---------- */
  // Lê o algorithm.js (otimizarTransacoesMatriz), mas nunca o altera.
  function calcularSaldosNorm(linhas) {
    const saldos = {}, nomes = {};
    linhas.forEach(l => {
      [[l.pagador, -1], [l.recebedor, 1]].forEach(([nome, sinal]) => {
        const k = norm(nome);
        saldos[k] = (saldos[k] || 0) + sinal * l.valor;
        if (!nomes[k]) nomes[k] = nome;
      });
    });
    return { saldos: saldos, nomes: nomes };
  }

  function conferirSaldo(linhasPendencias, saldoInformado) {
    const calc = calcularSaldosNorm(linhasPendencias);
    const erros = [];
    const vistos = new Set();
    saldoInformado.forEach(it => {
      const k = norm(it.pessoa);
      vistos.add(k);
      if (!isFinite(it.saldo)) { erros.push(`${it.pessoa}: o saldo informado não pôde ser lido.`); return; }
      const esperado = Math.round((calc.saldos[k] || 0) * 100) / 100;
      if (Math.abs(esperado - it.saldo) > 0.01)
        erros.push(`${it.pessoa}: a tabela mostra ${fmtBRL(it.saldo)}, mas as transações somam ${fmtBRL(esperado)}.`);
    });
    Object.keys(calc.saldos).forEach(k => {
      if (!vistos.has(k) && Math.abs(calc.saldos[k]) > 0.01)
        erros.push(`${calc.nomes[k]}: está nas transações (saldo ${fmtBRL(calc.saldos[k])}) mas não aparece na tabela de saldo.`);
    });
    return { ok: !erros.length, erros: erros };
  }

  function conferirMinimas(linhasPendencias, minimasInformadas) {
    if (typeof window.otimizarTransacoesMatriz !== 'function')
      return { ok: false, erros: ['Não foi possível conferir: o algoritmo de cálculo não foi encontrado.'] };
    const esperado = window.otimizarTransacoesMatriz(linhasPendencias.map(l => [l.pagador, l.valor, l.recebedor]));
    const usados = new Set();
    const erros = [];
    minimasInformadas.forEach(inf => {
      if (!inf.pagador || !inf.recebedor || !isFinite(inf.valor)) {
        erros.push(`Linha com dados incompletos (${inf.origem || ''}).`);
        return;
      }
      const idx = esperado.findIndex((e, i) => !usados.has(i) && norm(e.de) === norm(inf.pagador) && norm(e.para) === norm(inf.recebedor));
      if (idx === -1) { erros.push(`${inf.pagador} → ${inf.recebedor}: essa transferência não deveria existir (ou o par pagador/recebedor está errado).`); return; }
      usados.add(idx);
      if (Math.abs(esperado[idx].valor - inf.valor) > 0.01)
        erros.push(`${inf.pagador} → ${inf.recebedor}: a tabela mostra ${fmtBRL(inf.valor)}, mas o valor correto é ${fmtBRL(esperado[idx].valor)}.`);
    });
    esperado.forEach((e, i) => { if (!usados.has(i)) erros.push(`Faltando: ${e.de} → ${e.para} (${fmtBRL(e.valor)}).`); });
    return { ok: !erros.length, erros: erros };
  }

  /* ---------- Modal ---------- */
  let fundo = null, dados = [], aoConfirmar = null, focoAnterior = null;
  let callbackPadrao = null, obterNomesPadrao = null, verificacaoAtual = null;

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
        <div class="imp-conferencia" id="impConferencia" hidden></div>
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
      atualizarVerificacao();
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

  function trechoConferencia(nome, r) {
    if (r.ok) return `<div class="imp-conf-item ok"><span class="imp-conf-selo">✓</span><strong>${esc(nome)}</strong> confere com as transações.</div>`;
    return `<div class="imp-conf-item erro"><span class="imp-conf-selo">✗</span><strong>${esc(nome)}</strong>: ${r.erros.length} ${plural(r.erros.length, 'divergência', 'divergências')}.
      <ul class="imp-conf-lista">${r.erros.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  }

  function linhasAtuaisParaVerificacao() {
    return dados
      .filter(d => !d.pago)
      .map(d => ({ pagador: d.pagador.trim(), recebedor: d.recebedor.trim(), valor: lerValor(d.valor) }))
      .filter(l => l.pagador && l.recebedor && isFinite(l.valor) && l.valor > 0);
  }

  function atualizarVerificacao() {
    const painel = fundo.querySelector('#impConferencia');
    if (!verificacaoAtual) { painel.hidden = true; painel.innerHTML = ''; return; }
    const linhas = linhasAtuaisParaVerificacao();
    const partes = [];
    if (verificacaoAtual.saldoInformado) partes.push(trechoConferencia('Saldo Geral', conferirSaldo(linhas, verificacaoAtual.saldoInformado)));
    if (verificacaoAtual.minimasInformadas) partes.push(trechoConferencia('Transações Mínimas', conferirMinimas(linhas, verificacaoAtual.minimasInformadas)));
    painel.hidden = !partes.length;
    painel.innerHTML = partes.join('');
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
    atualizarVerificacao();
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
      if (!problema) prontas.push({ pagador: p, recebedor: r, valor: Math.round(v * 100) / 100, pago: !!d.pago });
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
    verificacaoAtual = null;
    if (!confirmado && focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
  }

  function abrir(resultado, callback) {
    if (!fundo) criarFundo();
    aoConfirmar = callback;
    focoAnterior = document.activeElement;
    verificacaoAtual = resultado.verificacao || null;
    dados = resultado.linhas.map(l => ({
      pagador: l.pagador, recebedor: l.recebedor, valor: fmtValor(l.valor),
      incerta: !!l.incerta, invertida: !!l.invertida,
      pago: !!l.pago
    }));

    const n = dados.length;
    fundo.querySelector('#impSub').innerHTML =
      `Encontramos <strong>${n} ${plural(n, 'transação', 'transações')}</strong>. Revise, corrija o que precisar e confirme para adicioná-las de uma vez.`;

    const avisos = [];
    const ign = resultado.ignoradas.length;
    if (ign) avisos.push(`${ign} ${plural(ign, 'linha não foi reconhecida e foi ignorada', 'linhas não foram reconhecidas e foram ignoradas')}.`);
    if (resultado.invertidas) avisos.push(`${resultado.invertidas} ${plural(resultado.invertidas, 'linha com valor negativo teve', 'linhas com valor negativo tiveram')} o sentido invertido (marcada${resultado.invertidas === 1 ? '' : 's'} com uma barra azul).`);
    if (resultado.incertas) avisos.push(`${resultado.incertas} ${plural(resultado.incertas, 'linha tem', 'linhas têm')} nome com espaço e a separação entre pagador e recebedor foi deduzida (marcada${resultado.incertas === 1 ? '' : 's'} em amarelo). Confira.`);
    const pagas = resultado.linhas.filter(l => l.pago).length;
    if (pagas) avisos.push(`${pagas} ${plural(pagas, 'transação veio marcada como paga', 'transações vieram marcadas como pagas')} (coluna Pago) e ${plural(pagas, 'não entra', 'não entram')} nos saldos nem nas Transações Mínimas.`);
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
    return importarResultado(interpretarTexto(texto, nomesAtuais()));
  }

  // Ctrl+V nos campos do formulário: só intercepta se o texto parecer transações
  function ligar(campos, callback, obterNomes) {
    callbackPadrao = callback;
    obterNomesPadrao = obterNomes || null;
    campos.forEach(campo => {
      campo.addEventListener('paste', e => {
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        if (!texto) return;
        const resultado = interpretarTexto(texto, nomesAtuais());
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
    interpretarTexto: interpretarTexto,
    interpretarGrade: interpretarGrade,
    construir: construir,
    lerValor: lerValor,
    nomesAtuais: nomesAtuais,
    conferirSaldo: conferirSaldo,
    conferirMinimas: conferirMinimas
  };
})();