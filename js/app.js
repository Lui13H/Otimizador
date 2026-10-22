    const $ = id => document.getElementById(id);
    const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtValorSimples = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = s => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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

    // Classifica o % de redução (registradas → mínimas) numa escala de impacto
    function classificarGanho(pct) {
      if (pct < 15) return { rotulo: 'Imperceptível', classe: 'ganho-0' };
      if (pct < 30) return { rotulo: 'Moderada', classe: 'ganho-1' };
      if (pct < 50) return { rotulo: 'Média', classe: 'ganho-2' };
      if (pct < 70) return { rotulo: 'Boa', classe: 'ganho-3' };
      if (pct < 90) return { rotulo: 'Ótima', classe: 'ganho-4' };
      return { rotulo: 'Imprescindível', classe: 'ganho-5' };
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
    let filtroTrans = '', filtroAcertos = '';
    let ordemTrans = 'padrao', ordemAcertos = 'padrao';

    const OPCOES_ORDEM = [
      { valor: 'padrao', rotulo: 'Padrão', desc: 'Como está, sem reordenar' },
      { valor: 'nome', rotulo: 'Nome (A-Z)', desc: 'Ordem alfabética' },
      { valor: 'valor-desc', rotulo: 'Valor (maior primeiro)' },
      { valor: 'valor-asc', rotulo: 'Valor (menor primeiro)' },
      { valor: 'recente', rotulo: 'Mais recente primeiro', desc: 'Inverte a ordem atual' }
    ];

    // Recebe pares [item, índiceOriginal] já filtrados e devolve na ordem escolhida
    function aplicarOrdem(pares, ordem, pegaNome, pegaValor) {
      const arr = pares.slice();
      if (ordem === 'nome') arr.sort((a, b) => semAcento(pegaNome(a[0])).localeCompare(semAcento(pegaNome(b[0]))));
      else if (ordem === 'valor-desc') arr.sort((a, b) => pegaValor(b[0]) - pegaValor(a[0]));
      else if (ordem === 'valor-asc') arr.sort((a, b) => pegaValor(a[0]) - pegaValor(b[0]));
      else if (ordem === 'recente') arr.reverse();
      return arr;
    }

    // Quanto ainda falta de uma transação (valor menos o que já foi pago parcialmente)
    const restante = t => Math.max(0, t[1] - (t[4] || 0));

    // Transações ainda não pagas: só elas entram nos saldos e no algoritmo
    const ativas = () => transacoes.filter(t => !t[3]);
    const calcularAcertos = () => otimizarTransacoesMatriz(ativas().map(t => [t[0], restante(t), t[2]]));

    // Todas as pessoas aparecem; o saldo considera apenas as transações não pagas (pelo valor restante)
    function saldosExibicao() {
      const abertos = consolidarSaldos(ativas().map(t => [t[0], restante(t), t[2]]));
      return consolidarSaldos(transacoes).map(p => {
        const a = abertos.find(x => x.nome === p.nome);
        return { nome: p.nome, saldo: a ? a.saldo : 0 };
      });
    }

    // Transferências já pagas, inteiras ou em parte (chave = pagador→recebedor→centavos → valor já pago), lembradas no navegador
    const CHAVE_PAGOS = 'otimizador-pagos';
    let pagos = new Map();
    let acertosAtuais = [];
    try { pagos = new Map(JSON.parse(localStorage.getItem(CHAVE_PAGOS)) || []); } catch (e) { pagos = new Map(); }
    const chaveAcerto = a => a.de + '→' + a.para + '→' + Math.round(a.valor * 100);
    const acertoValorPago = a => Math.min(pagos.get(chaveAcerto(a)) || 0, a.valor);
    const acertoPagoCompleto = a => acertoValorPago(a) >= a.valor - 0.005;
    let toastTimer;

    try { transacoes = JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { transacoes = []; }
    transacoes = transacoes.map(t => [capitalizarNome(t[0]), t[1], capitalizarNome(t[2]), !!t[3], Number(t[4]) || 0]); // nomes salvos antes em minúsculas

    const ICONES = {
      editar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
      excluir: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
      parcial: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'
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
      // Se o pagamento parcial de uma transação já cobre o valor inteiro, completa sozinho
      transacoes.forEach(t => {
        if (!t[3] && (t[4] || 0) >= t[1] - 0.005) { t[3] = true; t[4] = t[1]; }
      });
      try { localStorage.setItem(CHAVE, JSON.stringify(transacoes)); } catch (e) { }

      const saldos = saldosExibicao().sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome));
      const acertos = calcularAcertos();
      acertosAtuais = acertos;
      // Mantém os pagamentos (inteiros ou parciais) só das transferências que ainda existem no resultado
      const chavesAtuais = new Set(acertos.map(chaveAcerto));
      const antes = pagos.size;
      for (const k of [...pagos.keys()]) if (!chavesAtuais.has(k)) pagos.delete(k);
      const descartadas = antes - pagos.size;
      if (descartadas > 0 && iniciado) {
        notaExtra = `${descartadas} ${descartadas === 1 ? 'marcação de pagamento nas Transações Mínimas foi descartada' : 'marcações de pagamento nas Transações Mínimas foram descartadas'} porque o cálculo mudou.`;
        // se nenhum aviso() for chamado logo após o render, mostra a nota sozinha
        queueMicrotask(() => { if (notaExtra) aviso(''); });
      }
      try { localStorage.setItem(CHAVE_PAGOS, JSON.stringify([...pagos])); } catch (e) { }

      $('sTrans').textContent = transacoes.length;
      $('sPessoas').textContent = saldos.length;
      $('sAcertos').textContent = acertos.length;


      const buscaTrans = semAcento(filtroTrans.trim());
      const transFiltradas = aplicarOrdem(
        transacoes.map((t, i) => [t, i]).filter(([t]) => !buscaTrans || semAcento(t[0]).includes(buscaTrans) || semAcento(t[2]).includes(buscaTrans)),
        ordemTrans, t => t[0], t => t[1]
      );

      $('listaTrans').innerHTML = !transacoes.length
        ? `<li class="vazio"><b>Nenhuma transação ainda</b>Preencha o formulário para começar.<br><button class="btn" type="button" onclick="carregarExemplo()">Ver um exemplo</button></li>`
        : transFiltradas.length ? transFiltradas.map(([t, i]) => {
          const parcial = !t[3] && (t[4] || 0) > 0;
          return `
    <li class="item${t[3] ? ' pago' : ''}${parcial ? ' parcial' : ''}">
      <input type="checkbox" class="pagar" data-pagar-reg="${i}" ${t[3] ? 'checked' : ''} aria-label="Marcar como paga a transação ${i + 1}: ${esc(t[0])} deve a ${esc(t[2])}" title="${t[3] ? 'Desmarcar como paga' : 'Marcar como paga (sai dos saldos e das Transações Mínimas)'}">
      <span class="txt"><strong>${esc(t[0])}</strong><em>deve a</em><strong>${esc(t[2])}</strong></span>
      <span class="valor-col"><span class="valor">${brl(Math.round(t[1] * 100))}</span>${t[3] ? '<small class="selo-pago">Pago</small>' : (parcial ? `<small class="selo-parcial">${brl(Math.round(t[4] * 100))} de ${brl(Math.round(t[1] * 100))} pago</small>` : '')}</span>
      <button class="icone" data-parcial-reg="${i}" aria-label="Marcar pagamento parcial da transação ${i + 1}" title="Pagamento parcial">${ICONES.parcial}</button>
      <button class="icone" data-edit="${i}" aria-label="Editar transação ${i + 1}" title="Editar">${ICONES.editar}</button>
      <button class="icone del" data-del="${i}" aria-label="Excluir transação ${i + 1}" title="Excluir">${ICONES.excluir}</button>
    </li>`;
        }).join('') : `<li class="vazio">Nenhuma transação encontrada para "${esc(filtroTrans.trim())}".</li>`;

      const buscaAcertos = semAcento(filtroAcertos.trim());
      const acertosFiltrados = aplicarOrdem(
        acertos.map((a, i) => [a, i]).filter(([a]) => !buscaAcertos || semAcento(a.de).includes(buscaAcertos) || semAcento(a.para).includes(buscaAcertos)),
        ordemAcertos, a => a.de, a => a.valor
      );

      $('listaAcertos').innerHTML = !acertos.length
        ? `<li class="vazio"><b>${transacoes.length ? 'Tudo quitado!' : 'Aguardando transações'}</b>${transacoes.length ? 'Nenhuma transferência é necessária.' : 'Assim que você registrar a primeira, o resultado aparece aqui.'}</li>`
        : acertosFiltrados.length ? acertosFiltrados.map(([a, i]) => {
          const pago = acertoPagoCompleto(a);
          const valorPago = acertoValorPago(a);
          const parcial = !pago && valorPago > 0;
          return `
    <li class="item${pago ? ' pago' : ''}${parcial ? ' parcial' : ''}">
      <input type="checkbox" class="pagar" data-pagar="${i}" ${pago ? 'checked' : ''} aria-label="Marcar como pago: ${esc(a.de)} para ${esc(a.para)}" title="${pago ? 'Desmarcar pagamento' : 'Marcar como pago'}">
      <div class="acerto">
        ${avatar(a.de)}
        <span class="nome">${esc(a.de)}<small>paga</small></span>
        <span class="seta" aria-hidden="true">→</span>
        ${avatar(a.para)}
        <span class="nome">${esc(a.para)}<small>recebe</small></span>
      </div>
      <span class="valor-col"><span class="valor pos">${brl(Math.round(a.valor * 100))}</span>${pago ? '<small class="selo-pago">Pago</small>' : (parcial ? `<small class="selo-parcial">${brl(Math.round(valorPago * 100))} de ${brl(Math.round(a.valor * 100))} pago</small>` : '')}</span>
      <button class="icone" data-parcial="${i}" aria-label="Marcar pagamento parcial: ${esc(a.de)} para ${esc(a.para)}" title="Pagamento parcial">${ICONES.parcial}</button>
    </li>`;
        }).join('') : `<li class="vazio">Nenhuma transferência encontrada para "${esc(filtroAcertos.trim())}".</li>`;

      $('cabAcoes').hidden = !acertos.length;
      $('cabTransAcoes').hidden = !transacoes.length;
      $('buscaLinhaAcertos').hidden = !acertos.length;
      $('buscaLinhaTrans').hidden = !transacoes.length;
      const abertas = ativas().length;
      const eco = abertas - acertos.length;
      const ganhoPct = abertas > 0 ? Math.round((1 - acertos.length / abertas) * 100) : 0;
      const ganho = classificarGanho(ganhoPct);
      $('economia').hidden = !(acertos.length && eco > 0);
      $('economia').innerHTML = `Reduziu de ${abertas} para ${acertos.length} transferências (${eco} a menos, −${ganhoPct}%) <span class="selo-ganho ${ganho.classe}">${ganho.rotulo}</span>`;

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

      $('estatisticas').hidden = !transacoes.length;
      if (transacoes.length) {
        const maisRecebe = saldos[0] && saldos[0].saldo > 0 ? saldos[0] : null;
        const maisDeve = saldos[saldos.length - 1] && saldos[saldos.length - 1].saldo < 0 ? saldos[saldos.length - 1] : null;
        $('statMaisDeve').textContent = maisDeve ? `${maisDeve.nome} · ${brl(Math.abs(maisDeve.saldo))}` : '—';
        $('statMaisRecebe').textContent = maisRecebe ? `${maisRecebe.nome} · ${brl(maisRecebe.saldo)}` : '—';
      }
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

            if (editando === -1) { transacoes.push([nomeCanonico(p), v, nomeCanonico(r), false, 0]); aviso('Transação adicionada.'); const nova = transacoes[transacoes.length - 1]; if (window.AnimacaoTransacao) AnimacaoTransacao.mostrar({ de: nova[0], para: nova[2], valor: nova[1] }); }
      else {
        const antigo = transacoes[editando];
        let pagoFlag = !!antigo[3], valorPagoFlag = antigo[4] || 0;
        if (valorPagoFlag >= v - 0.005) { pagoFlag = true; valorPagoFlag = v; } // valor editado ficou menor que o já pago: quita sozinho
        transacoes[editando] = [nomeCanonico(p), v, nomeCanonico(r), pagoFlag, valorPagoFlag];
        aviso('Transação atualizada.');
      }
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

    /* ---------- Busca nas listas ---------- */
    $('buscaTrans').addEventListener('input', () => { filtroTrans = $('buscaTrans').value; render(); });
    $('buscaAcertos').addEventListener('input', () => { filtroAcertos = $('buscaAcertos').value; render(); });

    /* ---------- Ordenar listas ---------- */
    $('btnOrdenarTrans').addEventListener('click', () => OrdenarModal.abrir({
      titulo: 'Ordenar Transações registradas',
      opcoes: OPCOES_ORDEM,
      atual: ordemTrans,
      aoEscolher: v => { ordemTrans = v; render(); }
    }));
    $('btnOrdenarAcertos').addEventListener('click', () => OrdenarModal.abrir({
      titulo: 'Ordenar Transações Mínimas',
      opcoes: OPCOES_ORDEM,
      atual: ordemAcertos,
      aoEscolher: v => { ordemAcertos = v; render(); }
    }));

    /* ---------- Ações da lista ---------- */
    $('listaTrans').addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), parc = e.target.closest('[data-parcial-reg]');
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
      if (parc) {
        const i = +parc.dataset.parcialReg, t = transacoes[i];
        if (!t) return;
        ParcialModal.abrir({
          titulo: 'Pagamento parcial',
          descricao: `<strong>${esc(t[0])}</strong> deve ${brl(Math.round(t[1] * 100))} a <strong>${esc(t[2])}</strong>`,
          valorTotal: t[1],
          valorAtual: t[4] || 0,
          aoConfirmar: valor => {
            if (valor <= 0) { t[4] = 0; aviso('Pagamento parcial removido.'); }
            else if (valor >= t[1] - 0.005) { t[3] = true; t[4] = t[1]; aviso('Transação marcada como paga.'); }
            else { t[4] = valor; t[3] = false; aviso('Pagamento parcial salvo.'); }
            render();
          }
        });
      }
    });

        $('listaTrans').addEventListener('change', e => {
      const cb = e.target.closest('[data-pagar-reg]');
      if (!cb) return;
      const i = +cb.dataset.pagarReg, t = transacoes[i];
      if (!t) return;
      t[3] = cb.checked;
      t[4] = cb.checked ? t[1] : 0;
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
      if (cb.checked) pagos.set(chaveAcerto(a), a.valor); else pagos.delete(chaveAcerto(a));
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

    $('listaAcertos').addEventListener('click', e => {
      const parc = e.target.closest('[data-parcial]');
      if (!parc) return;
      const i = +parc.dataset.parcial, a = acertosAtuais[i];
      if (!a) return;
      const chave = chaveAcerto(a);
      ParcialModal.abrir({
        titulo: 'Pagamento parcial',
        descricao: `<strong>${esc(a.de)}</strong> paga <strong>${esc(a.para)}</strong>`,
        valorTotal: a.valor,
        valorAtual: acertoValorPago(a),
        aoConfirmar: valor => {
          if (valor <= 0) { pagos.delete(chave); aviso('Pagamento parcial removido.'); }
          else if (valor >= a.valor - 0.005) { pagos.set(chave, a.valor); aviso('Transferência marcada como paga.'); }
          else { pagos.set(chave, valor); aviso('Pagamento parcial salvo.'); }
          render();
        }
      });
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
      const backupPagos = new Map(pagos);
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
      const n = acertos.length;
      const pago = acertoPagoCompleto;
      CopiarModal.abrir({
        titulo: 'Copiar Transações Mínimas',
        qtd: n,
        textoIntuitivo: acertos.map(a => `${a.de} paga → ${a.para} recebe: ${brl(Math.round(a.valor * 100))}${pago(a) ? ' (pago)' : ''}`).join('\n'),
        textoWhatsapp: `💸 *Transações Mínimas*\n\n${acertos.map(a => `• *${a.de}* paga *${a.para}*: ${brl(Math.round(a.valor * 100))}${pago(a) ? ' ✅ pago' : ''}`).join('\n')}\n\n_${n} ${n === 1 ? 'transferência' : 'transferências'} no total_`,
        textoExcel: acertos.map(a => `${a.de}\t${fmtValorSimples(a.valor)}\t${a.para}\t${pago(a) ? 'Sim' : 'Não'}`).join('\n')
      });
    });

    /* ---------- Sugestão de nomes ---------- */
    const nomesExistentes = () => consolidarSaldos(transacoes).map(p => p.nome).sort((a, b) => a.localeCompare(b));
    AutocompleteNomes.ligar($('pagador'), nomesExistentes, () => $('recebedor').value);
    AutocompleteNomes.ligar($('recebedor'), nomesExistentes, () => $('pagador').value);

    /* ---------- Importar resumo colado ---------- */
    ImportarResumo.ligar([$('pagador'), $('recebedor'), $('valor')], linhas => {
      linhas.forEach(l => transacoes.push([nomeCanonico(l.pagador), l.valor, nomeCanonico(l.recebedor), !!l.pago, l.pago ? l.valor : 0]));
      render();
      aviso(linhas.length === 1 ? '1 transação adicionada.' : `${linhas.length} transações adicionadas.`);
    }, nomesExistentes);
    ImportarResumo.ligarCampoDedicado($('colar'));
    ExcelTransacoes.ligarImportacao($('btnImportarExcel'), $('arquivoExcel'), $('colar'));

    /* ---------- Dividir conta em grupo ---------- */
    ContaConjunta.ligar(nomesExistentes, ({ pagador, partes }) => {
      const pagadorNome = nomeCanonico(pagador);
      partes.forEach(p => transacoes.push([nomeCanonico(p.nome), p.valor, pagadorNome, false, 0]));
      render();
      aviso(partes.length === 1 ? '1 transação adicionada.' : `${partes.length} transações adicionadas.`);
    });
    $('btnDividirConta').addEventListener('click', () => ContaConjunta.abrir());

    $('btnCopiarTrans').addEventListener('click', () => {
      if (!transacoes.length) return aviso('Não há transações para copiar.');
      const n = transacoes.length;
      CopiarModal.abrir({
        titulo: 'Copiar Transações Registradas',
        qtd: n,
        textoIntuitivo: transacoes.map(t => `${t[0]} paga → ${t[2]} recebe: ${brl(Math.round(t[1] * 100))}${t[3] ? ' (pago)' : ''}`).join('\n'),
        textoWhatsapp: `📋 *Transações Registradas*\n\n${transacoes.map(t => `• *${t[0]}* deve *${t[2]}*: ${brl(Math.round(t[1] * 100))}${t[3] ? ' ✅ pago' : ''}`).join('\n')}\n\n_${n} ${n === 1 ? 'transação' : 'transações'} no total_`,
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
      const pendentes = acertos.filter(a => !acertoPagoCompleto(a));
      ExportarModal.abrir({
        total: acertos.length,
        pendentes: pendentes.length,
        aoEscolher: modo => {
          const base = modo === 'pendentes' ? pendentes : acertos;
          gerarPlanilha(base.map(a => [a.de, Number(a.valor), a.para, acertoPagoCompleto(a) ? 'Sim' : 'Não']),
            modo === 'pendentes' ? 'transferencias-pendentes' : 'transferencias');
        }
      });
    });

    render();
    iniciado = true;