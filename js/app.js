    const $ = id => document.getElementById(id);
    const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtValorSimples = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = s => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const CHAVE = 'otimizador-transacoes';

    // Saldos por pessoa (em centavos), usados só para EXIBIR a lista de saldos.
    // As transferências continuam sendo calculadas pelo algorithm.js original.
    function consolidarSaldos(matriz) {
      const saldos = [];
      function ajustar(nome, valor) {
        const idx = saldos.findIndex(row => row[0] === nome);
        if (idx !== -1) saldos[idx][1] += valor; else saldos.push([nome, valor]);
      }
      for (let i = 0; i < matriz.length; i++) {
        const valor = Number(matriz[i][1]);
        ajustar(matriz[i][0], -valor);
        ajustar(matriz[i][2], valor);
      }
      return saldos.map(row => ({ nome: row[0], saldo: Math.round(row[1] * 100) }));
    }

    // Primeira letra de cada palavra em maiúscula ("ana  silva" → "Ana Silva")
    function capitalizarNome(nome) {
      return String(nome).trim().replace(/\s+/g, ' ').replace(/(^|\s)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
    }

    // O algorithm.js diferencia maiúsculas de minúsculas ("Ana" ≠ "ana").
    // Para evitar duas pessoas "iguais", reaproveita a grafia já cadastrada.
    function nomeCanonico(nome) {
      const n = capitalizarNome(nome);
      const achou = consolidarSaldos(transacoes).find(p => p.nome.toLowerCase() === n.toLowerCase());
      return achou ? achou.nome : n;
    }

    let transacoes = [];   // matriz [pagador, valor, recebedor]
    let editando = -1;
    let ultimaExcluida = null;

    let notaExtra = '', iniciado = false;

    // Transações ainda não pagas: só elas entram nos saldos e no algoritmo
    const ativas = () => transacoes.filter(t => !t[3]);
    const calcularAcertos = () => otimizarTransacoesMatriz(ativas().map(t => [t[0], t[1], t[2]]));

    // Todas as pessoas aparecem; o saldo considera apenas as transações não pagas
    function saldosExibicao() {
      const abertos = consolidarSaldos(ativas());
      return consolidarSaldos(transacoes).map(p => {
        const a = abertos.find(x => x.nome === p.nome);
        return { nome: p.nome, saldo: a ? a.saldo : 0 };
      });
    }

    // Transferências já pagas (chave = pagador→recebedor→centavos), lembradas no navegador
    const CHAVE_PAGOS = 'otimizador-pagos';
    let pagos = new Set();
    let acertosAtuais = [];
    try { pagos = new Set(JSON.parse(localStorage.getItem(CHAVE_PAGOS)) || []); } catch (e) { pagos = new Set(); }
    const chaveAcerto = a => a.de + '→' + a.para + '→' + Math.round(a.valor * 100);
    let toastTimer;

    try { transacoes = JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { transacoes = []; }
    transacoes = transacoes.map(t => [capitalizarNome(t[0]), t[1], capitalizarNome(t[2]), !!t[3]]);; // nomes salvos antes em minúsculas

    const ICONES = {
      editar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
      excluir: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'
    };

    function avatar(nome) {
      let h = 0;
      for (const ch of nome.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
      const hue = 200 + (h % 90);
      const ini = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      return `<span class="avatar" style="background:hsl(${hue} 65% 45%)">${esc(ini)}</span>`;
    }

    function aviso(msg, acao, rotulo) {
      if (notaExtra) { msg = (msg + ' ' + notaExtra).trim(); notaExtra = ''; }
      $('toastMsg').textContent = msg;
      const b = $('toastBtn');
      b.hidden = !acao;
      if (acao) { b.textContent = rotulo; b.onclick = () => { acao(); $('toast').classList.remove('on'); }; }
      $('toast').classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => $('toast').classList.remove('on'), 5000);
    }

    /* ---------- Renderização ---------- */
    function render() {
      try { localStorage.setItem(CHAVE, JSON.stringify(transacoes)); } catch (e) { }

      const saldos = saldosExibicao().sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome));
      const acertos = calcularAcertos();
      acertosAtuais = acertos;
      // Mantém como "pagas" só as transferências que ainda existem no resultado
      const chavesAtuais = acertos.map(chaveAcerto);
      const antes = pagos.size;
      pagos = new Set([...pagos].filter(k => chavesAtuais.includes(k)));
      const descartadas = antes - pagos.size;
      if (descartadas > 0 && iniciado) {
        notaExtra = `${descartadas} ${descartadas === 1 ? 'marcação de pago nas Transações Mínimas foi descartada' : 'marcações de pago nas Transações Mínimas foram descartadas'} porque o cálculo mudou.`;
        // se nenhum aviso() for chamado logo após o render, mostra a nota sozinha
        queueMicrotask(() => { if (notaExtra) aviso(''); });
      }
      try { localStorage.setItem(CHAVE_PAGOS, JSON.stringify([...pagos])); } catch (e) { }

      $('sTrans').textContent = transacoes.length;
      $('sPessoas').textContent = saldos.length;
      $('sAcertos').textContent = acertos.length;


      $('listaTrans').innerHTML = transacoes.length ? transacoes.map((t, i) => `
    <li class="item${t[3] ? ' pago' : ''}">
      <input type="checkbox" class="pagar" data-pagar-reg="${i}" ${t[3] ? 'checked' : ''} aria-label="Marcar como paga a transação ${i + 1}: ${esc(t[0])} deve a ${esc(t[2])}" title="${t[3] ? 'Desmarcar como paga' : 'Marcar como paga (sai dos saldos e das Transações Mínimas)'}">
      <span class="txt"><strong>${esc(t[0])}</strong><em>deve a</em><strong>${esc(t[2])}</strong></span>
      <span class="valor-col"><span class="valor">${brl(Math.round(t[1] * 100))}</span>${t[3] ? '<small class="selo-pago">Pago</small>' : ''}</span>
      <button class="icone" data-edit="${i}" aria-label="Editar transação ${i + 1}" title="Editar">${ICONES.editar}</button>
      <button class="icone del" data-del="${i}" aria-label="Excluir transação ${i + 1}" title="Excluir">${ICONES.excluir}</button>
    </li>`).join('') :
        `<li class="vazio"><b>Nenhuma transação ainda</b>Preencha o formulário para começar.<br><button class="btn" type="button" onclick="carregarExemplo()">Ver um exemplo</button></li>`;

      $('listaAcertos').innerHTML = acertos.length ? acertos.map((a, i) => {
        const pago = pagos.has(chaveAcerto(a)); return `
    <li class="item${pago ? ' pago' : ''}">
      <input type="checkbox" class="pagar" data-pagar="${i}" ${pago ? 'checked' : ''} aria-label="Marcar como pago: ${esc(a.de)} para ${esc(a.para)}" title="${pago ? 'Desmarcar pagamento' : 'Marcar como pago'}">
      <div class="acerto">
        ${avatar(a.de)}
        <span class="nome">${esc(a.de)}<small>paga</small></span>
        <span class="seta" aria-hidden="true">→</span>
        ${avatar(a.para)}
        <span class="nome">${esc(a.para)}<small>recebe</small></span>
      </div>
      <span class="valor-col"><span class="valor pos">${brl(Math.round(a.valor * 100))}</span>${pago ? '<small class="selo-pago">Pago</small>' : ''}</span>
    </li>`;
      }).join('') :
        `<li class="vazio"><b>${transacoes.length ? 'Tudo quitado!' : 'Aguardando transações'}</b>${transacoes.length ? 'Nenhuma transferência é necessária.' : 'Assim que você registrar a primeira, o resultado aparece aqui.'}</li>`;

      $('cabAcoes').hidden = !acertos.length;
      $('cabTransAcoes').hidden = !transacoes.length;
      const abertas = ativas().length;
      const eco = abertas - acertos.length;
      $('economia').hidden = !(acertos.length && eco > 0);
      $('economia').textContent = `Você reduziu de ${abertas} para ${acertos.length} transferências (${eco} a menos).`;

      const max = Math.max(1, ...saldos.map(p => Math.abs(p.saldo)));
      $('listaSaldos').innerHTML = saldos.length ? saldos.map(p => {
        const cls = p.saldo > 0 ? 'pos' : p.saldo < 0 ? 'neg' : 'zero';
        const tag = p.saldo > 0 ? 'recebe' : p.saldo < 0 ? 'paga' : 'quitado';
        const cor = p.saldo > 0 ? 'var(--pos)' : 'var(--neg)';
        return `<li class="item">${avatar(p.nome)}
      <div class="saldo">
        <div class="topo"><strong>${esc(p.nome)}</strong>
          <span><span class="tag ${cls}">${tag}</span> <span class="valor ${cls}">${brl(Math.abs(p.saldo))}</span></span></div>
        <div class="barra"><i style="width:${Math.abs(p.saldo) / max * 100}%;background:${cor}"></i></div>
      </div></li>`;
      }).join('') : `<li class="vazio">Os saldos aparecem aqui depois da primeira transação.</li>`;
    }

    /* ---------- Formulário ---------- */
    function atualizarPrevia() {
      const p = $('pagador').value.trim(), r = $('recebedor').value.trim(), v = parseFloat($('valor').value);
      $('previa').innerHTML = (p && r && v > 0)
        ? `<strong>${esc(p)}</strong> deve <strong>${brl(Math.round(v * 100))}</strong> a <strong>${esc(r)}</strong>`
        : 'Preencha os campos para ver o resumo da transação.';
    }
    ['pagador', 'recebedor', 'valor'].forEach(id => $(id).addEventListener('input', () => { $('erro').textContent = ''; avisarMesmaPessoa(); atualizarPrevia(); }));

    function avisarMesmaPessoa() {
      const p = $('pagador').value.trim().toLowerCase(), r = $('recebedor').value.trim().toLowerCase();
      if (p && p === r) $('erro').textContent = 'Pagador e recebedor devem ser pessoas diferentes.';
    }

    /* Campos fixados (pin) mantêm o valor ao adicionar outra transação */
    const CAMPOS = ['pagador', 'recebedor', 'valor'];
    const PINS = new Set();

    function atualizarPins() {
      CAMPOS.forEach(id => {
        const fixo = PINS.has(id);
        const b = document.querySelector(`[data-pin="${id}"]`);
        b.setAttribute('aria-pressed', String(fixo));
        b.title = fixo ? 'Desafixar' : 'Fixar (mantém o valor ao adicionar outra)';
        $(id).closest('.campo').classList.toggle('fixado', fixo);
      });
    }

    function limparNaoFixados() {
      CAMPOS.forEach(id => { if (!PINS.has(id)) $(id).value = ''; });
    }

    function focarProximo() {
      $(CAMPOS.find(id => !PINS.has(id)) || 'valor').focus();
    }

    document.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.pin;
      if (PINS.has(id)) PINS.delete(id); else PINS.add(id);
      atualizarPins();
    }));
    atualizarPins();

    function sairDaEdicao() {
      editando = -1;
      limparNaoFixados();
      $('tituloForm').textContent = 'Registrar transação';
      $('btnSalvar').textContent = 'Adicionar transação';
      $('btnCancelar').hidden = true;
      atualizarPrevia();
    }

    $('form').addEventListener('submit', e => {
      e.preventDefault();
      const p = $('pagador').value.trim(), r = $('recebedor').value.trim(), v = parseFloat($('valor').value);
      if (!p || !r) return erro('Informe o pagador e o recebedor.', !p ? 'pagador' : 'recebedor');
      if (!(v > 0)) return erro('Informe um valor maior que zero.', 'valor');
      if (p.toLowerCase() === r.toLowerCase()) return erro('Pagador e recebedor devem ser pessoas diferentes.', 'recebedor');

            if (editando === -1) { transacoes.push([nomeCanonico(p), v, nomeCanonico(r), false]); aviso('Transação adicionada.'); const nova = transacoes[transacoes.length - 1]; if (window.AnimacaoTransacao) AnimacaoTransacao.mostrar({ de: nova[0], para: nova[2], valor: nova[1] }); }
      else { transacoes[editando] = [nomeCanonico(p), v, nomeCanonico(r), !!transacoes[editando][3]]; aviso('Transação atualizada.'); }
      sairDaEdicao();
      render();
      focarProximo();
    });

    function erro(msg, campo) { $('erro').textContent = msg; $(campo).focus(); }

    $('btnCancelar').addEventListener('click', sairDaEdicao);

    /* ---------- Modal de confirmação ---------- */
    let acaoConfirmar = null, focoAnterior = null;

    function abrirModal({ titulo, texto, rotulo, aoConfirmar }) {
      acaoConfirmar = aoConfirmar;
      focoAnterior = document.activeElement;
      $('modalTitulo').textContent = titulo;
      $('modalTexto').innerHTML = texto;
      $('modalConfirmar').textContent = rotulo;
      $('modal').hidden = false;
      $('modalCancelar').focus();
    }

    function pedirExclusao(i) {
      const t = transacoes[i];
      abrirModal({
        titulo: 'Excluir transação?',
        texto: `Você está prestes a excluir a transação em que <strong>${esc(t[0])}</strong> deve <strong>${brl(Math.round(t[1] * 100))}</strong> a <strong>${esc(t[2])}</strong>. Os saldos e as transferências serão recalculados.`,
        rotulo: 'Confirmar exclusão',
        aoConfirmar: () => excluirTransacao(i)
      });
    }

    function pedirReinicio() {
      const n = transacoes.length;
      abrirModal({
        titulo: 'Excluir todos os dados?',
        texto: `Você está prestes a apagar <strong>${n} transaç${n === 1 ? 'ão' : 'ões'}</strong>, todos os saldos e as confirmações de pagamento. Tem certeza de que deseja recomeçar do zero?`,
        rotulo: 'Excluir tudo',
        aoConfirmar: reiniciarTudo
      });
    }

    function fecharModal() {
      $('modal').hidden = true;
      acaoConfirmar = null;
      if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    }

    function excluirTransacao(i) {
      ultimaExcluida = { linha: transacoes[i], i };
      transacoes.splice(i, 1);
      if (editando !== -1) sairDaEdicao();
      render();
      aviso('Transação removida.', () => { transacoes.splice(ultimaExcluida.i, 0, ultimaExcluida.linha); render(); }, 'Desfazer');
    }

    $('modalX').addEventListener('click', fecharModal);
    $('modalCancelar').addEventListener('click', fecharModal);
    $('modal').addEventListener('click', e => { if (e.target === $('modal')) fecharModal(); });
    $('modalConfirmar').addEventListener('click', () => {
      const acao = acaoConfirmar;
      fecharModal();
      if (acao) acao();
    });
    document.addEventListener('keydown', e => {
      if ($('modal').hidden) return;
      if (e.key === 'Escape') return fecharModal();
      if (e.key === 'Tab') { // mantém o foco dentro do modal
        const foco = [$('modalX'), $('modalCancelar'), $('modalConfirmar')];
        const pos = foco.indexOf(document.activeElement);
        const prox = e.shiftKey ? (pos <= 0 ? foco.length - 1 : pos - 1) : (pos + 1) % foco.length;
        e.preventDefault();
        foco[prox].focus();
      }
    });

    /* ---------- Ações da lista ---------- */
    $('listaTrans').addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) {
        const i = +ed.dataset.edit, t = transacoes[i];
        editando = i;
        $('pagador').value = t[0]; $('valor').value = t[1]; $('recebedor').value = t[2];
        $('tituloForm').textContent = `Editando transação ${i + 1}`;
        $('btnSalvar').textContent = 'Salvar alterações';
        $('btnCancelar').hidden = false;
        atualizarPrevia();
        $('pagador').focus();
        $('form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (del) pedirExclusao(+del.dataset.del);
    });

        $('listaTrans').addEventListener('change', e => {
      const cb = e.target.closest('[data-pagar-reg]');
      if (!cb) return;
      const i = +cb.dataset.pagarReg, t = transacoes[i];
      if (!t) return;
      t[3] = cb.checked;
      aviso(cb.checked
        ? 'Transação marcada como paga. Ela saiu dos saldos e das Transações Mínimas.'
        : 'Transação voltou para os saldos e para as Transações Mínimas.');
      render();
      const novo = document.querySelector(`[data-pagar-reg="${i}"]`);
      if (novo) novo.focus();
    });

    /* ---------- Confirmar pagamento ---------- */
    $('listaAcertos').addEventListener('change', e => {
      const cb = e.target.closest('[data-pagar]');
      if (!cb) return;
      const i = +cb.dataset.pagar, a = acertosAtuais[i];
      if (!a) return;
      if (cb.checked) pagos.add(chaveAcerto(a)); else pagos.delete(chaveAcerto(a));
      render();
      const novo = document.querySelector(`[data-pagar="${i}"]`);
      if (novo) novo.focus();
      if (cb.checked) {
        const mostrou = window.AnimacaoTransacao && AnimacaoTransacao.confirmar({ de: a.de, para: a.para, valor: a.valor });
        if (!mostrou) aviso('Transferência marcada como paga.');
      } else {
        aviso('Pagamento desmarcado.');
      }
    });

    /* ---------- Topo ---------- */
    function carregarExemplo() {
      if (editando !== -1) sairDaEdicao();
       transacoes = [
  ['João Arthur', 14.41, 'Caio'],
  ['João Arthur', 14.18, 'LuisH'],
  ['LuisH', 4.07, 'Caio'],
  ['Pedro', 4.07, 'Caio'],
  ['LuisH', 8.00, 'Caio'],
  ['Pedro', 5.67, 'LuisH'],
  ['Caio', 5.67, 'LuisH'],
  ['LuisH', 5.00, 'Caio'],
  ['LuisH', 7.50, 'Samuel'],
  ['LuisH', 28.59, 'João Arthur'],
  ['Caio', 27.65, 'LuisH'],
  ['LuisH', 7.20, 'Caio'],
  ['Caio', 5.35, 'LuisH'],
  ['Pedro', 7.87, 'LuisH'],
  ['Caio', 7.87, 'LuisH'],
  ['Edilson', 10.00, 'LuisH'],
  ['LuisH', 10.00, 'Edilson'],
  ['LuisH', 6.00, 'Caio'],
  ['Pedro', 6.00, 'Caio'],
  ['LuisH', 7.50, 'Caio'],
  ['Caio', 5.50, 'LuisH'],
  ['LuisH', 4.93, 'Caio'],
  ['Pedro', 4.93, 'Caio'],
  ['Caio', 4.51, 'LuisH'],
  ['Pedro', 4.51, 'LuisH'],
  ['Caio', 2.36, 'LuisH'],
  ['João Arthur', 9.00, 'LuisH'],
  ['Samuel', 19.30, 'LuisH'],
  ['LuisH', 1.56, 'Caio'],
  ['João Arthur', 15.99, 'Caio'],
  ['Samuel', 5.56, 'Caio'],
  ['Alisson', 4.84, 'Caio'],
  ['Caio', 3.66, 'LuisH'],
  ['Pedro', 3.66, 'LuisH']
];
      render();
      aviso('Exemplo carregado.');
    }

    function pedirExemplo() {
      if (!transacoes.length) return carregarExemplo();
      const n = transacoes.length;
      abrirModal({
        titulo: 'Carregar exemplo?',
        texto: `Isso vai substituir as <strong>${n} transaç${n === 1 ? 'ão' : 'ões'}</strong> atuais pelo exemplo. Tem certeza de que deseja continuar?`,
        rotulo: 'Carregar exemplo',
        aoConfirmar: carregarExemplo
      });
    }
    $('btnExemplo').addEventListener('click', pedirExemplo);

    function reiniciarTudo() {
      const backup = transacoes.slice();
      const backupPagos = new Set(pagos);
      transacoes = [];
      sairDaEdicao();
      render();
      aviso('Tudo foi reiniciado.', () => { transacoes = backup; pagos = backupPagos; render(); }, 'Desfazer');
    }

    $('btnLimpar').addEventListener('click', () => {
      if (transacoes.length) pedirReinicio();
    });

    $('btnCopiar').addEventListener('click', () => {
      const acertos = calcularAcertos();
      if (!acertos.length) return aviso('Não há transferências para copiar.');
      CopiarModal.abrir({
        titulo: 'Copiar Transações Mínimas',
        qtd: acertos.length,
        textoIntuitivo: acertos.map(a => `${a.de} paga → ${a.para} recebe: ${brl(Math.round(a.valor * 100))}`).join('\n'),
        textoExcel: acertos.map(a => `${a.de}\t${fmtValorSimples(a.valor)}\t${a.para}`).join('\n')
      });
    });

    /* ---------- Sugestão de nomes ---------- */
    const nomesExistentes = () => consolidarSaldos(transacoes).map(p => p.nome).sort((a, b) => a.localeCompare(b));
    AutocompleteNomes.ligar($('pagador'), nomesExistentes, () => $('recebedor').value);
    AutocompleteNomes.ligar($('recebedor'), nomesExistentes, () => $('pagador').value);

    /* ---------- Importar resumo colado ---------- */
    ImportarResumo.ligar([$('pagador'), $('recebedor'), $('valor')], linhas => {
      linhas.forEach(l => transacoes.push([nomeCanonico(l.pagador), l.valor, nomeCanonico(l.recebedor), !!l.pago]));
      render();
      aviso(linhas.length === 1 ? '1 transação adicionada.' : `${linhas.length} transações adicionadas.`);
    }, nomesExistentes);
    ImportarResumo.ligarCampoDedicado($('colar'));
    ExcelTransacoes.ligarImportacao($('btnImportarExcel'), $('arquivoExcel'), $('colar'));

    /* ---------- Dividir conta em grupo ---------- */
    ContaConjunta.ligar(nomesExistentes, ({ pagador, partes }) => {
      const pagadorNome = nomeCanonico(pagador);
      partes.forEach(p => transacoes.push([nomeCanonico(p.nome), p.valor, pagadorNome, false]));
      render();
      aviso(partes.length === 1 ? '1 transação adicionada.' : `${partes.length} transações adicionadas.`);
    });
    $('btnDividirConta').addEventListener('click', () => ContaConjunta.abrir());

    $('btnCopiarTrans').addEventListener('click', () => {
      if (!transacoes.length) return aviso('Não há transações para copiar.');
      CopiarModal.abrir({
        titulo: 'Copiar Transações Registradas',
        qtd: transacoes.length,
        textoIntuitivo: transacoes.map(t => `${t[0]} paga → ${t[2]} recebe: ${brl(Math.round(t[1] * 100))}`).join('\n'),
        textoExcel: transacoes.map(t => `${t[0]}\t${fmtValorSimples(t[1])}\t${t[2]}\t${t[3] ? 'Sim' : 'Não'}`).join('\n')
      });
    });

    async function gerarPlanilha(linhas, prefixo) {
      aviso('Gerando planilha…');
      try { const nome = await ExcelTransacoes.exportar(linhas, prefixo); aviso('Planilha exportada: ' + nome); }
      catch (e) { aviso(e.message || 'Não foi possível exportar a planilha.'); }
    }

    $('btnExportarTrans').addEventListener('click', () => {
      if (!transacoes.length) return aviso('Não há transações para exportar.');
      const pendentes = ativas();
      ExportarModal.abrir({
        titulo: 'Exportar Transações registradas',
        unidade: ['transação', 'transações'],
        total: transacoes.length,
        pendentes: pendentes.length,
        aoEscolher: modo => {
          const base = modo === 'pendentes' ? pendentes : transacoes;
          gerarPlanilha(base.map(t => [t[0], Number(t[1]), t[2], t[3] ? 'Sim' : 'Não']),
            modo === 'pendentes' ? 'transacoes-pendentes' : 'transacoes');
        }
      });
    });

    $('btnExportar').addEventListener('click', () => {
      const acertos = calcularAcertos();
      if (!acertos.length) return aviso('Não há transferências para exportar.');
      const pendentes = acertos.filter(a => !pagos.has(chaveAcerto(a)));
      ExportarModal.abrir({
        total: acertos.length,
        pendentes: pendentes.length,
        aoEscolher: modo => {
          const base = modo === 'pendentes' ? pendentes : acertos;
          gerarPlanilha(base.map(a => [a.de, Number(a.valor), a.para, pagos.has(chaveAcerto(a)) ? 'Sim' : 'Não']),
            modo === 'pendentes' ? 'transferencias-pendentes' : 'transferencias');
        }
      });
    });

    render();
    iniciado = true;