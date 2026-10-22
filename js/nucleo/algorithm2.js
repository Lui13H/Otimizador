// Função auxiliar de particionamento para o Quicksort manual
function particionar(arr, baixo, alto) {
    let pivo = arr[alto].saldo;
    let i = baixo - 1;
    for (let j = baixo; j < alto; j++) {
        if (arr[j].saldo < pivo) {
            i++;
            let temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
        }
    }
    let temp = arr[i + 1]; arr[i + 1] = arr[alto]; arr[alto] = temp;
    return i + 1;
}

// Quicksort manual (sem usar .sort())
function quickSort(arr, baixo, alto) {
    if (baixo < alto) {
        let pi = particionar(arr, baixo, alto);
        quickSort(arr, baixo, pi - 1);
        quickSort(arr, pi + 1, alto);
    }
}

/**
 * Otimizador de Transações (Split Financeiro) - Versão Didática e Direta
 * 
 * Parâmetros de Complexidade:
 *   - L = número de linhas (quantidade de transações brutas na matriz)
 *   - C = número de colunas (fixo em 3: [pagador, valor, recebedor])
 *   - N = número de pessoas únicas cadastradas
 * 
 * Complexidade Assintótica Global: O(L * N + N log N)
 */
function otimizarTransacoesMatriz(matrizTransacoes) {
    
    // -------------------------------------------------------------------------
    // ETAPA 1: Consolidação direta com Busca Linear (Sem Hash Map)
    // Custo: O(L * N) 
    // Justificativa: Para cada uma das L linhas, percorremos a matriz de saldos 
    // de tamanho N usando .findIndex() para atualizar ou inserir o valor.
    // -------------------------------------------------------------------------
    let saldos = []; // Matriz interna de saldos: [ [nome, saldo], ... ]

    for (let i = 0; i < matrizTransacoes.length; i++) {
        let pagador = matrizTransacoes[i][0];
        let valor = Number(matrizTransacoes[i][1]);
        let recebedor = matrizTransacoes[i][2];

        // Procura se o pagador já existe na lista de saldos (Custo O(N) por busca)
        let pIndex = saldos.findIndex(row => row[0] === pagador);
        if (pIndex !== -1) {
            saldos[pIndex][1] -= valor; // Subtrai do saldo existente
        } else {
            saldos.push([pagador, -valor]); // Adiciona novo registro
        }

        // Procura se o recebedor já existe na lista de saldos (Custo O(N) por busca)
        let rIndex = saldos.findIndex(row => row[0] === recebedor);
        if (rIndex !== -1) {
            saldos[rIndex][1] += valor; // Soma ao saldo existente
        } else {
            saldos.push([recebedor, valor]); // Adiciona novo registro
        }
    }

    // -------------------------------------------------------------------------
    // ETAPA 2: Filtragem de Resíduos Infinitesimais
    // Custo: O(N)
    // Justificativa: Varre o vetor de tamanho N para remover pessoas com saldo zero.
    // -------------------------------------------------------------------------
    let pessoas = [];
    for (let i = 0; i < saldos.length; i++) {
        let nome = saldos[i][0];
        let saldo = saldos[i][1];
        
        if (Math.abs(saldo) > 0.005) {
            pessoas.push({ nome: nome, saldo: saldo });
        }
    }

    // -------------------------------------------------------------------------
    // ETAPA 3: Ordenação Estratégica (.sort / Timsort)
    // Custo: O(N log N)
    // Justificativa: Ordena o vetor de pessoas únicas do menor para o maior saldo.
    // Esta é a operação que dita o gargalo principal do matching financeiro.
    // -------------------------------------------------------------------------
    pessoas.sort((a, b) => a.saldo - b.saldo);

    // -------------------------------------------------------------------------
    // ETAPA 4: Liquidação por Dois Ponteiros nas Pontas
    // Custo: O(N)
    // Justificativa: Percorre linearmente o vetor ordenado de tamanho N convergindo 
    // das extremidades (esq para devedores, dir para credores).
    // -------------------------------------------------------------------------
    const transferencias = [];
    let esq = 0;                  // Ponteiro esquerdo (maiores devedores)
    let dir = pessoas.length - 1; // Ponteiro direito (maiores credores)

    while (esq < dir) {
        let devedor = pessoas[esq];
        let credor = pessoas[dir];

        // Descobre o menor valor entre a dívida e o crédito disponível
        let valor = Math.min(-devedor.saldo, credor.saldo);

        transferencias.push({
            de: devedor.nome,
            para: credor.nome,
            valor: Number(valor.toFixed(2))
        });

        // Abate o valor transferido diretamente nos saldos em memória
        devedor.saldo += valor;
        credor.saldo -= valor;

        // Avança ou recua os ponteiros caso os saldos tenham sido quitados
        if (Math.abs(devedor.saldo) < 0.01) esq++;
        if (Math.abs(credor.saldo) < 0.01) dir--;
    }

    // Retorna a lista contendo o menor número de transferências possíveis
    return transferencias;
}