    const $ = id => document.getElementById(id);
    const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

    // Transferências já pagas (chave = pagador→recebedor→centavos), lembradas no navegador
    const CHAVE_PAGOS = 'otimizador-pagos';
    let pagos = new Set();
    let acertosAtuais = [];
    try { pagos = new Set(JSON.parse(localStorage.getItem(CHAVE_PAGOS)) || []); } catch (e) { pagos = new Set(); }
    const chaveAcerto = a => a.de + '→' + a.para + '→' + Math.round(a.valor * 100);
    let toastTimer;

    try { transacoes = JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { transacoes = []; }
    transacoes = transacoes.map(t => [capitalizarNome(t[0]), t[1], capitalizarNome(t[2])]); // nomes salvos antes em minúsculas

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

      const saldos = consolidarSaldos(transacoes).sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome));
      const acertos = otimizarTransacoesMatriz(transacoes);
      acertosAtuais = acertos;
      // Mantém como "pagas" só as transferências que ainda existem no resultado
      const chavesAtuais = acertos.map(chaveAcerto);
      pagos = new Set([...pagos].filter(k => chavesAtuais.includes(k)));
      try { localStorage.setItem(CHAVE_PAGOS, JSON.stringify([...pagos])); } catch (e) { }

      $('sTrans').textContent = transacoes.length;
      $('sPessoas').textContent = saldos.length;
      $('sAcertos').textContent = acertos.length;


      $('listaTrans').innerHTML = transacoes.length ? transacoes.map((t, i) => `
    <li class="item">
      <span class="txt"><strong>${esc(t[0])}</strong><em>deve a</em><strong>${esc(t[2])}</strong></span>
      <span class="valor">${brl(Math.round(t[1] * 100))}</span>
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
      const eco = transacoes.length - acertos.length;
      $('economia').hidden = !(acertos.length && eco > 0);
      $('economia').textContent = `Você reduziu de ${transacoes.length} para ${acertos.length} transferências (${eco} a menos).`;

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

      if (editando === -1) { transacoes.push([nomeCanonico(p), v, nomeCanonico(r)]); aviso('Transação adicionada.'); const nova = transacoes[transacoes.length - 1]; if (window.AnimacaoTransacao) AnimacaoTransacao.mostrar({ de: nova[0], para: nova[2], valor: nova[1] }); }
      else { transacoes[editando] = [nomeCanonico(p), v, nomeCanonico(r)]; aviso('Transação atualizada.'); }
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
      transacoes = [['Ana', 120, 'Bruno'], ['Bruno', 80, 'Carla'], ['Carla', 50, 'Ana'], ['Diego', 200, 'Ana'], ['Bruno', 35.5, 'Diego']];
      render();
      aviso('Exemplo carregado.');
    }
    $('btnExemplo').addEventListener('click', carregarExemplo);

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

    $('btnCopiar').addEventListener('click', async () => {
      const texto = otimizarTransacoesMatriz(transacoes)
        .map(a => `${a.de} → ${a.para}: ${brl(Math.round(a.valor * 100))}`).join('\n');
      try { await navigator.clipboard.writeText(texto); aviso('Resumo copiado. Cole onde quiser.'); }
      catch (e) { aviso('Não foi possível copiar automaticamente.'); }
    });

    /* ---------- Sugestão de nomes ---------- */
    const nomesExistentes = () => consolidarSaldos(transacoes).map(p => p.nome).sort((a, b) => a.localeCompare(b));
    AutocompleteNomes.ligar($('pagador'), nomesExistentes, () => $('recebedor').value);
    AutocompleteNomes.ligar($('recebedor'), nomesExistentes, () => $('pagador').value);

    /* ---------- Importar resumo colado ---------- */
    ImportarResumo.ligar([$('pagador'), $('recebedor'), $('valor')], linhas => {
      linhas.forEach(l => transacoes.push([nomeCanonico(l.pagador), l.valor, nomeCanonico(l.recebedor)]));
      render();
      aviso(linhas.length === 1 ? '1 transação adicionada.' : `${linhas.length} transações adicionadas.`);
    }, nomesExistentes);
    ImportarResumo.ligarCampoDedicado($('colar'));
    ExcelTransacoes.ligarImportacao($('btnImportarExcel'), $('arquivoExcel'), $('colar'));

    $('btnExportar').addEventListener('click', async () => {
      const acertos = otimizarTransacoesMatriz(transacoes);
      if (!acertos.length) return aviso('Não há transferências para exportar.');
      aviso('Gerando planilha…');
      try { const nome = await ExcelTransacoes.exportar(acertos); aviso('Planilha exportada: ' + nome); }
      catch (e) { aviso(e.message || 'Não foi possível exportar a planilha.'); }
    });

    render();
