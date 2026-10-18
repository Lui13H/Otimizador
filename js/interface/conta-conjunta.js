/**
 * conta-conjunta.js — Modal para dividir uma conta em grupo
 * (parte puramente visual; não depende do algorithm.js)
 *
 * O usuário informa o valor total, quem pagou e os participantes (em chips,
 * digitando e apertando Enter, ou escolhendo da lista de sugestões). Quem
 * pagou pode ser incluído entre os participantes com um clique (o "+ Fulano
 * também" aparece assim que o campo "Quem pagou" tem um nome que ainda não
 * está nos chips).
 *
 * O módulo calcula a parte de cada um (valor ÷ participantes), distribuindo
 * os centavos de arredondamento de forma justa (a soma das partes bate
 * exatamente com o valor total), e devolve uma linha por participante —
 * exceto quem pagou, que não fica devendo a si mesmo.
 *
 * Uso:
 *   ContaConjunta.ligar(() => ['Ana', 'Bruno', ...], ({ pagador, partes }) => {
 *     // partes: [{ nome, valor }, ...] — cada um deve 'valor' para 'pagador'
 *   });
 *   ContaConjunta.abrir();  // abre o modal (ex.: ao clicar num botão)
 */
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .dc-fundo{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:rgba(2,5,16,.72);backdrop-filter:blur(6px);animation:dc-fade .18s ease-out}
    .dc-fundo[hidden]{display:none}
    .dc-modal{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 40px);overflow-y:auto;
      padding:26px;border-radius:20px;background:linear-gradient(160deg,#14224c,#080e22);border:1px solid rgba(120,150,255,.38);
      box-shadow:0 40px 100px -20px rgba(0,0,0,.9),0 0 0 1px rgba(77,124,255,.12);animation:dc-entra .2s ease-out;
      display:grid;gap:14px}
    .dc-modal h3{font-size:1.1rem;font-weight:800;padding-right:36px}
    .dc-sub{color:var(--mut);font-size:.84rem;line-height:1.5;margin-top:-6px}
    .dc-fechar{position:absolute;top:14px;right:14px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:var(--mut);cursor:pointer;display:grid;place-items:center}
    .dc-fechar:hover{background:rgba(255,255,255,.08);color:var(--txt)}

    .dc-chips{display:flex;flex-wrap:wrap;gap:6px;min-height:2px;margin-bottom:6px}
    .dc-chips-vazio{color:var(--mut);font-size:.8rem;padding:4px 0}
    .dc-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:99px;
      background:rgba(77,124,255,.16);border:1px solid rgba(120,150,255,.4);font-size:.84rem;color:var(--txt)}
    .dc-chip button{display:grid;place-items:center;width:18px;height:18px;border:0;border-radius:50%;
      background:rgba(255,255,255,.12);color:inherit;cursor:pointer}
    .dc-chip button:hover{background:rgba(255,122,144,.35);color:var(--neg)}
    .dc-chip-sugestao{background:transparent;border-style:dashed;border-color:rgba(140,170,255,.5);color:var(--blue2);
      cursor:pointer;padding:6px 12px;font-size:.84rem}
    .dc-chip-sugestao:hover{background:rgba(77,124,255,.1)}

    .dc-previa{font-size:.84rem;color:var(--blue2);background:rgba(77,124,255,.1);padding:10px 13px;border-radius:12px;line-height:1.5}
    .dc-erro{min-height:1.1em;font-size:.82rem;color:var(--neg)}

    .dc-rodape{display:flex;justify-content:flex-end;gap:10px}

    @keyframes dc-fade{from{opacity:0}to{opacity:1}}
    @keyframes dc-entra{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.dc-fundo,.dc-modal{animation:none}}`;
  document.head.appendChild(estilo);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const norm = s => String(s).trim().toLowerCase();
  const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const ICONE_FECHAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICONE_X_CHIP = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  let fundo = null, focoAnterior = null;
  let participantes = [];   // nomes brutos (como digitados/escolhidos), na ordem de entrada
  let obterNomesPadrao = null, callbackPadrao = null;

  /* ---------- Cálculo: valor ÷ participantes, sem perder centavo no arredondamento ---------- */
  function calcularPartes(valorTotal, nomes) {
    const centavosTotal = Math.round(valorTotal * 100);
    const n = nomes.length;
    const base = Math.floor(centavosTotal / n);
    const resto = centavosTotal - base * n; // quantos ficam com 1 centavo a mais
    return nomes.map((nome, i) => ({ nome: nome, valor: (base + (i < resto ? 1 : 0)) / 100 }));
  }

  function adicionarParticipante(nomeBruto) {
    const nome = String(nomeBruto || '').trim();
    if (!nome) return;
    if (participantes.some(p => norm(p) === norm(nome))) return; // já está na lista
    participantes.push(nome);
    desenharChips();
  }

  function removerParticipante(i) {
    participantes.splice(i, 1);
    desenharChips();
  }

  function desenharChips() {
    const pagador = fundo.querySelector('#dcPagador').value.trim();
    let html = participantes.map((p, i) => `
      <span class="dc-chip">${esc(p)}<button type="button" data-rm="${i}" aria-label="Remover ${esc(p)}">${ICONE_X_CHIP}</button></span>
    `).join('');

    const pagadorNaLista = pagador && participantes.some(p => norm(p) === norm(pagador));
    if (pagador && !pagadorNaLista) {
      html += `<button type="button" class="dc-chip dc-chip-sugestao" id="dcIncluirPagador">+ ${esc(pagador)} também</button>`;
    }
    fundo.querySelector('#dcChips').innerHTML = html || '<span class="dc-chips-vazio">Nenhum participante ainda</span>';
    atualizarPrevia();
  }

  function atualizarPrevia() {
    const previaEl = fundo.querySelector('#dcPrevia');
    const valor = parseFloat(fundo.querySelector('#dcValor').value);
    const pagador = fundo.querySelector('#dcPagador').value.trim();

    if (!(valor > 0) || !pagador || !participantes.length) {
      previaEl.textContent = 'Preencha o valor, quem pagou e pelo menos um participante.';
      return;
    }

    const partes = calcularPartes(valor, participantes).filter(p => norm(p.nome) !== norm(pagador));
    if (!partes.length) {
      previaEl.innerHTML = `Adicione pelo menos uma pessoa além de <strong>${esc(pagador)}</strong> para dividir a conta.`;
      return;
    }

    const valores = [...new Set(partes.map(p => p.valor))];
    const resumoValor = valores.length === 1
      ? `<strong>${fmtBRL(valores[0])}</strong> cada`
      : `entre <strong>${fmtBRL(Math.min(...valores))}</strong> e <strong>${fmtBRL(Math.max(...valores))}</strong>`;
    previaEl.innerHTML = `${partes.length} ${partes.length === 1 ? 'pessoa vai dever' : 'pessoas vão dever'} ${resumoValor} para <strong>${esc(pagador)}</strong>.`;
  }

  function confirmar() {
    const erroEl = fundo.querySelector('#dcErro');
    const valor = parseFloat(fundo.querySelector('#dcValor').value);
    const pagador = fundo.querySelector('#dcPagador').value.trim();

    if (!(valor > 0)) { erroEl.textContent = 'Informe um valor maior que zero.'; fundo.querySelector('#dcValor').focus(); return; }
    if (!pagador) { erroEl.textContent = 'Informe quem pagou.'; fundo.querySelector('#dcPagador').focus(); return; }
    // Não foca #dcParticipante nestes dois casos: como o campo está vazio, focar
    // reabriria a lista de sugestões com todo mundo, cobrindo os botões do rodapé.
    if (!participantes.length) { erroEl.textContent = 'Adicione pelo menos um participante.'; return; }

    const partes = calcularPartes(valor, participantes).filter(p => norm(p.nome) !== norm(pagador));
    if (!partes.length) {
      erroEl.textContent = `Adicione pelo menos uma pessoa além de ${pagador}.`;
      return;
    }

    erroEl.textContent = '';
    const cb = callbackPadrao;
    fechar(true);
    if (cb) cb({ pagador: pagador, partes: partes });
  }

  function fechar(confirmado) {
    if (!fundo || fundo.hidden) return;
    fundo.hidden = true;
    participantes = [];
    if (!confirmado && focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
  }

  function nomesSugeridos() {
    return obterNomesPadrao ? obterNomesPadrao() : [];
  }

  function criarFundo() {
    fundo = document.createElement('div');
    fundo.className = 'dc-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="dc-modal" role="dialog" aria-modal="true" aria-labelledby="dcTitulo">
        <button class="dc-fechar" type="button" aria-label="Fechar">${ICONE_FECHAR}</button>
        <h3 id="dcTitulo">Dividir conta em grupo</h3>
        <p class="dc-sub">Uma pessoa paga o total; o valor é dividido entre quem participou, e cada um fica devendo a parte dele a quem pagou.</p>

        <div class="campo">
          <label for="dcValor">Valor total (R$)</label>
          <input id="dcValor" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0,00">
        </div>

        <div class="campo">
          <label for="dcPagador">Quem pagou</label>
          <input id="dcPagador" placeholder="Ex.: Ana">
        </div>

        <div class="campo">
          <label for="dcParticipante">Participantes (quem vai dividir a conta)</label>
          <div class="dc-chips" id="dcChips"></div>
          <input id="dcParticipante" placeholder="Digite um nome e aperte Enter">
        </div>

        <div class="dc-previa" id="dcPrevia" aria-live="polite"></div>
        <div class="dc-erro" id="dcErro" role="alert"></div>

        <div class="dc-rodape">
          <button class="btn" id="dcCancelar" type="button">Cancelar</button>
          <button class="btn primario" id="dcConfirmar" type="button">Adicionar transações</button>
        </div>
      </div>`;
    document.body.appendChild(fundo);

    const q = s => fundo.querySelector(s);

    q('.dc-fechar').addEventListener('click', () => fechar());
    q('#dcCancelar').addEventListener('click', () => fechar());
    q('#dcConfirmar').addEventListener('click', confirmar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });

    q('#dcValor').addEventListener('input', atualizarPrevia);
    q('#dcPagador').addEventListener('input', desenharChips);

    q('#dcChips').addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (rm) return removerParticipante(+rm.dataset.rm);
      if (e.target.closest('#dcIncluirPagador')) adicionarParticipante(q('#dcPagador').value);
    });

    const campoParticipante = q('#dcParticipante');
    if (window.AutocompleteNomes) {
      AutocompleteNomes.ligar(q('#dcPagador'), nomesSugeridos);
      AutocompleteNomes.ligar(campoParticipante, nomesSugeridos, null, nome => {
        adicionarParticipante(nome);
        campoParticipante.value = '';
      });
    }
    // Enter confirma um nome digitado à mão (quando o autocompletar não interceptou);
    // Backspace num campo vazio remove o último participante adicionado.
    campoParticipante.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.defaultPrevented) {
        e.preventDefault();
        adicionarParticipante(campoParticipante.value);
        campoParticipante.value = '';
        // Fecha e reabre a lista de sugestões: ela não se fecha sozinha porque o valor foi
        // limpo sem disparar 'input'. Reabrir (já vazia) deixa o campo pronto pro próximo nome.
        campoParticipante.blur();
        campoParticipante.focus();
      } else if (e.key === 'Backspace' && !campoParticipante.value && participantes.length) {
        participantes.pop();
        desenharChips();
      }
    });

    document.addEventListener('keydown', e => {
      if (fundo.hidden) return;
      if (e.key === 'Escape') return fechar();
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

  function abrir() {
    if (!fundo) criarFundo();
    focoAnterior = document.activeElement;
    participantes = [];

    fundo.querySelector('#dcValor').value = '';
    fundo.querySelector('#dcPagador').value = '';
    fundo.querySelector('#dcParticipante').value = '';
    fundo.querySelector('#dcErro').textContent = '';
    desenharChips();

    fundo.hidden = false;
    fundo.querySelector('#dcValor').focus();
  }

  function ligar(obterNomes, callback) {
    obterNomesPadrao = obterNomes;
    callbackPadrao = callback;
  }

  window.ContaConjunta = { ligar: ligar, abrir: abrir };
})();
