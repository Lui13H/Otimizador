/**
 * excel.js — Exportar o resumo para Excel e importar planilhas (.xlsx)
 *
 * Depende de importar.js (ImportarResumo). A biblioteca ExcelJS é carregada da internet
 * só quando o usuário usa uma dessas funções.
 *
 * Planilha exportada: tabela com as colunas  Paga | Valor | Recebe  (nessa ordem, no topo),
 * com escala de cor condicional na coluna Valor: 0 = verde, meio = amarelo, maior dívida = vermelho.
 * Na importação, as colunas são localizadas pelo título no topo (Paga, Valor, Recebe).
 */
(function () {
  const URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
    'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
  ];
  let promessa = null;

  function injetar(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => { s.remove(); falha(new Error('falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  function carregarExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (!promessa) {
      promessa = URLS.reduce((p, u) => p.catch(() => injetar(u)), Promise.reject())
        .then(() => { if (!window.ExcelJS) throw new Error('vazio'); return window.ExcelJS; })
        .catch(() => {
          promessa = null;
          throw new Error('Não foi possível carregar a biblioteca do Excel. Verifique sua conexão e tente de novo.');
        });
    }
    return promessa;
  }

  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  /* ---------- Exportar ---------- */
  async function exportar(acertos) {
    const ExcelJS = await carregarExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Otimizador de Transações';
    const ws = wb.addWorksheet('Transferências');

    const linhas = acertos.map(a => [a.de, Number(a.valor), a.para]);
    ws.addTable({
      name: 'Transferencias',
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: false },
      columns: [{ name: 'Paga', filterButton: true }, { name: 'Valor', filterButton: true }, { name: 'Recebe', filterButton: true }],
      rows: linhas
    });

    const ultima = linhas.length + 1;
    for (let r = 2; r <= ultima; r++) {
      ws.getCell('B' + r).numFmt = '"R$" #,##0.00';
      ws.getCell('B' + r).alignment = { horizontal: 'right' };
    }
    ws.getColumn(1).width = Math.max(14, ...linhas.map(l => String(l[0]).length + 4));
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = Math.max(14, ...linhas.map(l => String(l[2]).length + 4));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Escala de cor: 0 → verde · mediana → amarelo · maior valor → vermelho
    ws.addConditionalFormatting({
      ref: 'B2:B' + ultima,
      rules: [{
        type: 'colorScale',
        cfvo: [{ type: 'num', value: 0 }, { type: 'percentile', value: 50 }, { type: 'max' }],
        color: [{ argb: 'FF63BE7B' }, { argb: 'FFFFEB84' }, { argb: 'FFF8696B' }]
      }]
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const hoje = new Date();
    const pad = n => String(n).padStart(2, '0');
    const nome = `transferencias-${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}.xlsx`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    return nome;
  }

  /* ---------- Importar ---------- */
  function textoCelula(v) {
    if (v == null) return '';
    if (v instanceof Date) return '';
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(t => t.text).join('').trim();
      if ('result' in v) return textoCelula(v.result);
      if (v.text !== undefined) return textoCelula(v.text);
      return '';
    }
    return String(v).trim();
  }

  function valorCelula(v) {
    if (v && typeof v === 'object' && 'result' in v) v = v.result;
    if (typeof v === 'number') return v;
    return ImportarResumo.lerValor(textoCelula(v));
  }

  async function lerXlsx(file) {
    const ExcelJS = await carregarExcelJS();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());

    for (const ws of wb.worksheets) {
      const limite = Math.min(ws.rowCount, 30);
      const colunas = Math.max(ws.columnCount, 3);
      for (let r = 1; r <= limite; r++) {
        const titulos = [];
        for (let c = 1; c <= colunas; c++) titulos.push(norm(textoCelula(ws.getRow(r).getCell(c).value)));
        const ip = titulos.findIndex(t => t === 'paga' || t === 'pagador') + 1;
        const iv = titulos.findIndex(t => t === 'valor') + 1;
        const ir = titulos.findIndex(t => t === 'recebe' || t === 'recebedor') + 1;
        if (!ip || !iv || !ir) continue;

        const itens = [], ignoradas = [];
        for (let k = r + 1; k <= ws.rowCount; k++) {
          const linha = ws.getRow(k);
          const p = textoCelula(linha.getCell(ip).value);
          const rec = textoCelula(linha.getCell(ir).value);
          const bruto = linha.getCell(iv).value;
          if (!p && !rec && (bruto == null || bruto === '')) continue; // linha em branco
          itens.push({ tipo: 'certa', p: p, r: rec, v: valorCelula(bruto), origem: 'Linha ' + k });
        }
        return ImportarResumo.construir(itens, ignoradas, ImportarResumo.nomesAtuais());
      }
    }
    throw new Error('Não encontrei as colunas "Paga", "Valor" e "Recebe" no topo da planilha.');
  }

  async function lerArquivo(file) {
    const nome = file.name.toLowerCase();
    if (/\.(xlsx|xlsm)$/.test(nome)) return lerXlsx(file);
    if (/\.(csv|tsv|txt)$/.test(nome)) return ImportarResumo.interpretar(await file.text(), ImportarResumo.nomesAtuais());
    if (/\.xls$/.test(nome)) throw new Error('O formato antigo .xls não é suportado. Salve a planilha como .xlsx e tente de novo.');
    throw new Error('Formato não suportado. Use um arquivo .xlsx.');
  }

  async function importarArquivo(file) {
    try {
      const resultado = await lerArquivo(file);
      ImportarResumo.importarResultado(resultado);
    } catch (e) {
      if (typeof aviso === 'function') aviso(e.message || 'Não foi possível ler o arquivo.');
    }
  }

  // botão + <input type=file> + área onde se pode soltar o arquivo
  function ligarImportacao(botao, inputArquivo, areaSoltar) {
    botao.addEventListener('click', () => inputArquivo.click());
    inputArquivo.addEventListener('change', () => {
      const f = inputArquivo.files[0];
      inputArquivo.value = '';
      if (f) importarArquivo(f);
    });
    if (!areaSoltar) return;
    ['dragenter', 'dragover'].forEach(ev => areaSoltar.addEventListener(ev, e => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); areaSoltar.classList.add('soltando'); }
    }));
    ['dragleave', 'drop'].forEach(ev => areaSoltar.addEventListener(ev, () => areaSoltar.classList.remove('soltando')));
    areaSoltar.addEventListener('drop', e => {
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      importarArquivo(f);
    });
  }

  window.ExcelTransacoes = { exportar: exportar, importarArquivo: importarArquivo, ligarImportacao: ligarImportacao };
})();