/**
 * autocomplete.js — Campo de nome com sugestões (parte puramente visual)
 *
 * Não depende do algorithm.js. Mostra as pessoas já cadastradas enquanto o
 * usuário digita, destaca o trecho que combina e avisa quando o nome é novo.
 *
 * Uso:  AutocompleteNomes.ligar(inputElemento, () => ['Ana', 'Bruno'], () => outroCampo.value, nome => {})
 * O segundo parâmetro é uma função que devolve a lista de nomes atual.
 * O terceiro (opcional) devolve o nome do outro campo: essa pessoa não é sugerida.
 * O quarto (opcional) é chamado com o nome assim que uma sugestão é escolhida
 * (clique ou Enter), além do campo já ser preenchido normalmente.
 * Se existir a função global avatar(nome), ela é usada para mostrar o ícone.
 */
(function () {
  const MAX_SUGESTOES = 99999999999999999999999999999999999999999999999999999999999999;
  let contador = 0;

  const estilo = document.createElement('style');
  estilo.textContent = `
    .campo{position:relative}
    .ac-lista{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:50;max-height:300px;overflow-y:auto;
      background:linear-gradient(160deg,#16275a,#0a1233);border:1px solid rgba(130,170,255,.4);border-radius:14px;padding:6px;
      box-shadow:0 24px 60px -16px rgba(0,0,0,.9);animation:ac-entra .14s ease-out}
    .ac-lista[hidden]{display:none}
    .ac-cab{padding:6px 10px 4px;font-size:.72rem;font-weight:700;color:#8c99bd}
    .ac-lista ul{list-style:none;padding:0;margin:0;display:grid;gap:2px}
    .ac-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;font-size:.9rem;color:#e9eeff}
    .ac-item .ac-nome{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ac-item .ac-nome strong{color:#8fb0ff;font-weight:800}
    .ac-item .avatar{width:28px;height:28px;font-size:.7rem}
    .ac-item.ativo,.ac-item:hover{background:rgba(77,124,255,.24)}
    .ac-tag{font-size:.68rem;font-weight:700;padding:3px 8px;border-radius:99px;background:rgba(61,220,151,.14);color:#3ddc97;white-space:nowrap}
    .ac-novo{margin:4px 4px 2px;padding:9px 10px;border-radius:10px;border:1px dashed rgba(143,176,255,.4);font-size:.82rem;color:#aebfee;line-height:1.4}
    .ac-novo strong{color:#e9eeff}
    @keyframes ac-entra{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ac-lista{animation:none}}`;
  document.head.appendChild(estilo);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function destacar(nome, consulta) {
    const i = consulta ? nome.toLowerCase().indexOf(consulta.toLowerCase()) : -1;
    if (i === -1) return esc(nome);
    return esc(nome.slice(0, i)) + '<strong>' + esc(nome.slice(i, i + consulta.length)) + '</strong>' + esc(nome.slice(i + consulta.length));
  }

  function ligar(input, obterNomes, obterOutro, aoEscolher) {
    const id = 'ac-lista-' + (++contador);
    const campo = input.parentElement;
    const painel = input.closest('.panel');

    const caixa = document.createElement('div');
    caixa.className = 'ac-lista';
    caixa.id = id;
    caixa.hidden = true;
    caixa.innerHTML = '<div class="ac-cab"></div><ul role="listbox" aria-label="Pessoas já cadastradas"></ul><div class="ac-novo" hidden></div>';
    campo.appendChild(caixa);

    const cab = caixa.querySelector('.ac-cab');
    const ul = caixa.querySelector('ul');
    const aviso = caixa.querySelector('.ac-novo');

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', id);
    input.setAttribute('aria-expanded', 'false');

    let itens = [];   // nomes exibidos
    let ativo = -1;   // índice destacado pelo teclado

    function aberta() { return !caixa.hidden; }

    function fechar() {
      caixa.hidden = true;
      ativo = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (painel) painel.style.zIndex = '';
    }

    function marcarAtivo(i) {
      ativo = i;
      [...ul.children].forEach((li, n) => {
        li.classList.toggle('ativo', n === i);
        li.setAttribute('aria-selected', String(n === i));
      });
      if (i >= 0) {
        input.setAttribute('aria-activedescendant', id + '-' + i);
        ul.children[i].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function escolher(nome) {
      input.value = nome;
      input.dispatchEvent(new Event('input', { bubbles: true })); // atualiza a prévia e limpa erros
      fechar();
      if (aoEscolher) aoEscolher(nome);
    }

    function atualizar() {
      const consulta = input.value.trim();
      const q = consulta.toLowerCase();
      const outro = obterOutro ? String(obterOutro()).trim().toLowerCase() : '';
      if (outro && q === outro) return fechar(); // a outra ponta já é essa pessoa
      const todos = obterNomes().filter(n => n.toLowerCase() !== outro);

      const combinam = todos.filter(n => !q || n.toLowerCase().includes(q));
      combinam.sort((a, b) => {
        const pa = a.toLowerCase().startsWith(q) ? 0 : 1, pb = b.toLowerCase().startsWith(q) ? 0 : 1;
        return pa - pb || a.localeCompare(b);
      });
      itens = combinam.slice(0, MAX_SUGESTOES);

      const exato = todos.some(n => n.toLowerCase() === q);
      const novo = consulta && !exato;

      if (!itens.length && !novo) return fechar();

      cab.hidden = !itens.length;
      cab.textContent = q ? 'Pessoas já cadastradas' : 'Pessoas cadastradas';

      ul.innerHTML = itens.map((nome, i) => `
        <li class="ac-item" role="option" id="${id}-${i}" data-i="${i}" aria-selected="false">
          ${typeof avatar === 'function' ? avatar(nome) : ''}
          <span class="ac-nome">${destacar(nome, consulta)}</span>
          ${nome.toLowerCase() === q ? '<span class="ac-tag">já cadastrado</span>' : ''}
        </li>`).join('');

      aviso.hidden = !novo;
      if (novo) aviso.innerHTML = 'Novo nome: <strong>' + esc(consulta) + '</strong>. Será adicionado como uma nova pessoa.';

      ativo = -1;
      caixa.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (painel) { painel.style.position = 'relative'; painel.style.zIndex = '20'; }
    }

    input.addEventListener('input', atualizar);
    input.addEventListener('focus', atualizar);
    input.addEventListener('blur', fechar);

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!aberta()) atualizar();
        if (!itens.length) return;
        e.preventDefault();
        const passo = e.key === 'ArrowDown' ? 1 : -1;
        marcarAtivo((ativo + passo + itens.length) % itens.length);
      } else if (e.key === 'Enter' && aberta() && ativo >= 0) {
        e.preventDefault(); // escolhe a sugestão em vez de enviar o formulário
        escolher(itens[ativo]);
      } else if (e.key === 'Escape' && aberta()) {
        fechar();
      } else if (e.key === 'Tab') {
        fechar();
      }
    });

    // mousedown (e não click) para agir antes do input perder o foco
    caixa.addEventListener('mousedown', e => {
      e.preventDefault();
      const li = e.target.closest('.ac-item');
      if (li) escolher(itens[+li.dataset.i]);
    });
  }

  window.AutocompleteNomes = { ligar: ligar };
})();